import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type ToolPageProps = {
    title: string;
    description: string;
    children: React.ReactNode;
};

export function ToolPage({ title, description, children }: ToolPageProps) {
    return (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-16">
            <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="size-4" />
                All tools
            </Link>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
        </main>
    );
}
