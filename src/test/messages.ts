import { createTranslator } from 'next-intl';

import messages from '../../messages/en.json';
import { routing } from '@/i18n/routing';
import type { ActionErrorDetail, ActionWarningDetail } from '@/lib/errors';
import {
    actionErrorText,
    actionWarningText,
    looseTranslator,
    type MessageContext,
} from '@/lib/messages';

export { messages };

export function translator(namespace: string) {
    return looseTranslator(
        createTranslator({
            locale: routing.defaultLocale,
            messages,
            namespace: namespace as never,
        })
    );
}

export function messageContext(): MessageContext {
    return {
        errors: translator('Errors'),
        labels: translator('Labels'),
        form: translator('Form'),
        warnings: translator('Warnings'),
        locale: routing.defaultLocale,
    };
}

export function errorText(detail: ActionErrorDetail): string {
    return actionErrorText(detail, messageContext());
}

export function warningText(detail: ActionWarningDetail): string {
    return actionWarningText(detail, messageContext());
}
