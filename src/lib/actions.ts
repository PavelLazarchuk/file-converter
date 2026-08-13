'use server';

import sharp, { type Metadata, type Sharp } from 'sharp';
import { PDFDocument, type PDFImage } from 'pdf-lib';

import {
    CONVERT_SOURCE_KEYS,
    DEFAULT_ICO_SIZES,
    DEFAULT_QUALITY,
    DEFAULT_TARGET_KB,
    FAVICON_PACK,
    FORMAT_KEYS,
    IMAGE_FORMATS,
    MAX_BATCH_BYTES,
    MAX_BATCH_FILES,
    MAX_BATCH_SIZE_LABEL,
    MAX_FILE_SIZE,
    MAX_FILE_SIZE_LABEL,
    MAX_INPUT_PIXELS,
    PDF_PAGE_DIMENSIONS,
    PDF_PAGE_MARGIN,
    QUALITY_LIMITS,
    STRIP_QUALITY,
    SVG_FONT_STACK,
    WATERMARK_DEFAULTS,
    ZIP_MIME_TYPE,
    acceptedFormatsLabel,
    circleOutputFormat,
    clampCropBox,
    convertSourceFromSharpFormat,
    escapeXml,
    fitPads,
    formatFileSize,
    placeholderFontSize,
    placeholderLabel,
    rotateSuffix,
    stripExtension,
    uniqueFilenames,
    watermarkLogoLayout,
    watermarkOffset,
    watermarkSvg,
    watermarkTextLayout,
    type ConvertSource,
    type ImageFormat,
    type PdfPageSize,
    type Size,
} from './image';
import { encodeIco } from './ico';
import { describeMetadata } from './exif';
import { Logger, type LogContext } from './logger';
import { METADATA_MIME_TYPE } from './metadata';
import { RATE_LIMIT, checkRateLimit } from './rate-limit';
import { createZip, type ZipEntry } from './zip';
import {
    compressSchema,
    convertSchema,
    cropSchema,
    icoOptionsSchema,
    imageToPdfSchema,
    outputSizeSchema,
    placeholderSchema,
    resizeSchema,
    rotateSchema,
    watermarkSchema,
} from './schemas';

export type ActionFile = {
    data: Uint8Array;
    filename: string;
    mimeType: string;
    originalSize: number;
    warning?: string;
};

export type ActionFailure = { filename: string; error: string };

export type ActionResult =
    | { success: true; files: ActionFile[]; failures?: ActionFailure[] }
    | { success: false; error: string };

class ProcessingError extends Error {}

type ToolName =
    | 'resize'
    | 'crop'
    | 'compress'
    | 'convert'
    | 'pdf'
    | 'placeholder'
    | 'rotate'
    | 'watermark'
    | 'inspect'
    | 'strip';

function decode(buffer: Buffer) {
    return sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).autoOrient();
}

function sourceSize(metadata: Metadata): Size {
    const swapped = (metadata.orientation ?? 1) >= 5;
    const width = (swapped ? metadata.height : metadata.width) ?? 0;
    const height = (swapped ? metadata.width : metadata.height) ?? 0;

    if (!width || !height) throw new ProcessingError('Could not read the image dimensions.');

    return { width, height };
}

type SourceImage<Format extends ConvertSource> = {
    buffer: Buffer;
    format: Format;
    name: string;
    baseName: string;
    size: number;
    metadata: Metadata;
};

async function inspect(buffer: Buffer): Promise<Metadata | null> {
    try {
        return await decode(buffer).metadata();
    } catch (error) {
        if (error instanceof Error && error.message.includes('pixel limit')) throw error;

        return null;
    }
}

async function readSource<Format extends ConvertSource>(
    file: File,
    formats: readonly Format[]
): Promise<SourceImage<Format>> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = await inspect(buffer);

    if (!metadata) {
        throw new ProcessingError(
            `This file isn't a readable image — its contents don't match any supported format. Use ${acceptedFormatsLabel(formats)}.`
        );
    }

    const detected = convertSourceFromSharpFormat(metadata.format);
    const format = formats.find(key => key === detected);

    if (!format) {
        const actual = detected ? `${IMAGE_FORMATS[detected].label} files are` : 'This format is';

        throw new ProcessingError(
            `${actual} not supported by this tool. Use ${acceptedFormatsLabel(formats)}.`
        );
    }

    return {
        buffer,
        format,
        name: file.name,
        baseName: stripExtension(file.name) || 'image',
        size: file.size,
        metadata,
    };
}

