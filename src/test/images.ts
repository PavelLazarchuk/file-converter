import sharp from 'sharp';

import type { ConvertSource } from '@/lib/image';
import type { SourceImage } from '@/lib/pipelines/core';

export type FixtureOptions = {
    name?: string;
    width?: number;
    height?: number;
    noise?: boolean;
    exif?: boolean;
    alpha?: boolean;
};

function pixels({ width, height, noise, alpha }: Required<Omit<FixtureOptions, 'name' | 'exif'>>) {
    const channels = alpha ? 4 : 3;
    const data = Buffer.alloc(width * height * channels);

    for (let index = 0; index < width * height; index += 1) {
        const offset = index * channels;
        const jitter = noise ? (index * 2654435761) % 256 : 0;

        data[offset] = (200 + jitter) % 256;
        data[offset + 1] = (40 + jitter * 3) % 256;
        data[offset + 2] = (90 + jitter * 7) % 256;

        if (alpha) data[offset + 3] = 255;
    }

    return { data, channels };
}

export async function imageBuffer(
    format: 'jpeg' | 'png' | 'webp' | 'gif',
    options: FixtureOptions = {}
): Promise<Buffer> {
    const { width = 40, height = 30, noise = false, alpha = false, exif = false } = options;
    const { data, channels } = pixels({ width, height, noise, alpha });
    let pipeline = sharp(data, { raw: { width, height, channels: channels as 3 | 4 } });

    if (exif) pipeline = pipeline.withExif({ IFD0: { Copyright: 'test-suite' } });

    return pipeline.toFormat(format).toBuffer();
}

export async function sourceImage<Format extends ConvertSource>(
    format: Format & ('jpeg' | 'png' | 'webp' | 'gif'),
    options: FixtureOptions = {}
): Promise<SourceImage<Format>> {
    const buffer = await imageBuffer(format, options);
    const metadata = await sharp(buffer).metadata();
    const name = options.name ?? `photo.${format === 'jpeg' ? 'jpg' : format}`;

    return {
        buffer,
        format,
        name,
        baseName: name.replace(/\.[^.]+$/, ''),
        size: buffer.length,
        metadata,
    };
}

export function describeOutput(data: Buffer | Uint8Array) {
    return sharp(Buffer.from(data)).metadata();
}
