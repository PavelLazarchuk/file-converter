import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToolPage } from '@/components/tool-page';
import { routing } from '@/i18n/routing';
import { toolMetadata } from '@/lib/tool-metadata';
import { PdfForm } from './pdf-form';

const PATH = '/pdf';

export async function generateMetadata({ params }: PageProps<'/[locale]/pdf'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    return toolMetadata(locale, 'ImagesToPdf', PATH);
}

export default async function Page({ params }: PageProps<'/[locale]/pdf'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: 'ImagesToPdf' });

    return (
        <ToolPage href={PATH} title={t('heading')} description={t('intro')}>
            <PdfForm />
        </ToolPage>
    );
}
