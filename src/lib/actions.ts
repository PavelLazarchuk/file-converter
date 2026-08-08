'use server';

import sharp, { type Metadata, type Sharp } from 'sharp';
import { PDFDocument } from 'pdf-lib';

import {
    CONVERT_SOURCE_KEYS,
    DEFAULT_ICO_SIZES,
    DEFAULT_QUALITY,
    DEFAULT_TARGET_KB,
    FAVICON_PACK,
    FORMAT_KEYS,
    IMAGE_FORMATS,
    MAX_FILE_SIZE,
    MAX_FILE_SIZE_LABEL,
    MAX_INPUT_PIXELS,
    PDF_PAGE_DIMENSIONS,
    PDF_PAGE_MARGIN,
    QUALITY_LIMITS,
    ZIP_MIME_TYPE,
    acceptedFormatsLabel,
    circleOutputFormat,
    clampCropBox,
    convertSourceFromSharpFormat,
    fitPads,
    formatFileSize,
    placeholderFontSize,
    placeholderLabel,
    stripExtension,
    type ConvertSource,
    type ImageFormat,
} from './image';
import { encodeIco } from './ico';
import { createZip, type ZipEntry } from './zip';
import {
    compressSchema,
    convertSchema,
    cropSchema,
    icoOptionsSchema,
    imageToPdfSchema,
    placeholderSchema,
    resizeSchema,
} from './schemas';

export type ActionResult =
    | {
          success: true;
          data: Uint8Array;
          filename: string;
          mimeType: string;
          warning?: string;
      }
    | { success: false; error: string };

class ProcessingError extends Error {}

function decode(buffer: Buffer) {
    return sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).autoOrient();
}

type SourceImage<Format extends ConvertSource> = {
    buffer: Buffer;
    format: Format;
    baseName: string;
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

async function readImageFile<Format extends ConvertSource>(
    formData: FormData,
    formats: readonly Format[]
): Promise<SourceImage<Format>> {
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
        throw new ProcessingError('No file provided.');
    }
    if (file.size > MAX_FILE_SIZE) {
        throw new ProcessingError(`File is too large. The maximum size is ${MAX_FILE_SIZE_LABEL}.`);
    }

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

    const baseName = stripExtension(file.name) || 'image';

    return { buffer, format, baseName, metadata };
}

function flag(formData: FormData, name: string): boolean {
    return formData.get(name) === 'true';
}

function keepMetadataRequested(formData: FormData): boolean {
    return flag(formData, 'keepMetadata');
}

function success(data: Buffer, filename: string, mimeType: string, warning?: string): ActionResult {
    return { success: true, data: new Uint8Array(data), filename, mimeType, warning };
}

async function run(process: () => Promise<ActionResult>): Promise<ActionResult> {
    try {
        return await process();
    } catch (error) {
        if (error instanceof ProcessingError) {
            return { success: false, error: error.message };
        }
        if (error instanceof Error && error.message.includes('pixel limit')) {
            return { success: false, error: 'Image dimensions are too large to process.' };
        }

        console.error('Image processing failed:', error);

        return { success: false, error: 'Something went wrong while processing the image.' };
    }
}

export async function resizeImage(formData: FormData): Promise<ActionResult> {
    return run(async () => {
        const { buffer, format, baseName } = await readImageFile(formData, FORMAT_KEYS);
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
        const background =
            format === 'jpeg' ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0, alpha: 0 };
        let pipeline = decode(buffer);

        if (rotate !== '0') pipeline = pipeline.rotate(Number(rotate));

        pipeline = pipeline
            .resize(width, height, {
                fit,
                withoutEnlargement: flag(formData, 'noEnlarge'),
                ...(fitPads(fit) && { background }),
            })
            .toFormat(format);

        if (keepMetadataRequested(formData)) pipeline = pipeline.keepMetadata();

        const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
        const { extension, mimeType } = IMAGE_FORMATS[format];

        return success(data, `${baseName}-${info.width}x${info.height}.${extension}`, mimeType);
    });
}