type SourceBatch<Format extends ConvertSource> = {
    tool: ToolName;
    sources: SourceImage<Format>[];
    failures: ActionFailure[];
};

async function readImageFiles<Format extends ConvertSource>(
    tool: ToolName,
    formData: FormData,
    formats: readonly Format[]
): Promise<SourceBatch<Format>> {
    const files = formData
        .getAll('file')
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!files.length) throw new ProcessingError('No file provided.');

    if (files.length > MAX_BATCH_FILES) {
        throw new ProcessingError(
            `Too many files — this tool takes up to ${MAX_BATCH_FILES} images at a time.`
        );
    }

    const sources: SourceImage<Format>[] = [];
    const failures: ActionFailure[] = [];
    const usable = files.filter(file => {
        if (file.size <= MAX_FILE_SIZE) return true;

        failures.push({
            filename: file.name,
            error: `File is too large. The maximum size is ${MAX_FILE_SIZE_LABEL}.`,
        });

        return false;
    });
    const totalBytes = usable.reduce((sum, file) => sum + file.size, 0);

    if (totalBytes > MAX_BATCH_BYTES) {
        throw new ProcessingError(
            `These files add up to ${formatFileSize(totalBytes)}. Keep a batch under ${MAX_BATCH_SIZE_LABEL} in total.`
        );
    }

    for (const file of usable) {
        try {
            sources.push(await readSource(file, formats));
        } catch (error) {
            failures.push(describeFailure(file.name, error, { tool, stage: 'read' }));
        }
    }

    if (!sources.length) {
        throw new ProcessingError(failures[0]?.error ?? 'No file provided.');
    }

    return { tool, sources, failures };
}

function flag(formData: FormData, name: string): boolean {
    return formData.get(name) === 'true';
}

function keepMetadataRequested(formData: FormData): boolean {
    return flag(formData, 'keepMetadata');
}

function output(
    source: { size: number },
    data: Buffer | Uint8Array,
    filename: string,
    mimeType: string,
    warning?: string
): ActionFile {
    return {
        data: new Uint8Array(data),
        filename,
        mimeType,
        originalSize: source.size,
        ...(warning ? { warning } : {}),
    };
}

function imageContext(source: SourceImage<ConvertSource>): LogContext {
    return {
        format: source.format,
        bytes: source.size,
        width: source.metadata.width,
        height: source.metadata.height,
    };
}

function describeFailure(filename: string, error: unknown, context: LogContext): ActionFailure {
    if (error instanceof ProcessingError) return { filename, error: error.message };

    if (error instanceof Error && error.message.includes('pixel limit')) {
        return { filename, error: 'Image dimensions are too large to process.' };
    }

    Logger.error('image.failed', { ...context, error });

    return { filename, error: 'Something went wrong while processing the image.' };
}

function collect(files: ActionFile[], failures: ActionFailure[]): ActionResult {
    if (!files.length) {
        return {
            success: false,
            error: failures[0]?.error ?? 'Something went wrong while processing the image.',
        };
    }

    const names = uniqueFilenames(files.map(file => file.filename));

    return {
        success: true,
        files: files.map((file, index) => ({ ...file, filename: names[index] })),
        ...(failures.length ? { failures } : {}),
    };
}

async function run(
    tool: ToolName,
    process: () => Promise<ActionResult>,
    cost = 1
): Promise<ActionResult> {
    const limit = await checkRateLimit(cost);

    if (!limit.allowed) {
        Logger.warn('action.rate_limited', {
            tool,
            cost,
            retryAfterSeconds: limit.retryAfterSeconds,
        });

        return {
            success: false,
            error: `Too many requests — this tool allows ${RATE_LIMIT.images} images per minute. Try again in ${limit.retryAfterSeconds}s.`,
        };
    }

    try {
        return await process();
    } catch (error) {
        if (error instanceof ProcessingError) {
            return { success: false, error: error.message };
        }
        if (error instanceof Error && error.message.includes('pixel limit')) {
            return { success: false, error: 'Image dimensions are too large to process.' };
        }

        Logger.error('action.failed', { tool, cost, error });

        return { success: false, error: 'Something went wrong while processing the image.' };
    }
}

