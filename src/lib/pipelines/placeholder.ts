import sharp from 'sharp';

import {
    IMAGE_FORMATS,
    MAX_INPUT_PIXELS,
    SVG_FONT_STACK,
    escapeXml,
    placeholderFontSize,
    placeholderLabel,
} from '../image';
import type { PlaceholderValues } from '../schemas';
import type { PipelineOutput } from './core';

export async function placeholderPipeline({
    width,
    height,
    bgColor,
    textColor,
    text,
    format,
}: PlaceholderValues): Promise<PipelineOutput> {
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

    return { data, filename: `placeholder-${width}x${height}.${extension}`, mimeType };
}
