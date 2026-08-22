import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToolPage } from '@/components/tool-page';
import { routing } from '@/i18n/routing';
import { toolMetadata } from '@/lib/tool-metadata';
import { ConvertForm } from './convert-form';

const PATH = '/convert';

export const maxDuration = 60;

export async function generateMetadata({ params }: PageProps<'/[locale]/convert'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    return toolMetadata(locale, 'Convert', PATH);
}

export default async function Page({ params }: PageProps<'/[locale]/convert'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: 'Convert' });

    return (
        <ToolPage href={PATH} title={t('heading')} description={t('intro')}>
            <ConvertForm />
        </ToolPage>
    );
}
