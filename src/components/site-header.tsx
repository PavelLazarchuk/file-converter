import Link from 'next/link';

import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { SITE } from '@/lib/site';

export function SiteHeader() {
    return (
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
                <Link
                    href="/"
                    className="flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-80"
                >
                    <Logo />
                    {SITE.name}
                </Link>

                <div className="flex items-center gap-2">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
