import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
    getTranslations:
        async ({ namespace }: { namespace: string }) =>
        (key: string) =>
            `${namespace}.${key}`,
}));

const { toolMetadata } = await import('./tool-metadata');
const { SITE, localeUrl } = await import('./site');

describe('toolMetadata', () => {
    it('canonicalises the tool page and lists every locale', async () => {
        const meta = await toolMetadata('en', 'Compress', '/compress');

        expect(meta.title).toBe('Compress.metaTitle');
        expect(meta.description).toBe('Compress.metaDescription');
        expect(meta.alternates?.canonical).toBe(localeUrl('en', '/compress'));
        expect(meta.alternates?.languages).toHaveProperty('en');
    });

    it('spells out the card in full, because Next replaces the layout’s openGraph', async () => {
        const meta = await toolMetadata('en', 'Compress', '/compress');

        expect(meta.openGraph).toMatchObject({
            type: 'website',
            siteName: SITE.name,
            locale: 'en',
            title: 'Compress.metaTitle',
            description: 'Compress.metaDescription',
            url: localeUrl('en', '/compress'),
        });
        expect(meta.twitter).toMatchObject({
            card: 'summary_large_image',
            title: 'Compress.metaTitle',
        });
    });
});
