import sharp, { type Sharp } from 'sharp';

import {
    IMAGE_FORMATS,
    MAX_INPUT_PIXELS,
    watermarkLogoLayout,
    watermarkOffset,
    watermarkSvg,
    watermarkTextLayout,
    type ImageFormat,
    type Size,
} from '../image';
import type { WatermarkValues } from '../schemas';
import { decode, sourceSize, type PipelineOutput, type SourceImage } from './core';

export type WatermarkLogo = { buffer: Buffer; size: Size };

export type WatermarkParams = WatermarkValues & {
    logo: WatermarkLogo | null;
    keepMetadata: boolean;
};

type Overlay = Size & { data: Buffer };

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
    logo: WatermarkLogo,
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

export async function watermarkPipeline(
    source: SourceImage<ImageFormat>,
    { logo, text, color, position, opacity, scale, margin, keepMetadata }: WatermarkParams
): Promise<PipelineOutput> {
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

    return { data, filename: `${source.baseName}-watermarked.${extension}`, mimeType };
}
