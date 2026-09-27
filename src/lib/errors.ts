import { parseFieldMessage, type FieldMessage } from './form-messages';
import type { ConvertSource } from './image';

export type ActionErrorDetail =
    | { code: 'no_file' }
    | { code: 'too_many_files' }
    | { code: 'file_too_large' }
    | { code: 'batch_too_large'; totalBytes: number }
    | { code: 'unreadable_image'; formats: readonly ConvertSource[] }
    | {
          code: 'unsupported_format';
          formats: readonly ConvertSource[];
          detected: ConvertSource | null;
      }
    | { code: 'unreadable_dimensions' }
    | { code: 'pixel_limit' }
    | { code: 'unsafe_svg'; threat: 'entity' | 'external_reference' }
    | { code: 'unreadable_pdf' }
    | { code: 'encrypted_pdf' }
    | { code: 'too_many_pages'; pages: number }
    | { code: 'one_pdf_only' }
    | { code: 'single_pdf_only' }
    | { code: 'page_out_of_range'; pages: number }
    | { code: 'no_pages_selected' }
    | { code: 'no_pages_left' }
    | { code: 'too_many_parts'; parts: number }
    | { code: 'rate_limited'; retryAfterSeconds: number; limit: number }
    | { code: 'invalid_settings'; field?: FieldMessage }
    | { code: 'same_format' }
    | { code: 'nothing_to_do' }
    | { code: 'compress_failed' }
    | { code: 'no_metadata' }
    | { code: 'unsupported_text' }
    | { code: 'logo_missing' }
    | { code: 'logo_too_large' }
    | { code: 'engine_failed' }
    | { code: 'transport_failed' }
    | { code: 'unknown' };

export type ActionErrorCode = ActionErrorDetail['code'];

export type ActionWarningDetail =
    | { code: 'target_missed'; targetBytes: number; smallestBytes: number }
    | { code: 'animation_lost'; frames: number }
    | { code: 'pdf_not_smaller' }
    | { code: 'page_downscaled'; requested: number; dpi: number };

export type ActionWarningCode = ActionWarningDetail['code'];

export class ProcessingError extends Error {
    constructor(readonly detail: ActionErrorDetail) {
        super(detail.code);
        this.name = 'ProcessingError';
    }

    get code(): ActionErrorCode {
        return this.detail.code;
    }
}

export function fail(detail: ActionErrorDetail): ProcessingError {
    return new ProcessingError(detail);
}

type IssueList = { issues: readonly { message: string }[] };

export function invalid(error: IssueList): ProcessingError {
    const field = parseFieldMessage(error.issues[0]?.message);

    return fail({ code: 'invalid_settings', ...(field ? { field } : {}) });
}
