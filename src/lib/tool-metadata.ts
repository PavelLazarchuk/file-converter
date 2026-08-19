import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { languageAlternates, localeUrl } from './site';

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

    return {
        title: t('metaTitle'),
        description: t('metaDescription'),
        alternates: {
            canonical: localeUrl(locale, path),
            languages: languageAlternates(path),
        },
    };
}
