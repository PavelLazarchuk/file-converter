import { OG_CONTENT_TYPE, OG_SIZE, ogStaticParams, renderToolOgImage } from '@/lib/og-image';
import { SITE } from '@/lib/site';
import type { AppLocale } from '@/i18n/routing';

const PATH = '/merge-pdf';

export const alt = SITE.name;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export const generateStaticParams = ogStaticParams;

export default async function OpengraphImage({
    params,
}: {
    params: Promise<{ locale: AppLocale }>;
}) {
    const { locale } = await params;

    return renderToolOgImage(locale, PATH);
}
