import type { Metadata, Viewport } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { AppToaster } from '@/components/app-toaster';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';
import { SITE } from '@/lib/site';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

import './globals.css';

const inter = Inter({
    variable: '--font-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

const title = `${SITE.name} — ${SITE.tagline}`;

export const metadata: Metadata = {
    metadataBase: new URL(SITE.url),
    title: {
        default: title,
        template: `%s — ${SITE.name}`,
    },
    description: SITE.description,
    applicationName: SITE.name,
    alternates: { canonical: '/' },
    openGraph: {
        type: 'website',
        siteName: SITE.name,
        title,
        description: SITE.description,
        url: SITE.url,
    },
    twitter: {
        card: 'summary_large_image',
        title,
        description: SITE.description,
    },
};

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#1b1830' },
    ],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
        >
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
            </head>
            <body className="min-h-full flex flex-col">
                <ThemeProvider>
                    <SiteHeader />
                    {children}
                    <SiteFooter />
                    <Analytics />
                    <SpeedInsights />
                    <AppToaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
