import type { MetadataRoute } from 'next';
import { getTranslations } from 'next-intl/server';

import { routing } from '@/i18n/routing';
import { SITE } from '@/lib/site';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
    const t = await getTranslations({ locale: routing.defaultLocale, namespace: 'Site' });

    return {
        name: `${SITE.name} — ${t('tagline')}`,
        short_name: SITE.name,
        description: t('description'),
        lang: routing.defaultLocale,
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#6d5ef0',
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
                src: '/icon-512-maskable.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    };
}
