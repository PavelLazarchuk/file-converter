import Link from 'next/link';

import { SITE, TOOLS } from '@/lib/site';

export function SiteFooter() {
    return (
        <footer className="border-t bg-card/30">
            <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-2">
                    <p className="font-semibold tracking-tight">{SITE.name}</p>
                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                        Focused tools for everyday image work — no account, no queue, no watermarks.
                        Uploads are processed in memory and never stored.
                    </p>
                </div>

                <nav aria-label="Tools">
                    <p className="text-sm font-medium">Tools</p>
                    <ul className="mt-3 space-y-2">
                        {TOOLS.map(tool => (
                            <li key={tool.href}>
                                <Link
                                    href={tool.href}
                                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {tool.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <nav aria-label="About">
                    <p className="text-sm font-medium">About</p>
                    <ul className="mt-3 space-y-2">
                        <li>
                            <Link
                                href="/privacy"
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Privacy
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>

            <div className="mx-auto w-full max-w-5xl border-t px-4 py-6">
                <p className="text-sm text-muted-foreground">
                    © {new Date().getFullYear()} {SITE.name}. Built with Next.js and sharp.
                </p>
            </div>
        </footer>
    );
}
