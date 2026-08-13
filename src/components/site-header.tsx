'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';

import { ColorSchemeToggle } from '@/components/color-scheme-toggle';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

const SCROLL_THRESHOLD = 8;

function subscribeToScroll(onChange: () => void): () => void {
    window.addEventListener('scroll', onChange, { passive: true });

    return () => window.removeEventListener('scroll', onChange);
}

export function SiteHeader() {
    const scrolled = useSyncExternalStore(
        subscribeToScroll,
        () => window.scrollY > SCROLL_THRESHOLD,
        () => false
    );

    return (
        <header
            style={{ viewTransitionName: 'site-header' }}
            className={cn(
                'sticky top-0 z-40 border-b transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 ease-out motion-reduce:transition-none',
                scrolled
                    ? 'border-border bg-background/70 shadow-sm backdrop-blur-md'
                    : 'border-transparent bg-background/80 backdrop-blur-sm'
            )}
        >
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
                <Link
                    href="/"
                    className="group flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-80"
                >
                    <Logo className="transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none" />
                    {SITE.name}
                </Link>

                <div className="flex items-center gap-2">
                    <ColorSchemeToggle />
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
