import type { Metadata, Sharp } from 'sharp';
import sharp from 'sharp';

import { IMAGE_FORMATS, QUALITY_LIMITS, formatFileSize, type ImageFormat } from '../image';
import { Logger } from '../logger';
import type { CompressValues } from '../schemas';
import { decode, fail, type PipelineOutput, type SourceImage } from './core';

const RAW_REUSE_MAX_PIXELS = 24_000_000;
const MAX_QUALITY_STEPS = 7;
const CLOSE_ENOUGH_RATIO = 0.94;

export type CompressParams = CompressValues;

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
): Promise<PipelineOutput> {
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

    if (best) return { data: best, filename, mimeType };

    if (!smallest) throw fail({ code: 'compress_failed' });

    Logger.info('compress.target_missed', {
        tool: 'compress',
        format: source.format,
        bytes: source.size,
        width: source.metadata.width,
        height: source.metadata.height,
        targetBytes,
        smallestBytes: smallest.length,
    });

    return {
        data: smallest,
        filename,
        mimeType,
        warning:
            `Couldn't reach ${formatFileSize(targetBytes)} at these dimensions — the smallest ` +
            `this image compresses to is ${formatFileSize(smallest.length)}. Resize it first for anything smaller.`,
    };
}

export async function compressPipeline(
    source: SourceImage<ImageFormat>,
    { mode, quality, targetKb }: CompressParams
): Promise<PipelineOutput> {
    const { extension, mimeType } = IMAGE_FORMATS[source.format];
    const filename = `${source.baseName}-compressed.${extension}`;

    if (mode === 'size') return compressToTarget(source, targetKb, filename);

    const data = await applyQuality(decode(source.buffer), source.format, quality).toBuffer();

    return { data, filename, mimeType };
}
