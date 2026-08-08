import type { MetadataRoute } from 'next';

import { SITE } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: `${SITE.name} — ${SITE.tagline}`,
        short_name: SITE.name,
        description: SITE.description,
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
