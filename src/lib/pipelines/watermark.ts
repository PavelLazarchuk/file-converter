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

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function rotateOverlay(overlay: Overlay, angle: number): Promise<Overlay> {
    if (angle % 360 === 0) return overlay;

    const rotated = sharp(overlay.data).rotate(angle, { background: TRANSPARENT });
    const data = await rotated.png().toBuffer();
    const meta = await sharp(data).metadata();

    return { data, width: meta.width ?? overlay.width, height: meta.height ?? overlay.height };
}

async function clampToImage(overlay: Overlay, image: Size): Promise<Overlay> {
    if (overlay.width <= image.width && overlay.height <= image.height) return overlay;

    const factor = Math.min(image.width / overlay.width, image.height / overlay.height);
    const width = Math.max(1, Math.round(overlay.width * factor));
    const height = Math.max(1, Math.round(overlay.height * factor));
    const data = await sharp(overlay.data).resize(width, height, { fit: 'fill' }).png().toBuffer();

    return { data, width, height };
}

async function padForTile(overlay: Overlay, gap: number): Promise<Overlay> {
    if (gap <= 0) return overlay;

    const half = Math.round(gap / 2);
    const data = await sharp(overlay.data)
        .extend({ top: half, bottom: half, left: half, right: half, background: TRANSPARENT })
        .png()
        .toBuffer();

    return { data, width: overlay.width + half * 2, height: overlay.height + half * 2 };
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
    {
        logo,
        text,
        color,
        position,
        opacity,
        scale,
        margin,
        angle,
        layout,
        keepMetadata,
    }: WatermarkParams
): Promise<PipelineOutput> {
    const size = sourceSize(source.metadata);
    const cell = logo
        ? await logoOverlay(size, logo, { scale, opacity })
        : await textOverlay(size, { text, color, scale, opacity });
    const overlay = await rotateOverlay(cell, angle);

    let pipeline = decode(source.buffer);

    if (layout === 'tile') {
        const tile = await clampToImage(await padForTile(overlay, margin), size);

        pipeline = pipeline.composite([{ input: tile.data, tile: true }]);
    } else {
        const clamped = await clampToImage(overlay, size);
        const { left, top } = watermarkOffset(position, size, clamped, margin);

        pipeline = pipeline.composite([{ input: clamped.data, left, top }]);
    }

    pipeline = pipeline.toFormat(source.format);

    if (keepMetadata) pipeline = pipeline.keepMetadata();

    const data = await pipeline.toBuffer();
    const { extension, mimeType } = IMAGE_FORMATS[source.format];

    return { data, filename: `${source.baseName}-watermarked.${extension}`, mimeType };
}
