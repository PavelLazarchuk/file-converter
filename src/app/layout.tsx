import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import './globals.css';

const inter = Inter({
    variable: '--font-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Image Toolbox — Resize, Crop, Compress & Convert',
    description:
        'Free browser tools for images: resize with locked aspect ratio, crop to preset ratios, compress by quality or target size, and convert between JPEG, PNG, WEBP, AVIF, SVG and ICO favicons.',
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
            <body className="min-h-full flex flex-col">
                {children}
                <Analytics />
                <SpeedInsights />
                <Toaster position="top-right" richColors />
            </body>
        </html>
    );
}
