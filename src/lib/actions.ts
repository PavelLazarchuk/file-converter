'use server';

import sharp, { type Sharp } from 'sharp';

import {
    CONVERT_SOURCE_KEYS,
    DEFAULT_QUALITY,
    DEFAULT_TARGET_KB,
    FORMAT_KEYS,
    ICO_SIZES,
    IMAGE_FORMATS,
    MAX_FILE_SIZE,
    MAX_FILE_SIZE_LABEL,
    MAX_INPUT_PIXELS,
    QUALITY_LIMITS,
    acceptedFormatsLabel,
    circleOutputFormat,
    clampCropBox,
    formatFileSize,
    placeholderFontSize,
    placeholderLabel,
    type ConvertSource,
    type ImageFormat,
} from './image';
import { encodeIco } from './ico';
import {
    compressSchema,
    convertSchema,
    cropSchema,
    placeholderSchema,
    resizeSchema,
} from './schemas';

export type ActionResult =
    | { success: true; data: Uint8Array; filename: string; mimeType: string }
    | { success: false; error: string };

class ProcessingError extends Error {}

function decode(buffer: Buffer) {
    return sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).autoOrient();
}

type SourceImage<Format extends ConvertSource> = {
    buffer: Buffer;
    format: Format;
    baseName: string;
};

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

    const format = formats.find(key => IMAGE_FORMATS[key].mimeType === file.type);

    if (!format) {
        throw new ProcessingError(`Unsupported file type. Use ${acceptedFormatsLabel(formats)}.`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';

    return { buffer, format, baseName };
}

function keepMetadataRequested(formData: FormData): boolean {
    return formData.get('keepMetadata') === 'true';
}

function success(data: Buffer, filename: string, mimeType: string): ActionResult {
    return { success: true, data: new Uint8Array(data), filename, mimeType };
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
        });

        if (!parsed.success) {
            throw new ProcessingError(parsed.error.issues[0]?.message ?? 'Invalid dimensions.');
        }

        const { width, height, rotate } = parsed.data;
        const background =
            format === 'jpeg' ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0, alpha: 0 };
        let pipeline = decode(buffer);

        if (rotate !== '0') pipeline = pipeline.rotate(Number(rotate));

        pipeline = pipeline.resize(width, height, { fit: 'contain', background }).toFormat(format);

        if (keepMetadataRequested(formData)) pipeline = pipeline.keepMetadata();

        const data = await pipeline.toBuffer();
        const { extension, mimeType } = IMAGE_FORMATS[format];

        return success(data, `${baseName}-${width}x${height}.${extension}`, mimeType);
    });
}

export async function cropImage(formData: FormData): Promise<ActionResult> {
    return run(async () => {
        const { buffer, format, baseName } = await readImageFile(formData, FORMAT_KEYS);
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

        const metadata = await decode(buffer).metadata();
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

export async function compressImage(formData: FormData): Promise<ActionResult> {
    return run(async () => {
        const { buffer, format, baseName } = await readImageFile(formData, FORMAT_KEYS);
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
        let low = QUALITY_LIMITS.min;
        let high = QUALITY_LIMITS.max;
        let best: Buffer | null = null;
        let smallest = Number.POSITIVE_INFINITY;

        while (low <= high) {
            const candidateQuality = Math.floor((low + high) / 2);
            const candidate = await applyQuality(
                decode(buffer),
                format,
                candidateQuality
            ).toBuffer();

            if (candidate.length <= targetBytes) {
                best = candidate;
                low = candidateQuality + 1;
            } else {
                smallest = Math.min(smallest, candidate.length);
                high = candidateQuality - 1;
            }
        }

        if (!best) {
            throw new ProcessingError(
                `Could not reach ${formatFileSize(targetBytes)} at the current dimensions — the smallest ` +
                    `this image compresses to is about ${formatFileSize(smallest)}. Resize it first, then compress.`
            );
        }

        return success(best, filename, mimeType);
    });
}

export async function convertImage(formData: FormData): Promise<ActionResult> {
    return run(async () => {
        const {
            buffer,
            format: source,
            baseName,
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
            const dataUri = `data:${IMAGE_FORMATS[source].mimeType};base64,${buffer.toString('base64')}`;
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
            const oriented = decode(buffer);
            const pngs = await Promise.all(
                ICO_SIZES.map(size =>
                    oriented
                        .clone()
                        .resize(size, size, {
                            fit: 'contain',
                            background: { r: 0, g: 0, b: 0, alpha: 0 },
                        })
                        .png()
                        .toBuffer()
                )
            );
            const data = encodeIco(ICO_SIZES.map((size, index) => ({ size, data: pngs[index] })));
            const { extension, mimeType } = IMAGE_FORMATS.ico;

            return success(data, `${baseName}.${extension}`, mimeType);
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
