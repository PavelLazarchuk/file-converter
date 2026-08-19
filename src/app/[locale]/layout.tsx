import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AppToaster } from '@/components/app-toaster';
import { ColorSchemeProvider } from '@/components/color-scheme-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';
import { routing } from '@/i18n/routing';
import { COLOR_SCHEME_INIT_SCRIPT } from '@/lib/color-scheme';
import { SITE, languageAlternates, localeUrl } from '@/lib/site';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

import '../globals.css';

const inter = Inter({
    variable: '--font-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export function generateStaticParams() {
    return routing.locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    const t = await getTranslations({ locale, namespace: 'Site' });
    const title = `${SITE.name} — ${t('tagline')}`;
    const description = t('description');

    return {
        metadataBase: new URL(SITE.url),
        title: {
            default: title,
            template: `%s — ${SITE.name}`,
        },
        description,
        applicationName: SITE.name,
        alternates: {
            canonical: localeUrl(locale),
            languages: languageAlternates(),
        },
        openGraph: {
            type: 'website',
            siteName: SITE.name,
            title,
            description,
            url: localeUrl(locale),
            locale,
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
    };
}

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#1b1830' },
    ],
};

export default async function RootLayout({ children, params }: LayoutProps<'/[locale]'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    setRequestLocale(locale);

    return (
        <html
            lang={locale}
            suppressHydrationWarning
            className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
        >
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
                <script dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_INIT_SCRIPT }} />
            </head>
            <body className="min-h-full flex flex-col">
                <NextIntlClientProvider>
                    <ThemeProvider>
                        <ColorSchemeProvider>
                            <SiteHeader />
                            {children}
                            <SiteFooter />
                            <Analytics />
                            <SpeedInsights />
                            <AppToaster />
                        </ColorSchemeProvider>
                    </ThemeProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
