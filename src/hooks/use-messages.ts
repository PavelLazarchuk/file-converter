'use client';

import { useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { ActionErrorDetail, ActionWarningDetail } from '@/lib/errors';
import { parseFieldMessage } from '@/lib/form-messages';
import { formatFileSize, type ConvertSource } from '@/lib/image';
import {
    actionErrorText,
    actionWarningText,
    fieldMessageText,
    formatsLabel,
    looseTranslator,
    type MessageContext,
} from '@/lib/messages';

function useMessageContext(): MessageContext {
    return {
        errors: looseTranslator(useTranslations('Errors')),
        labels: looseTranslator(useTranslations('Labels')),
        form: looseTranslator(useTranslations('Form')),
        warnings: looseTranslator(useTranslations('Warnings')),
        locale: useLocale(),
    };
}

export function useActionMessage() {
    const context = useMessageContext();

    return useCallback(
        (detail: ActionErrorDetail) => actionErrorText(detail, context),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [context.locale]
    );
}

export function useWarningMessage() {
    const context = useMessageContext();

    return useCallback(
        (detail: ActionWarningDetail) => actionWarningText(detail, context),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [context.locale]
    );
}

export function useFieldMessage() {
    const form = looseTranslator(useTranslations('Form'));

    return useCallback(
        (raw: string | undefined) => {
            const field = parseFieldMessage(raw);

            return field ? fieldMessageText(field, form) : raw;
        },
        [form]
    );
}

export function useFileSize() {
    const locale = useLocale();

    return useCallback((bytes: number) => formatFileSize(bytes, locale), [locale]);
}

export function useFormatsLabel() {
    const labels = looseTranslator(useTranslations('Labels'));
    const locale = useLocale();

    return useCallback(
        (formats: readonly ConvertSource[]) => formatsLabel(formats, labels, locale),
        [labels, locale]
    );
}
