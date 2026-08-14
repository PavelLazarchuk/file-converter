import sharp, { type Metadata } from 'sharp';

import { actionErrorMessage, type ActionErrorCode, type ActionErrorDetail } from '../errors';
import { MAX_INPUT_PIXELS, type ConvertSource, type Size } from '../image';

export class ProcessingError extends Error {
    constructor(
        readonly code: ActionErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'ProcessingError';
    }
}

export function fail(detail: ActionErrorDetail): ProcessingError {
    return new ProcessingError(detail.code, actionErrorMessage(detail));
}

type IssueList = { issues: readonly { message: string }[] };

export function invalid(error: IssueList, fallback: string): ProcessingError {
    return fail({ code: 'invalid_settings', detail: error.issues[0]?.message ?? fallback });
}

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
    warning?: string;
};

export function decode(buffer: Buffer) {
    return sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).autoOrient();
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
