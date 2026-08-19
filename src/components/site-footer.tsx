import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { SITE, TOOLS } from '@/lib/site';

export async function SiteFooter() {
    const t = await getTranslations('Site');
    const tools = await getTranslations('Tools');

    return (
        <footer className="border-t bg-card/30">
            <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-2">
                    <p className="font-semibold tracking-tight">{SITE.name}</p>
                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                        {t('footerBlurb')}
                    </p>
                </div>

                <nav aria-label={t('footerTools')}>
                    <p className="text-sm font-medium">{t('footerTools')}</p>
                    <ul className="mt-3 space-y-2">
                        {TOOLS.map(tool => (
                            <li key={tool.href}>
                                <Link
                                    href={tool.href}
                                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {tools(`${tool.key}.title`)}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <nav aria-label={t('footerAbout')}>
                    <p className="text-sm font-medium">{t('footerAbout')}</p>
                    <ul className="mt-3 space-y-2">
                        <li>
                            <Link
                                href="/privacy"
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {t('footerPrivacy')}
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>

            <div className="mx-auto w-full max-w-5xl border-t px-4 py-6">
                <p className="text-sm text-muted-foreground">
                    {t('copyright', { year: String(new Date().getFullYear()), name: SITE.name })}
                </p>
            </div>
        </footer>
    );
}
