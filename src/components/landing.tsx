import { ViewTransition } from 'react';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { TOOLS, toolTransitionName } from '@/lib/site';

const enter =
    'animate-in fade-in fill-mode-backwards duration-500 ease-out motion-reduce:animate-none';

export async function Landing() {
    const t = await getTranslations('Landing');
    const tools = await getTranslations('Tools');

    return (
        <main className="relative flex-1 overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div className="glow-parallax absolute -top-40 left-1/2 h-130 w-225 -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-500/25 via-violet-500/25 to-emerald-500/25 blur-3xl" />
            </div>

            <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:py-28">
                <div className={`${enter} slide-in-from-bottom-4 text-center`}>
                    <span className="inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                        {t('badge')}
                    </span>
                    <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                        {t('headline')}
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground text-balance">
                        {t('subline', { count: TOOLS.length })}
                    </p>
                    <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                        {t('privacyNote')}{' '}
                        <Link
                            href="/privacy"
                            className="underline underline-offset-4 hover:text-foreground"
                        >
                            {t('privacyLink')}
                        </Link>
                        .
                    </p>
                </div>

                <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {TOOLS.map((tool, index) => (
                        <div
                            key={tool.href}
                            className={`${enter} slide-in-from-bottom-6`}
                            style={{ animationDelay: `${150 + index * 120}ms` }}
                        >
                            <Link
                                href={tool.href}
                                className="group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg"
                            >
                                <ViewTransition
                                    name={toolTransitionName('icon', tool.href)}
                                    share="morph"
                                >
                                    <div
                                        className={`flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${tool.gradient}`}
                                    >
                                        <tool.icon className="size-5" />
                                    </div>
                                </ViewTransition>
                                <ViewTransition
                                    name={toolTransitionName('title', tool.href)}
                                    share="morph"
                                >
                                    <h2 className="mt-5 text-lg font-semibold">
                                        {tools(`${tool.key}.title`)}
                                    </h2>
                                </ViewTransition>
                                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                                    {tools(`${tool.key}.description`)}
                                </p>
                                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                                    {t('openTool')}
                                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                                </span>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