function uploadCount(formData: FormData): number {
    return Math.min(MAX_BATCH_FILES, Math.max(1, formData.getAll('file').length));
}

async function runFiles<Format extends ConvertSource>(
    tool: ToolName,
    formData: FormData,
    formats: readonly Format[],
    handle: (batch: SourceBatch<Format>) => Promise<ActionResult>,
    cost = uploadCount(formData)
): Promise<ActionResult> {
    return run(tool, async () => handle(await readImageFiles(tool, formData, formats)), cost);
}

async function eachFile<Format extends ConvertSource>(
    { tool, sources, failures }: SourceBatch<Format>,
    process: (source: SourceImage<Format>) => Promise<ActionFile>
): Promise<ActionResult> {
    const produced: ActionFile[] = [];
    const problems = [...failures];

    for (const source of sources) {
        try {
            produced.push(await process(source));
        } catch (error) {
            problems.push(describeFailure(source.name, error, { tool, ...imageContext(source) }));
        }
    }

    return collect(produced, problems);
}

export async function resizeImage(formData: FormData): Promise<ActionResult> {
    return runFiles('resize', formData, FORMAT_KEYS, async batch => {
        const parsed = resizeSchema.safeParse({
            width: formData.get('width'),
            height: formData.get('height'),
            rotate: formData.get('rotate') || '0',
            fit: formData.get('fit') || 'contain',
        });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid dimensions.');
        }

        const { width, height, rotate, fit } = parsed.data;
        const withoutEnlargement = flag(formData, 'noEnlarge');
        const keepMetadata = keepMetadataRequested(formData);

        return eachFile(batch, async source => {
            const background =
                source.format === 'jpeg'
                    ? { r: 255, g: 255, b: 255 }
                    : { r: 0, g: 0, b: 0, alpha: 0 };
            let pipeline = decode(source.buffer);

            if (rotate !== '0') pipeline = pipeline.rotate(Number(rotate));

            pipeline = pipeline
                .resize(width, height, {
                    fit,
                    withoutEnlargement,
                    ...(fitPads(fit) && { background }),
                })
                .toFormat(source.format);

            if (keepMetadata) pipeline = pipeline.keepMetadata();

            const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
            const { extension, mimeType } = IMAGE_FORMATS[source.format];

            return output(
                source,
                data,
                `${source.baseName}-${info.width}x${info.height}.${extension}`,
                mimeType
            );
        });
    });
}

