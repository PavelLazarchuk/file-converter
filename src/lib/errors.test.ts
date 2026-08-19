import { describe, expect, it } from 'vitest';

import { errorText, warningText } from '@/test/messages';
import type {
    ActionErrorCode,
    ActionErrorDetail,
    ActionWarningCode,
    ActionWarningDetail,
} from './errors';
import { MAX_BATCH_FILES, formatFileSize } from './image';

const SAMPLES: { [Code in ActionErrorCode]: Extract<ActionErrorDetail, { code: Code }> } = {
    no_file: { code: 'no_file' },
    too_many_files: { code: 'too_many_files' },
    file_too_large: { code: 'file_too_large' },
    batch_too_large: { code: 'batch_too_large', totalBytes: 34_000_000 },
    unreadable_image: { code: 'unreadable_image', formats: ['jpeg', 'png', 'webp'] },
    unsupported_format: {
        code: 'unsupported_format',
        formats: ['jpeg', 'png', 'webp'],
        detected: 'gif',
    },
    unreadable_dimensions: { code: 'unreadable_dimensions' },
    pixel_limit: { code: 'pixel_limit' },
    unsafe_svg: { code: 'unsafe_svg', threat: 'entity' },
    unreadable_pdf: { code: 'unreadable_pdf' },
    encrypted_pdf: { code: 'encrypted_pdf' },
    too_many_pages: { code: 'too_many_pages', pages: 812 },
    one_pdf_only: { code: 'one_pdf_only' },
    rate_limited: { code: 'rate_limited', retryAfterSeconds: 12, limit: 40 },
    invalid_settings: { code: 'invalid_settings' },
    same_format: { code: 'same_format' },
    nothing_to_do: { code: 'nothing_to_do' },
    compress_failed: { code: 'compress_failed' },
    no_metadata: { code: 'no_metadata' },
    logo_missing: { code: 'logo_missing' },
    logo_too_large: { code: 'logo_too_large' },
    transport_failed: { code: 'transport_failed' },
    unknown: { code: 'unknown' },
};

const WARNINGS: { [Code in ActionWarningCode]: Extract<ActionWarningDetail, { code: Code }> } = {
    target_missed: { code: 'target_missed', targetBytes: 500_000, smallestBytes: 900_000 },
};

const codes = Object.keys(SAMPLES) as ActionErrorCode[];

describe('the error catalog', () => {
    it.each(codes)('renders a sentence for %s', code => {
        const message = errorText(SAMPLES[code]);

        expect(message.length).toBeGreaterThan(0);
        expect(message).toMatch(/[.!?]$/);
        expect(message).not.toContain('undefined');
    });

    it('never renders the same sentence for two codes', () => {
        const messages = codes.map(code => errorText(SAMPLES[code]));

        expect(new Set(messages).size).toBe(messages.length);
    });

    it('interpolates the numbers the caller passes', () => {
        expect(errorText(SAMPLES.batch_too_large)).toContain(
            formatFileSize(SAMPLES.batch_too_large.totalBytes)
        );
        expect(errorText(SAMPLES.rate_limited)).toContain('12s');
        expect(errorText(SAMPLES.rate_limited)).toContain('40 images');
        expect(errorText(SAMPLES.too_many_files)).toContain(String(MAX_BATCH_FILES));
    });

    it('renders the accepted formats as a localized list', () => {
        expect(errorText(SAMPLES.unreadable_image)).toContain('JPEG, PNG, or WEBP');
    });

    it('prefers the field message over the generic settings sentence', () => {
        expect(
            errorText({
                code: 'invalid_settings',
                field: { k: 'range', label: 'width', min: 1, max: 5 },
            })
        ).toBe('Width must be between 1 and 5');
        expect(errorText({ code: 'invalid_settings' })).toBe('Invalid settings.');
    });

    it('names the detected format when it recognised one', () => {
        expect(errorText(SAMPLES.unsupported_format)).toContain('GIF files are');
        expect(
            errorText({
                code: 'unsupported_format',
                formats: ['jpeg', 'png', 'webp'],
                detected: null,
            })
        ).toContain('This format is');
    });
});

describe('the warning catalog', () => {
    it('renders both sizes of a missed compression target', () => {
        const message = warningText(WARNINGS.target_missed);

        expect(message).toContain(formatFileSize(WARNINGS.target_missed.targetBytes));
        expect(message).toContain(formatFileSize(WARNINGS.target_missed.smallestBytes));
    });
});
