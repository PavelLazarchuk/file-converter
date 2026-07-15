type StatusPageProps = {
    code: string;
    title: string;
    description: string;
    footnote?: string;
    children: React.ReactNode;
};

export function StatusPage({ code, title, description, footnote, children }: StatusPageProps) {
    return (
        <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-20 text-center">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -top-40 left-1/2 h-130 w-225 -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-500/15 via-violet-500/15 to-emerald-500/15 blur-3xl" />
            </div>
            <p className="font-mono text-sm font-medium text-primary">{code}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {title}
            </h1>
            <p className="mt-3 max-w-md text-muted-foreground text-balance">{description}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
            {footnote && <p className="mt-6 font-mono text-xs text-muted-foreground">{footnote}</p>}
        </main>
    );
}
