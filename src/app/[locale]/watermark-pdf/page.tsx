import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToolPage } from '@/components/tool-page';
import { routing } from '@/i18n/routing';
import { toolMetadata } from '@/lib/tool-metadata';
import { WatermarkPdfForm } from './watermark-pdf-form';

const PATH = '/watermark-pdf';

export const maxDuration = 60;

export async function generateMetadata({ params }: PageProps<'/[locale]/watermark-pdf'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    return toolMetadata(locale, 'WatermarkPdf', PATH);
}

export default async function Page({ params }: PageProps<'/[locale]/watermark-pdf'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: 'WatermarkPdf' });

    return (
        <ToolPage href={PATH} title={t('heading')} description={t('intro')}>
            <WatermarkPdfForm />
        </ToolPage>
    );
}
