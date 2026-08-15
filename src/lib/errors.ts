import {
    MAX_BATCH_FILES,
    MAX_BATCH_SIZE_LABEL,
    MAX_FILE_SIZE_LABEL,
    MAX_PDF_PAGES,
    formatFileSize,
} from './image';

export type ActionErrorDetail =
    | { code: 'no_file' }
    | { code: 'too_many_files' }
    | { code: 'file_too_large' }
    | { code: 'batch_too_large'; totalBytes: number }
    | { code: 'unreadable_image'; formats: string }
    | { code: 'unsupported_format'; formats: string; detected: string | null }
    | { code: 'unreadable_dimensions' }
    | { code: 'pixel_limit' }
    | { code: 'unsafe_svg'; threat: 'entity' | 'external_reference' }
    | { code: 'unreadable_pdf' }
    | { code: 'encrypted_pdf' }
    | { code: 'too_many_pages'; pages: number }
    | { code: 'one_pdf_only' }
    | { code: 'rate_limited'; retryAfterSeconds: number; limit: number }
    | { code: 'invalid_settings'; detail?: string }
    | { code: 'same_format' }
    | { code: 'nothing_to_do' }
    | { code: 'compress_failed' }
    | { code: 'no_metadata' }
    | { code: 'logo_missing' }
    | { code: 'logo_too_large' }
    | { code: 'transport_failed' }
    | { code: 'unknown' };

export type ActionErrorCode = ActionErrorDetail['code'];

export function actionErrorMessage(detail: ActionErrorDetail): string {
    switch (detail.code) {
        case 'no_file':
            return 'No file provided.';
        case 'too_many_files':
            return `Too many files — this tool takes up to ${MAX_BATCH_FILES} images at a time.`;
        case 'file_too_large':
            return `File is too large. The maximum size is ${MAX_FILE_SIZE_LABEL}.`;
        case 'batch_too_large':
            return `These files add up to ${formatFileSize(detail.totalBytes)}. Keep a batch under ${MAX_BATCH_SIZE_LABEL} in total.`;
        case 'unreadable_image':
            return `This file isn't a readable image — its contents don't match any supported format. Use ${detail.formats}.`;
        case 'unsupported_format':
            return `${detail.detected ? `${detail.detected} files are` : 'This format is'} not supported by this tool. Use ${detail.formats}.`;
        case 'unreadable_dimensions':
            return 'Could not read the image dimensions.';
        case 'pixel_limit':
            return 'Image dimensions are too large to process.';
        case 'unsafe_svg':
            return detail.threat === 'entity'
                ? 'This SVG declares XML entities, which can expand without bound while rendering. Re-save it without a DOCTYPE block.'
                : 'This SVG pulls in an external file — an image, stylesheet or font. Embed it in the SVG itself and try again.';
        case 'unreadable_pdf':
            return "This file isn't a readable PDF — its contents don't match the format.";
        case 'encrypted_pdf':
            return 'This PDF is password-protected. Remove the password and try again.';
        case 'too_many_pages':
            return `These files add up to ${detail.pages} pages. A merged PDF can hold up to ${MAX_PDF_PAGES}.`;
        case 'one_pdf_only':
            return 'Add a second PDF — merging needs at least two files.';
        case 'rate_limited':
            return `Too many requests — this tool allows ${detail.limit} images per minute. Try again in ${detail.retryAfterSeconds}s.`;
        case 'invalid_settings':
            return detail.detail ?? 'Invalid settings.';
        case 'same_format':
            return 'Target format must differ from the source format.';
        case 'nothing_to_do':
            return 'Nothing to do — pick an angle or a flip.';
        case 'compress_failed':
            return 'Could not compress this image.';
        case 'no_metadata':
            return 'This file carries no metadata to remove.';
        case 'logo_missing':
            return 'Upload the image to use as the watermark.';
        case 'logo_too_large':
            return `The images and the watermark image add up to more than ${MAX_BATCH_SIZE_LABEL}. Use a smaller watermark, or fewer images.`;
        case 'transport_failed':
            return 'The request could not be sent. Check your connection and try again.';
        case 'unknown':
            return 'Something went wrong while processing the image.';
    }
}
