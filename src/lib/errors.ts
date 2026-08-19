import type { FieldMessage } from './form-messages';
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
    | { code: 'rate_limited'; retryAfterSeconds: number; limit: number }
    | { code: 'invalid_settings'; field?: FieldMessage }
    | { code: 'same_format' }
    | { code: 'nothing_to_do' }
    | { code: 'compress_failed' }
    | { code: 'no_metadata' }
    | { code: 'logo_missing' }
    | { code: 'logo_too_large' }
    | { code: 'transport_failed' }
    | { code: 'unknown' };

export type ActionErrorCode = ActionErrorDetail['code'];

export type ActionWarningDetail = {
    code: 'target_missed';
    targetBytes: number;
    smallestBytes: number;
};

export type ActionWarningCode = ActionWarningDetail['code'];