export async function cropImage(formData: FormData): Promise<ActionResult> {
    return runFiles('crop', formData, FORMAT_KEYS, async batch => {
        const parsed = cropSchema.safeParse({
            ratio: formData.get('ratio'),
            shape: formData.get('shape'),
            left: formData.get('left'),
            top: formData.get('top'),
            width: formData.get('width'),
            height: formData.get('height'),
        });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid crop settings.');
        }

        const keepMetadata = keepMetadataRequested(formData);
        const requestedSize = formData.get('resizeTo');
        const outputSize = requestedSize ? outputSizeSchema.safeParse(requestedSize) : null;

        if (outputSize && !outputSize.success) {
            throw new ProcessingError(
                outputSize.error.issues[0]?.message ?? 'Invalid output size.'
            );
        }

        const target = outputSize?.success ? outputSize.data : null;

        return eachFile(batch, async source => {
            const { width: srcWidth, height: srcHeight } = sourceSize(source.metadata);
            const box = clampCropBox(parsed.data, srcWidth, srcHeight);
            const circle = parsed.data.shape === 'circle';
            const outFormat = circle ? circleOutputFormat(source.format) : source.format;
            let pipeline = decode(source.buffer).extract(box);

            if (circle) {
                const mask = Buffer.from(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}">
                    <ellipse cx="${box.width / 2}" cy="${box.height / 2}" rx="${box.width / 2}" ry="${box.height / 2}" fill="#fff"/>
                </svg>`
                );

                pipeline = pipeline.ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]);
            }

            if (target) pipeline = pipeline.resize(target.width, target.height, { fit: 'cover' });

            pipeline = pipeline.toFormat(outFormat);

            if (keepMetadata) pipeline = pipeline.keepMetadata();

            const data = await pipeline.toBuffer();
            const { extension, mimeType } = IMAGE_FORMATS[outFormat];
            const ratioLabel = target
                ? `${target.width}x${target.height}`
                : parsed.data.ratio === 'free'
                  ? `${box.width}x${box.height}`
                  : parsed.data.ratio.replace(':', 'x');
            const shapeLabel = circle ? '-circle' : '';

            return output(
                source,
                data,
                `${source.baseName}-${ratioLabel}${shapeLabel}.${extension}`,
                mimeType
            );
        });
    });
}

function applyQuality(pipeline: Sharp, format: ImageFormat, quality: number): Sharp {
    switch (format) {
        case 'jpeg':
            return pipeline.jpeg({ quality, mozjpeg: true });
        case 'png':
            return pipeline.png({ quality, palette: true, compressionLevel: 9 });
        case 'webp':
            return pipeline.webp({ quality });
        case 'avif':
            return pipeline.avif({ quality });
    }
}

const RAW_REUSE_MAX_PIXELS = 24_000_000;
const MAX_QUALITY_STEPS = 7;
const CLOSE_ENOUGH_RATIO = 0.94;

async function createDecoder(buffer: Buffer, metadata: Metadata): Promise<() => Sharp> {
    const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);

    if (!pixels || pixels > RAW_REUSE_MAX_PIXELS) return () => decode(buffer);

    const { data, info } = await decode(buffer).raw().toBuffer({ resolveWithObject: true });

    return () =>
        sharp(data, {
            raw: { width: info.width, height: info.height, channels: info.channels },
        });
}

async function compressToTarget(
    source: SourceImage<ImageFormat>,
    targetKb: number,
    filename: string
): Promise<ActionFile> {
    const { mimeType } = IMAGE_FORMATS[source.format];
    const targetBytes = targetKb * 1024;
    const nextPipeline = await createDecoder(source.buffer, source.metadata);
    let low = QUALITY_LIMITS.min;
    let high = QUALITY_LIMITS.max;
    let best: Buffer | null = null;
    let smallest: Buffer | null = null;

    for (let step = 0; step < MAX_QUALITY_STEPS && low <= high; step += 1) {
        const candidateQuality = Math.floor((low + high) / 2);
        const candidate = await applyQuality(
            nextPipeline(),
            source.format,
            candidateQuality
        ).toBuffer();

        if (candidate.length <= targetBytes) {
            best = candidate;

            if (candidate.length >= targetBytes * CLOSE_ENOUGH_RATIO) break;

            low = candidateQuality + 1;
        } else {
            if (!smallest || candidate.length < smallest.length) smallest = candidate;

            high = candidateQuality - 1;
        }
    }

    if (best) return output(source, best, filename, mimeType);

    if (!smallest) throw new ProcessingError('Could not compress this image.');

    Logger.info('compress.target_missed', {
        tool: 'compress',
        ...imageContext(source),
        targetBytes,
        smallestBytes: smallest.length,
    });

    return output(
        source,
        smallest,
        filename,
        mimeType,
        `Couldn't reach ${formatFileSize(targetBytes)} at these dimensions — the smallest ` +
            `this image compresses to is ${formatFileSize(smallest.length)}. Resize it first for anything smaller.`
    );
}

export async function compressImage(formData: FormData): Promise<ActionResult> {
    return runFiles('compress', formData, FORMAT_KEYS, async batch => {
        const parsed = compressSchema.safeParse({
            mode: formData.get('mode') || 'quality',
            quality: formData.get('quality') || String(DEFAULT_QUALITY),
            targetKb: formData.get('targetKb') || String(DEFAULT_TARGET_KB),
        });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid settings.');
        }

        const { mode, quality, targetKb } = parsed.data;

        return eachFile(batch, async source => {
            const { extension, mimeType } = IMAGE_FORMATS[source.format];
            const filename = `${source.baseName}-compressed.${extension}`;

            if (mode === 'size') return compressToTarget(source, targetKb, filename);

            const data = await applyQuality(
                decode(source.buffer),
                source.format,
                quality
            ).toBuffer();

            return output(source, data, filename, mimeType);
        });
    });
}

function hasStrippableMetadata(metadata: Metadata): boolean {
    return Boolean(metadata.exif || metadata.icc || metadata.iptc || metadata.xmp);
}

async function base64Bytes(
    buffer: Buffer,
    source: ConvertSource,
    metadata: Metadata,
    keepMetadata: boolean
): Promise<Buffer> {
    if (keepMetadata || source === 'gif' || source === 'svg') return buffer;
    if (!hasStrippableMetadata(metadata)) return buffer;

    return decode(buffer).toFormat(source, { quality: STRIP_QUALITY[source] }).toBuffer();
}

function iconPng(buffer: Buffer, size: number, background?: string): Promise<Buffer> {
    const pipeline = decode(buffer).resize(size, size, {
        fit: 'contain',
        background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    });

    return (background ? pipeline.flatten({ background }) : pipeline).png().toBuffer();
}

async function buildIco(buffer: Buffer, sizes: number[]): Promise<Buffer> {
    const pngs = await Promise.all(sizes.map(size => iconPng(buffer, size)));

    return encodeIco(sizes.map((size, index) => ({ size, data: pngs[index] })));
}

async function buildFaviconPackAssets(
    buffer: Buffer,
    baseName: string
): Promise<{ appleTouch: Buffer; manifestIcons: Buffer[]; manifest: Buffer; readme: Buffer }> {
    const [appleTouch, ...manifestIcons] = await Promise.all([
        iconPng(buffer, FAVICON_PACK.appleTouch, '#ffffff'),
        ...FAVICON_PACK.manifestSizes.map(size => iconPng(buffer, size)),
    ]);
    const manifest = {
        name: baseName,
        short_name: baseName,
        icons: FAVICON_PACK.manifestSizes.map(size => ({
            src: `/icon-${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
        })),
        display: 'standalone',
    };
    const readme = [
        'Copy these files to the root of your site, then add to <head>:',
        '',
        '<link rel="icon" href="/favicon.ico" sizes="any">',
        `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
        '<link rel="manifest" href="/site.webmanifest">',
        '',
    ].join('\n');

    return {
        appleTouch,
        manifestIcons,
        manifest: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
        readme: Buffer.from(readme, 'utf8'),
    };
}

function faviconPackEntries(
    icon: Buffer,
    assets: Awaited<ReturnType<typeof buildFaviconPackAssets>>
): ZipEntry[] {
    return [
        { name: 'favicon.ico', data: icon },
        { name: 'apple-touch-icon.png', data: assets.appleTouch },
        ...assets.manifestIcons.map((data, index) => ({
            name: `icon-${FAVICON_PACK.manifestSizes[index]}.png`,
            data,
        })),
        { name: 'site.webmanifest', data: assets.manifest },
        { name: 'README.txt', data: assets.readme },
    ];
}

export async function convertImage(formData: FormData): Promise<ActionResult> {
    return runFiles('convert', formData, CONVERT_SOURCE_KEYS, async batch => {
        const parsed = convertSchema.safeParse({ format: formData.get('format') });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid target format.');
        }

        const target = parsed.data.format;
        const keepMetadata = keepMetadataRequested(formData);
        const icoOptions =
            target === 'ico'
                ? icoOptionsSchema.safeParse({
                      sizes: formData.get('icoSizes') || DEFAULT_ICO_SIZES.join(','),
                      pack: formData.get('icoPack') || 'false',
                  })
                : null;

        if (icoOptions && !icoOptions.success) {
            throw new ProcessingError(
                icoOptions.error.issues[0]?.message ?? 'Invalid favicon settings.'
            );
        }

        return eachFile(batch, async source => {
            const { buffer, baseName, format: from, metadata } = source;

            if (target === from) {
                throw new ProcessingError('Target format must differ from the source format.');
            }

            if (target === 'base64') {
                const bytes = await base64Bytes(buffer, from, metadata, keepMetadata);
                const dataUri = `data:${IMAGE_FORMATS[from].mimeType};base64,${bytes.toString('base64')}`;
                const { extension, mimeType } = IMAGE_FORMATS.base64;

                return output(
                    source,
                    Buffer.from(dataUri, 'utf8'),
                    `${baseName}-base64.${extension}`,
                    mimeType
                );
            }

            if (target === 'svg') {
                let pipeline = decode(buffer).png();

                if (keepMetadata) pipeline = pipeline.keepMetadata();

                const { data: png, info } = await pipeline.toBuffer({ resolveWithObject: true });
                const svg =
                    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
                    `width="${info.width}" height="${info.height}" viewBox="0 0 ${info.width} ${info.height}">` +
                    `<image width="${info.width}" height="${info.height}" ` +
                    `xlink:href="data:image/png;base64,${png.toString('base64')}"/>` +
                    `</svg>`;
                const { extension, mimeType } = IMAGE_FORMATS.svg;

                return output(
                    source,
                    Buffer.from(svg, 'utf8'),
                    `${baseName}.${extension}`,
                    mimeType
                );
            }

            if (target === 'ico') {
                const options = icoOptions?.success ? icoOptions.data : null;

                if (!options) throw new ProcessingError('Invalid favicon settings.');

                if (options.pack === 'false') {
                    const icon = await buildIco(buffer, options.sizes);
                    const { extension, mimeType } = IMAGE_FORMATS.ico;

                    return output(source, icon, `${baseName}.${extension}`, mimeType);
                }

                const [icon, assets] = await Promise.all([
                    buildIco(buffer, options.sizes),
                    buildFaviconPackAssets(buffer, baseName),
                ]);

                return output(
                    source,
                    createZip(faviconPackEntries(icon, assets)),
                    `${baseName}-favicons.zip`,
                    ZIP_MIME_TYPE
                );
            }

            let pipeline = decode(buffer);

            if (target === 'jpeg') {
                pipeline = pipeline.flatten({ background: '#ffffff' });
            }

            pipeline = pipeline.toFormat(target);

            if (keepMetadata) pipeline = pipeline.keepMetadata();

            const data = await pipeline.toBuffer();
            const { extension, mimeType } = IMAGE_FORMATS[target];

            return output(source, data, `${baseName}.${extension}`, mimeType);
        });
    });
}

async function embedPdfImage(
    pdfDoc: PDFDocument,
    source: SourceImage<ConvertSource>
): Promise<PDFImage> {
    const isJpeg = source.format === 'jpeg';
    const imageBytes = await decode(source.buffer)
        .toFormat(isJpeg ? 'jpeg' : 'png', isJpeg ? { quality: 90 } : undefined)
        .toBuffer();

    return isJpeg ? pdfDoc.embedJpg(imageBytes) : pdfDoc.embedPng(imageBytes);
}

function drawPdfPage(pdfDoc: PDFDocument, embedded: PDFImage, pageSize: PdfPageSize): void {
    const { width: imgWidth, height: imgHeight } = embedded;

    if (pageSize === 'fit') {
        const page = pdfDoc.addPage([imgWidth, imgHeight]);

        page.drawImage(embedded, { x: 0, y: 0, width: imgWidth, height: imgHeight });

        return;
    }

    const [portraitWidth, portraitHeight] = PDF_PAGE_DIMENSIONS[pageSize];
    const landscape = imgWidth > imgHeight;
    const pageWidth = landscape ? portraitHeight : portraitWidth;
    const pageHeight = landscape ? portraitWidth : portraitHeight;
    const scale = Math.min(
        (pageWidth - PDF_PAGE_MARGIN * 2) / imgWidth,
        (pageHeight - PDF_PAGE_MARGIN * 2) / imgHeight
    );
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    page.drawImage(embedded, {
        x: (pageWidth - drawWidth) / 2,
        y: (pageHeight - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight,
    });
}

export async function imageToPdf(formData: FormData): Promise<ActionResult> {
    return runFiles('pdf', formData, CONVERT_SOURCE_KEYS, async ({ tool, sources, failures }) => {
        const parsed = imageToPdfSchema.safeParse({ pageSize: formData.get('pageSize') });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid page size.');
        }

        const { pageSize } = parsed.data;
        const pdfDoc = await PDFDocument.create();
        const problems = [...failures];
        const used: SourceImage<ConvertSource>[] = [];

        for (const source of sources) {
            try {
                drawPdfPage(pdfDoc, await embedPdfImage(pdfDoc, source), pageSize);
                used.push(source);
            } catch (error) {
                problems.push(
                    describeFailure(source.name, error, { tool, ...imageContext(source) })
                );
            }
        }

        if (!used.length) return collect([], problems);

        const data = await pdfDoc.save();
        const originalSize = used.reduce((sum, source) => sum + source.size, 0);
        const filename =
            used.length === 1
                ? `${used[0].baseName}.pdf`
                : `${used[0].baseName}-${used.length}-pages.pdf`;

        return collect(
            [output({ size: originalSize }, data, filename, 'application/pdf')],
            problems
        );
    });
}

export async function generatePlaceholder(formData: FormData): Promise<ActionResult> {
    return run('placeholder', async () => {
        const parsed = placeholderSchema.safeParse({
            width: formData.get('width'),
            height: formData.get('height'),
            bgColor: formData.get('bgColor'),
            textColor: formData.get('textColor'),
            text: formData.get('text') ?? '',
            format: formData.get('format'),
        });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid settings.');
        }

        const { width, height, bgColor, textColor, text, format } = parsed.data;
        const label = placeholderLabel(text, width, height);
        const fontSize = placeholderFontSize(width, height, label);
        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
            `<rect width="100%" height="100%" fill="${bgColor}"/>` +
            `<text x="50%" y="50%" fill="${textColor}" font-family="${SVG_FONT_STACK}" ` +
            `font-size="${fontSize}" font-weight="500" text-anchor="middle" ` +
            `dominant-baseline="central">${escapeXml(label)}</text>` +
            `</svg>`;

        const data = await sharp(Buffer.from(svg), { limitInputPixels: MAX_INPUT_PIXELS })
            .toFormat(format)
            .toBuffer();

        const { extension, mimeType } = IMAGE_FORMATS[format];

        return collect(
            [output({ size: 0 }, data, `placeholder-${width}x${height}.${extension}`, mimeType)],
            []
        );
    });
}

export async function rotateImage(formData: FormData): Promise<ActionResult> {
    return runFiles('rotate', formData, FORMAT_KEYS, async batch => {
        const parsed = rotateSchema.safeParse({
            angle: formData.get('angle') || '0',
            background: formData.get('background') || '#ffffff',
        });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid rotation.');
        }

        const { angle, background } = parsed.data;
        const flipHorizontal = flag(formData, 'flipHorizontal');
        const flipVertical = flag(formData, 'flipVertical');
        const transparent = flag(formData, 'transparent');
        const keepMetadata = keepMetadataRequested(formData);

        if (!angle && !flipHorizontal && !flipVertical) {
            throw new ProcessingError('Nothing to do — pick an angle or a flip.');
        }

        return eachFile(batch, async source => {
            let pipeline = decode(source.buffer);

            if (angle) {
                const fill =
                    transparent && source.format !== 'jpeg'
                        ? { r: 0, g: 0, b: 0, alpha: 0 }
                        : background;

                pipeline = pipeline.rotate(angle, { background: fill });
            }

            if (flipHorizontal) pipeline = pipeline.flop();
            if (flipVertical) pipeline = pipeline.flip();

            pipeline = pipeline.toFormat(source.format);

            if (keepMetadata) pipeline = pipeline.keepMetadata();

            const data = await pipeline.toBuffer();
            const { extension, mimeType } = IMAGE_FORMATS[source.format];
            const suffix = rotateSuffix({ angle, flipHorizontal, flipVertical });

            return output(source, data, `${source.baseName}-${suffix}.${extension}`, mimeType);
        });
    });
}

function fade(pipeline: Sharp, opacity: number): Sharp {
    if (opacity >= 100) return pipeline;

    return pipeline.ensureAlpha().composite([
        {
            input: Buffer.from([255, 255, 255, Math.round((opacity / 100) * 255)]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: 'dest-in',
        },
    ]);
}

type Overlay = Size & { data: Buffer };

async function textOverlay(
    image: Size,
    options: { text: string; color: string; scale: number; opacity: number }
): Promise<Overlay> {
    const layout = watermarkTextLayout(image, options.scale, options.text);
    const svg = watermarkSvg(layout, options.text, options.color);
    const data = await fade(
        sharp(Buffer.from(svg), { limitInputPixels: MAX_INPUT_PIXELS }),
        options.opacity
    )
        .png()
        .toBuffer();

    return { data, width: layout.width, height: layout.height };
}

async function logoOverlay(
    image: Size,
    logo: { buffer: Buffer; size: Size },
    options: { scale: number; opacity: number }
): Promise<Overlay> {
    const layout = watermarkLogoLayout(image, options.scale, logo.size);
    const data = await fade(
        decode(logo.buffer).resize(layout.width, layout.height, { fit: 'fill' }),
        options.opacity
    )
        .png()
        .toBuffer();

    return { data, ...layout };
}

async function readLogo(
    formData: FormData,
    budget: number
): Promise<{ buffer: Buffer; size: Size }> {
    const file = formData.get('logo');

    if (!(file instanceof File) || file.size === 0) {
        throw new ProcessingError('Upload the image to use as the watermark.');
    }

    if (file.size > budget) {
        throw new ProcessingError(
            `The images and the watermark image add up to more than ${MAX_BATCH_SIZE_LABEL}. Use a smaller watermark, or fewer images.`
        );
    }

    const source = await readSource(file, CONVERT_SOURCE_KEYS);

    return { buffer: source.buffer, size: sourceSize(source.metadata) };
}

export async function watermarkImage(formData: FormData): Promise<ActionResult> {
    return runFiles('watermark', formData, FORMAT_KEYS, async batch => {
        const parsed = watermarkSchema.safeParse({
            mode: formData.get('mode') || WATERMARK_DEFAULTS.mode,
            text: formData.get('text') ?? '',
            color: formData.get('color') || WATERMARK_DEFAULTS.color,
            position: formData.get('position') || WATERMARK_DEFAULTS.position,
            opacity: formData.get('opacity') || WATERMARK_DEFAULTS.opacity,
            scale: formData.get('scale') || WATERMARK_DEFAULTS.scale,
            margin: formData.get('margin') || WATERMARK_DEFAULTS.margin,
        });

        if (!parsed.success) {
            throw new ProcessingError(
                parsed.error.issues[0]?.message ?? 'Invalid watermark settings.'
            );
        }

        const { mode, text, color, position, opacity, scale, margin } = parsed.data;
        const keepMetadata = keepMetadataRequested(formData);
        const uploaded = batch.sources.reduce((sum, source) => sum + source.size, 0);
        const logo = mode === 'image' ? await readLogo(formData, MAX_BATCH_BYTES - uploaded) : null;

        return eachFile(batch, async source => {
            const size = sourceSize(source.metadata);
            const overlay = logo
                ? await logoOverlay(size, logo, { scale, opacity })
                : await textOverlay(size, { text, color, scale, opacity });
            const { left, top } = watermarkOffset(position, size, overlay, margin);
            let pipeline = decode(source.buffer)
                .composite([{ input: overlay.data, left, top }])
                .toFormat(source.format);

            if (keepMetadata) pipeline = pipeline.keepMetadata();

            const data = await pipeline.toBuffer();
            const { extension, mimeType } = IMAGE_FORMATS[source.format];

            return output(source, data, `${source.baseName}-watermarked.${extension}`, mimeType);
        });
    });
}

export async function inspectImage(formData: FormData): Promise<ActionResult> {
    return runFiles(
        'inspect',
        formData,
        FORMAT_KEYS,
        async batch =>
            eachFile(batch, async source => {
                const report = describeMetadata(
                    {
                        filename: source.name,
                        size: source.size,
                        format: IMAGE_FORMATS[source.format].label,
                    },
                    source.metadata
                );

                return output(
                    source,
                    Buffer.from(JSON.stringify(report), 'utf8'),
                    `${source.baseName}-metadata.json`,
                    METADATA_MIME_TYPE
                );
            }),
        1
    );
}

export async function stripImageMetadata(formData: FormData): Promise<ActionResult> {
    return runFiles('strip', formData, FORMAT_KEYS, async batch =>
        eachFile(batch, async source => {
            if (!hasStrippableMetadata(source.metadata)) {
                throw new ProcessingError('This file carries no metadata to remove.');
            }

            const data = await decode(source.buffer)
                .toFormat(source.format, { quality: STRIP_QUALITY[source.format] })
                .toBuffer();
            const { extension, mimeType } = IMAGE_FORMATS[source.format];

            return output(source, data, `${source.baseName}-clean.${extension}`, mimeType);
        })
    );
}
