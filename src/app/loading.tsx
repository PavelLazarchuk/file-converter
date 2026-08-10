const LINE_WIDTHS = ['w-full', 'w-11/12', 'w-9/12'];

export default function Loading() {
    return (
        <main
            aria-busy
            aria-label="Loading"
            className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-16"
        >
            <div className="animate-pulse space-y-8">
                <div className="space-y-3">
                    <div className="h-8 w-56 max-w-full rounded bg-muted" />
                    <div className="h-4 w-80 max-w-full rounded bg-muted" />
                </div>

                <div className="h-40 rounded-xl bg-muted/60" />

                <div className="space-y-3">
                    {LINE_WIDTHS.map(width => (
                        <div key={width} className={`h-4 rounded bg-muted ${width}`} />
                    ))}
                </div>
            </div>
        </main>
    );
}
