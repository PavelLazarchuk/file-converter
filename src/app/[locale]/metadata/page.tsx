import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToolPage } from '@/components/tool-page';
import { routing } from '@/i18n/routing';
import { toolMetadata } from '@/lib/tool-metadata';
import { MetadataForm } from './metadata-form';

const PATH = '/metadata';

export const maxDuration = 60;

export async function generateMetadata({ params }: PageProps<'/[locale]/metadata'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    return toolMetadata(locale, 'MetadataTool', PATH);
}

export default async function Page({ params }: PageProps<'/[locale]/metadata'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: 'MetadataTool' });

    return (
        <ToolPage href={PATH} title={t('heading')} description={t('intro')}>
            <MetadataForm />
        </ToolPage>
    );
}
