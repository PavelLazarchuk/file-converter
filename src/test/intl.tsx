import {
    render as rtlRender,
    renderHook as rtlRenderHook,
    type RenderHookOptions,
    type RenderOptions,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import { routing } from '@/i18n/routing';
import { messages } from './messages';

export * from './messages';

function Providers({ children }: { children: React.ReactNode }) {
    return (
        <NextIntlClientProvider locale={routing.defaultLocale} messages={messages}>
            {children}
        </NextIntlClientProvider>
    );
}

export function render(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
    return rtlRender(ui, { wrapper: Providers, ...options });
}

export function renderHook<Result, Props>(
    hook: (props: Props) => Result,
    options?: Omit<RenderHookOptions<Props>, 'wrapper'>
) {
    return rtlRenderHook(hook, { wrapper: Providers, ...options });
}
