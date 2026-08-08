import type { MetadataRoute } from 'next';

import { SITE, TOOLS } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();

    return [
        { url: SITE.url, lastModified, changeFrequency: 'monthly', priority: 1 },
        ...TOOLS.map(tool => ({
            url: `${SITE.url}${tool.href}`,
            lastModified,
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        })),
        {
            url: `${SITE.url}/privacy`,
            lastModified,
            changeFrequency: 'yearly' as const,
            priority: 0.3,
        },
    ];
}