export async function cropImage(formData: FormData): Promise<ActionResult> {
    return run(async () => {
        const { buffer, format, baseName, metadata } = await readImageFile(formData, FORMAT_KEYS);
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

        const swapped = (metadata.orientation ?? 1) >= 5;
        const srcWidth = (swapped ? metadata.height : metadata.width) ?? 0;
        const srcHeight = (swapped ? metadata.width : metadata.height) ?? 0;

        if (!srcWidth || !srcHeight) {
            throw new ProcessingError('Could not read the image dimensions.');
        }

        const box = clampCropBox(parsed.data, srcWidth, srcHeight);
        const circle = parsed.data.shape === 'circle';
        const outFormat = circle ? circleOutputFormat(format) : format;
        let pipeline = decode(buffer).extract(box);

        if (circle) {
            const mask = Buffer.from(
                `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}">
                    <ellipse cx="${box.width / 2}" cy="${box.height / 2}" rx="${box.width / 2}" ry="${box.height / 2}" fill="#fff"/>
                </svg>`
            );

            pipeline = pipeline.ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]);
        }

        pipeline = pipeline.toFormat(outFormat);

        if (keepMetadataRequested(formData)) pipeline = pipeline.keepMetadata();

        const data = await pipeline.toBuffer();
        const { extension, mimeType } = IMAGE_FORMATS[outFormat];
        const ratioLabel = parsed.data.ratio.replace(':', 'x');
        const shapeLabel = circle ? '-circle' : '';

        return success(data, `${baseName}-${ratioLabel}${shapeLabel}.${extension}`, mimeType);
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

export async function compressImage(formData: FormData): Promise<ActionResult> {
    return run(async () => {
        const { buffer, format, baseName, metadata } = await readImageFile(formData, FORMAT_KEYS);
        const parsed = compressSchema.safeParse({
            mode: formData.get('mode') || 'quality',
            quality: formData.get('quality') || String(DEFAULT_QUALITY),
            targetKb: formData.get('targetKb') || String(DEFAULT_TARGET_KB),
        });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid settings.');
        }
        const { mode, quality, targetKb } = parsed.data;
        const { extension, mimeType } = IMAGE_FORMATS[format];
        const filename = `${baseName}-compressed.${extension}`;

        if (mode === 'quality') {
            const data = await applyQuality(decode(buffer), format, quality).toBuffer();

            return success(data, filename, mimeType);
        }

        const targetBytes = targetKb * 1024;
        const nextPipeline = await createDecoder(buffer, metadata);
        let low = QUALITY_LIMITS.min;
        let high = QUALITY_LIMITS.max;
        let best: Buffer | null = null;
        let smallest: Buffer | null = null;

        for (let step = 0; step < MAX_QUALITY_STEPS && low <= high; step += 1) {
            const candidateQuality = Math.floor((low + high) / 2);
            const candidate = await applyQuality(
                nextPipeline(),
                format,
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

        if (!best) {
            if (!smallest) throw new ProcessingError('Could not compress this image.');

            return success(
                smallest,
                filename,
                mimeType,
                `Couldn't reach ${formatFileSize(targetBytes)} at these dimensions — the smallest ` +
                    `this image compresses to is ${formatFileSize(smallest.length)}. Resize it first for anything smaller.`
            );
        }

        return success(best, filename, mimeType);
    });
}

const BASE64_STRIP_QUALITY: Record<ImageFormat, number> = {
    jpeg: 95,
    webp: 95,
    avif: 80,
    png: 100,
};

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

    return decode(buffer).toFormat(source, { quality: BASE64_STRIP_QUALITY[source] }).toBuffer();
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
    return run(async () => {
        const {
            buffer,
            format: source,
            baseName,
            metadata,
        } = await readImageFile(formData, CONVERT_SOURCE_KEYS);
        const parsed = convertSchema.safeParse({ format: formData.get('format') });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid target format.');
        }

        const target = parsed.data.format;

        if (target === source) {
            throw new ProcessingError('Target format must differ from the source format.');
        }

        if (target === 'base64') {
            const bytes = await base64Bytes(
                buffer,
                source,
                metadata,
                keepMetadataRequested(formData)
            );
            const dataUri = `data:${IMAGE_FORMATS[source].mimeType};base64,${bytes.toString('base64')}`;
            const { extension, mimeType } = IMAGE_FORMATS.base64;

            return success(
                Buffer.from(dataUri, 'utf8'),
                `${baseName}-base64.${extension}`,
                mimeType
            );
        }

        if (target === 'svg') {
            let pipeline = decode(buffer).png();

            if (keepMetadataRequested(formData)) pipeline = pipeline.keepMetadata();

            const { data: png, info } = await pipeline.toBuffer({ resolveWithObject: true });
            const svg =
                `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
                `width="${info.width}" height="${info.height}" viewBox="0 0 ${info.width} ${info.height}">` +
                `<image width="${info.width}" height="${info.height}" ` +
                `xlink:href="data:image/png;base64,${png.toString('base64')}"/>` +
                `</svg>`;
            const { extension, mimeType } = IMAGE_FORMATS.svg;

            return success(Buffer.from(svg, 'utf8'), `${baseName}.${extension}`, mimeType);
        }

        if (target === 'ico') {
            const options = icoOptionsSchema.safeParse({
                sizes: formData.get('icoSizes') || DEFAULT_ICO_SIZES.join(','),
                pack: formData.get('icoPack') || 'false',
            });

            if (!options.success) {
                throw new ProcessingError(
                    options.error.issues[0]?.message ?? 'Invalid favicon settings.'
                );
            }

            if (options.data.pack === 'false') {
                const icon = await buildIco(buffer, options.data.sizes);
                const { extension, mimeType } = IMAGE_FORMATS.ico;

                return success(icon, `${baseName}.${extension}`, mimeType);
            }

            const [icon, assets] = await Promise.all([
                buildIco(buffer, options.data.sizes),
                buildFaviconPackAssets(buffer, baseName),
            ]);

            return success(
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

        if (keepMetadataRequested(formData)) pipeline = pipeline.keepMetadata();

        const data = await pipeline.toBuffer();
        const { extension, mimeType } = IMAGE_FORMATS[target];

        return success(data, `${baseName}.${extension}`, mimeType);
    });
}

export async function imageToPdf(formData: FormData): Promise<ActionResult> {
    return run(async () => {
        const {
            buffer,
            format: source,
            baseName,
        } = await readImageFile(formData, CONVERT_SOURCE_KEYS);
        const parsed = imageToPdfSchema.safeParse({ pageSize: formData.get('pageSize') });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid page size.');
        }

        const { pageSize } = parsed.data;
        const isJpeg = source === 'jpeg';
        const imageBytes = await decode(buffer)
            .toFormat(isJpeg ? 'jpeg' : 'png', isJpeg ? { quality: 90 } : undefined)
            .toBuffer();

        const pdfDoc = await PDFDocument.create();
        const embedded = isJpeg
            ? await pdfDoc.embedJpg(imageBytes)
            : await pdfDoc.embedPng(imageBytes);
        const { width: imgWidth, height: imgHeight } = embedded;

        if (pageSize === 'fit') {
            const page = pdfDoc.addPage([imgWidth, imgHeight]);

            page.drawImage(embedded, { x: 0, y: 0, width: imgWidth, height: imgHeight });
        } else {
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

        const data = await pdfDoc.save();

        return success(Buffer.from(data), `${baseName}.pdf`, 'application/pdf');
    });
}

function escapeXml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

export async function generatePlaceholder(formData: FormData): Promise<ActionResult> {
    return run(async () => {
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
            `<text x="50%" y="50%" fill="${textColor}" font-family="Helvetica, Arial, sans-serif" ` +
            `font-size="${fontSize}" font-weight="500" text-anchor="middle" ` +
            `dominant-baseline="central">${escapeXml(label)}</text>` +
            `</svg>`;

        const data = await sharp(Buffer.from(svg), { limitInputPixels: MAX_INPUT_PIXELS })
            .toFormat(format)
            .toBuffer();

        const { extension, mimeType } = IMAGE_FORMATS[format];

        return success(data, `placeholder-${width}x${height}.${extension}`, mimeType);
    });
}
