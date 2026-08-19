import { ViewTransition } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { JsonLd } from '@/components/json-ld';
import { Link } from '@/i18n/navigation';
import { breadcrumbJsonLd, toolByHref, toolJsonLd, toolTransitionName } from '@/lib/site';

const enter =
    'animate-in fade-in fill-mode-backwards duration-500 ease-out motion-reduce:animate-none';

type ToolPageProps = {
    href: string;
    title: string;
    description: string;
    children: React.ReactNode;
};

export async function ToolPage({ href, title, description, children }: ToolPageProps) {
    const tool = toolByHref(href);
    const locale = await getLocale();
    const t = await getTranslations('Tools');
    const copy = tool
        ? { title: t(`${tool.key}.title`), description: t(`${tool.key}.description`) }
        : null;

    return (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-16">
            {tool && copy && (
                <JsonLd
                    data={[
                        toolJsonLd(tool, copy, locale),
                        breadcrumbJsonLd(tool, { ...copy, root: t('allTools') }, locale),
                    ]}
                />
            )}
            <Link
                href="/"
                className={`${enter} slide-in-from-left-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground`}
            >
                <ArrowLeft className="size-4" />
                {t('allTools')}
            </Link>

            <div className="mt-6 flex items-center gap-4">
                {tool && (
                    <ViewTransition name={toolTransitionName('icon', tool.href)} share="morph">
                        <div
                            className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${tool.gradient}`}
                        >
                            <tool.icon className="size-5" />
                        </div>
                    </ViewTransition>
                )}
                <ViewTransition name={toolTransitionName('title', href)} share="morph">
                    <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
                </ViewTransition>
            </div>

            <p
                className={`${enter} slide-in-from-bottom-2 mt-2 text-muted-foreground`}
                style={{ animationDelay: '80ms' }}
            >
                {description}
            </p>
            <div
                className={`${enter} slide-in-from-bottom-4 mt-8`}
                style={{ animationDelay: '160ms' }}
            >
                {children}
            </div>
        </main>
    );
}
