import sharp, { type Metadata } from 'sharp';

import { fail, type ActionWarningDetail } from '../errors';
import { MAX_INPUT_PIXELS, frameCount, isAnimated, type ConvertSource, type Size } from '../image';

export { ProcessingError, fail, invalid } from '../errors';

export type SourceImage<Format extends ConvertSource = ConvertSource> = {
    buffer: Buffer;
    format: Format;
    name: string;
    baseName: string;
    size: number;
    metadata: Metadata;
};

export type PipelineOutput = {
    data: Buffer | Uint8Array;
    filename: string;
    mimeType: string;
    warning?: ActionWarningDetail;
};

export function decode(buffer: Buffer, { animated = false } = {}) {
    return sharp(buffer, {
        limitInputPixels: MAX_INPUT_PIXELS,
        ...(animated ? { animated: true } : {}),
    }).autoOrient();
}

export function lostAnimation(source: SourceImage): { warning: ActionWarningDetail } | undefined {
    if (!isAnimated(source.metadata)) return undefined;

    return { warning: { code: 'animation_lost', frames: frameCount(source.metadata) } };
}

export function sourceSize(metadata: Metadata): Size {
    const swapped = (metadata.orientation ?? 1) >= 5;
    const width = (swapped ? metadata.height : metadata.width) ?? 0;
    const height = (swapped ? metadata.width : metadata.height) ?? 0;

    if (!width || !height) throw fail({ code: 'unreadable_dimensions' });

    return { width, height };
}

export function hasStrippableMetadata(metadata: Metadata): boolean {
    return Boolean(metadata.exif || metadata.icc || metadata.iptc || metadata.xmp);
}
