import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToolPage } from '@/components/tool-page';
import { routing } from '@/i18n/routing';
import { toolMetadata } from '@/lib/tool-metadata';
import { WatermarkForm } from './watermark-form';

const PATH = '/watermark';

export async function generateMetadata({ params }: PageProps<'/[locale]/watermark'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    return toolMetadata(locale, 'Watermark', PATH);
}

export default async function Page({ params }: PageProps<'/[locale]/watermark'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: 'Watermark' });

    return (
        <ToolPage href={PATH} title={t('heading')} description={t('intro')}>
            <WatermarkForm />
        </ToolPage>
    );
}
