import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToolPage } from '@/components/tool-page';
import { routing } from '@/i18n/routing';
import { toolMetadata } from '@/lib/tool-metadata';
import { PlaceholderForm } from './placeholder-form';

const PATH = '/placeholder';

export const maxDuration = 60;

export async function generateMetadata({ params }: PageProps<'/[locale]/placeholder'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    return toolMetadata(locale, 'Placeholder', PATH);
}

export default async function Page({ params }: PageProps<'/[locale]/placeholder'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: 'Placeholder' });

    return (
        <ToolPage href={PATH} title={t('heading')} description={t('intro')}>
            <PlaceholderForm />
        </ToolPage>
    );
}
