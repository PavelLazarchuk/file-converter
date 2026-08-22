import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToolPage } from '@/components/tool-page';
import { routing } from '@/i18n/routing';
import { toolMetadata } from '@/lib/tool-metadata';
import { CompressForm } from './compress-form';

const PATH = '/compress';

export const maxDuration = 60;

export async function generateMetadata({ params }: PageProps<'/[locale]/compress'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    return toolMetadata(locale, 'Compress', PATH);
}

export default async function Page({ params }: PageProps<'/[locale]/compress'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: 'Compress' });

    return (
        <ToolPage href={PATH} title={t('heading')} description={t('intro')}>
            <CompressForm />
        </ToolPage>
    );
}
