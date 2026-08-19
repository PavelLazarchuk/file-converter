import type { MetadataRoute } from 'next';

import { routing } from '@/i18n/routing';
import { TOOLS, languageAlternates, localeUrl } from '@/lib/site';

const ROUTES = [
    { path: '/', priority: 1 },
    ...TOOLS.map(tool => ({ path: tool.href, priority: 0.8 })),
    { path: '/privacy', priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();

    return routing.locales.flatMap(locale =>
        ROUTES.map(({ path, priority }) => ({
            url: localeUrl(locale, path),
            lastModified,
            changeFrequency: 'monthly' as const,
            priority,
            alternates: { languages: languageAlternates(path) },
        }))
    );
}
