import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { SITE, languageAlternates, localeUrl } from './site';

export async function toolMetadata(
    locale: AppLocale,
    namespace:
        | 'Resize'
        | 'Crop'
        | 'Rotate'
        | 'Compare'
        | 'Compress'
        | 'Convert'
        | 'Watermark'
        | 'Filters'
        | 'MetadataTool'
        | 'Placeholder'
        | 'MergePdf'
        | 'ImagesToPdf',
    path: string
): Promise<Metadata> {
    const t = await getTranslations({ locale, namespace });
    const title = t('metaTitle');
    const description = t('metaDescription');

    return {
        title,
        description,
        alternates: {
            canonical: localeUrl(locale, path),
            languages: languageAlternates(path),
        },
        openGraph: {
            type: 'website',
            siteName: SITE.name,
            locale,
            title,
            description,
            url: localeUrl(locale, path),
        },
        twitter: { card: 'summary_large_image', title, description },
    };
}
