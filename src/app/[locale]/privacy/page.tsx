import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { routing } from '@/i18n/routing';
import { MAX_FILE_SIZE_LABEL } from '@/lib/image';
import { languageAlternates, localeUrl } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[locale]/privacy'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    const t = await getTranslations({ locale, namespace: 'Privacy' });

    return {
        title: t('title'),
        description: t('metaDescription'),
        alternates: {
            canonical: localeUrl(locale, '/privacy'),
            languages: languageAlternates('/privacy'),
        },
    } satisfies Metadata;
}

const SECTIONS = [
    { title: 'processing.title', body: ['processing.p1', 'processing.p2'] },
    { title: 'notCollected.title', body: ['notCollected.p1', 'notCollected.p2'] },
    { title: 'analytics.title', body: ['analytics.p1', 'analytics.p2'] },
    { title: 'metadata.title', body: ['metadata.p1', 'metadata.p2', 'metadata.p3'] },
    { title: 'limits.title', body: ['limits.p1'] },
] as const;

export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) notFound();

    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: 'Privacy' });

    return (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-16">
            <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="mt-2 text-muted-foreground">{t('intro')}</p>

            <div className="mt-10 space-y-8">
                {SECTIONS.map(section => (
                    <section key={section.title}>
                        <h2 className="text-lg font-semibold">{t(section.title)}</h2>
                        {section.body.map(paragraph => (
                            <p
                                key={paragraph}
                                className="mt-3 leading-relaxed text-muted-foreground"
                            >
                                {t(paragraph, { maxFileSize: MAX_FILE_SIZE_LABEL })}
                            </p>
                        ))}
                    </section>
                ))}
            </div>
        </main>
    );
}
