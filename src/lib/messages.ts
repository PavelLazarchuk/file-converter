import type { ActionErrorDetail, ActionWarningDetail } from './errors';
import type { FieldMessage } from './form-messages';
import {
    MAX_BATCH_FILES,
    MAX_BATCH_SIZE_LABEL,
    MAX_FILE_SIZE_LABEL,
    MAX_PDF_PAGES,
    formatFileSize,
    type ConvertSource,
} from './image';

export type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

export function looseTranslator(t: unknown): Translator {
    return t as Translator;
}

export function formatList(labels: readonly string[], locale: string): string {
    return new Intl.ListFormat(locale, { style: 'long', type: 'disjunction' }).format(labels);
}

export function formatsLabel(
    formats: readonly ConvertSource[],
    t: Translator,
    locale: string
): string {
    return formatList(
        formats.map(format => t(`formats.${format}`)),
        locale
    );
}

export type MessageContext = {
    errors: Translator;
    labels: Translator;
    form: Translator;
    warnings: Translator;
    locale: string;
};

export function fieldMessageText(field: FieldMessage, form: Translator): string {
    switch (field.k) {
        case 'required':
        case 'integer':
        case 'hex':
            return form(field.k, { label: form(`labels.${field.label}`) });
        case 'range':
            return form('range', {
                label: form(`labels.${field.label}`),
                min: field.min,
                max: field.max,
            });
        case 'maxLength':
            return form('maxLength', { max: field.max });
        case 'outputSizeRange':
            return form('outputSizeRange', { min: field.min, max: field.max });
        case 'icoSizesInvalid':
            return form('icoSizesInvalid', { sizes: field.sizes });
        default:
            return form(field.k);
    }
}

export function actionErrorText(detail: ActionErrorDetail, context: MessageContext): string {
    const { errors, labels, form, locale } = context;

    switch (detail.code) {
        case 'too_many_files':
            return errors('too_many_files', { max: MAX_BATCH_FILES });
        case 'file_too_large':
            return errors('file_too_large', { max: MAX_FILE_SIZE_LABEL });
        case 'batch_too_large':
            return errors('batch_too_large', {
                total: formatFileSize(detail.totalBytes, locale),
                max: MAX_BATCH_SIZE_LABEL,
            });
        case 'unreadable_image':
            return errors('unreadable_image', {
                formats: formatsLabel(detail.formats, labels, locale),
            });
        case 'unsupported_format':
            return errors('unsupported_format', {
                known: detail.detected ? 'yes' : 'no',
                detected: detail.detected ? labels(`formats.${detail.detected}`) : '',
                formats: formatsLabel(detail.formats, labels, locale),
            });
        case 'unsafe_svg':
            return errors('unsafe_svg', { threat: detail.threat });
        case 'too_many_pages':
            return errors('too_many_pages', { pages: detail.pages, max: MAX_PDF_PAGES });
        case 'rate_limited':
            return errors('rate_limited', {
                limit: detail.limit,
                seconds: detail.retryAfterSeconds,
            });
        case 'logo_too_large':
            return errors('logo_too_large', { max: MAX_BATCH_SIZE_LABEL });
        case 'invalid_settings':
            return detail.field ? fieldMessageText(detail.field, form) : errors('invalid_settings');
        default:
            return errors(detail.code);
    }
}

export function actionWarningText(detail: ActionWarningDetail, context: MessageContext): string {
    const { warnings, locale } = context;

    return warnings(detail.code, {
        target: formatFileSize(detail.targetBytes, locale),
        smallest: formatFileSize(detail.smallestBytes, locale),
    });
}
