import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { JsonLd } from '@/components/json-ld';
import { Landing } from '@/components/landing';
import { routing } from '@/i18n/routing';
import { siteJsonLd } from '@/lib/site';

export default async function Home({ params }: PageProps<'/[locale]'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: 'Site' });
    const tools = await getTranslations({ locale, namespace: 'Tools' });

    return (
        <>
            <JsonLd
                data={siteJsonLd(
                    {
                        tagline: t('tagline'),
                        description: t('description'),
                        toolList: t('toolList'),
                        tool: tool => ({
                            title: tools(`${tool.key}.title`),
                            description: tools(`${tool.key}.description`),
                        }),
                    },
                    locale
                )}
            />
            <Landing />
        </>
    );
}
