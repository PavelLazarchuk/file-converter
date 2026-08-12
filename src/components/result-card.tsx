'use client';

import Image from 'next/image';
import { Download, FileCheck2, TriangleAlert, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAutoDownload } from '@/hooks/use-auto-download';
import { downloadResult, type ActionOutcome, type OutcomeFile } from '@/hooks/use-image-action';
import { countLabel, formatFileSize, sizeChange } from '@/lib/image';
import { cn } from '@/lib/utils';

const CHECKERBOARD: React.CSSProperties = {
    backgroundImage: 'repeating-conic-gradient(var(--muted) 0% 25%, var(--background) 0% 50%)',
    backgroundSize: '16px 16px',
};

function Preview({ entry, className }: { entry: OutcomeFile; className?: string }) {
    return (
        <div
            className={cn(
                'flex items-center justify-center overflow-hidden rounded-lg border',
                className
            )}
            style={CHECKERBOARD}
        >
            {entry.previewUrl ? (
                <Image
                    src={entry.previewUrl}
                    alt={entry.file.filename}
                    width={entry.width ?? 320}
                    height={entry.height ?? 320}
                    unoptimized
                    className="max-h-full w-auto max-w-full object-contain"
                />
            ) : (
                <span className="px-2 text-center font-mono text-xs text-muted-foreground">
                    No preview
                </span>
            )}
        </div>
    );
}

function SizeLine({ entry }: { entry: OutcomeFile }) {
    const { originalSize } = entry.file;
    const size = entry.file.data.byteLength;
    const change = originalSize > 0 ? sizeChange(originalSize, size) : null;

    return (
        <>
            {entry.width && entry.height && `${entry.width} × ${entry.height} · `}
            {formatFileSize(size)}
            {change && (
                <>
                    {' · was '}
                    {formatFileSize(originalSize)}{' '}
                    <span
                        className={cn(
                            'font-medium',
                            change.direction === 'smaller' &&
                                'text-emerald-600 dark:text-emerald-400',
                            change.direction === 'larger' && 'text-amber-600 dark:text-amber-400'
                        )}
                    >
                        {change.label}
                    </span>
                </>
            )}
        </>
    );
}

function Warning({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">{children}</div>
        </div>
    );
}

type ResultCardProps = {
    outcome: ActionOutcome;
    onDismiss: () => void;
    onDownloadAll: () => void;
};

export function ResultCard({ outcome, onDismiss, onDownloadAll }: ResultCardProps) {
    const { autoDownload, setAutoDownload } = useAutoDownload();
    const { files, failures } = outcome;
    const single = files.length === 1 ? files[0] : null;

    return (
        <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-2.5">
                <FileCheck2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium">
                    {single ? 'Result ready' : `${countLabel(files.length, 'result')} ready`}
                </p>
            </div>

            {single ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Preview entry={single} className="h-40 w-full shrink-0 sm:h-32 sm:w-44" />
                    <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium">{single.file.filename}</p>
                        <p className="text-sm text-muted-foreground">
                            <SizeLine entry={single} />
                        </p>
                    </div>
                </div>
            ) : (
                <ul className="divide-y rounded-lg border">
                    {files.map(entry => (
                        <li key={entry.file.filename} className="flex items-center gap-3 p-2">
                            <Preview entry={entry} className="size-14 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                    {entry.file.filename}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    <SizeLine entry={entry} />
                                </p>
                                {entry.file.warning && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                        {entry.file.warning}
                                    </p>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Download ${entry.file.filename}`}
                                onClick={() => downloadResult(entry.file)}
                            >
                                <Download />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            {single?.file.warning && <Warning>{single.file.warning}</Warning>}

            {failures.length > 0 && (
                <Warning>
                    <p className="font-medium">
                        {countLabel(failures.length, 'file')} could not be processed
                    </p>
                    <ul className="mt-1 space-y-0.5">
                        {failures.map(problem => (
                            <li key={problem.filename} className="break-words">
                                <span className="font-medium">{problem.filename}</span> —{' '}
                                {problem.error}
                            </li>
                        ))}
                    </ul>
                </Warning>
            )}

            <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={onDownloadAll}>
                    <Download />
                    {single
                        ? single.file.warning
                            ? 'Download it anyway'
                            : 'Download'
                        : 'Download all (.zip)'}
                </Button>
                <Button type="button" variant="outline" onClick={onDismiss}>
                    <X />
                    Discard
                </Button>
            </div>

            <div className="space-y-1.5 border-t pt-4">
                <div className="flex items-center gap-3">
                    <Switch
                        id="auto-download"
                        checked={autoDownload}
                        onCheckedChange={setAutoDownload}
                    />
                    <Label htmlFor="auto-download">Download automatically</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                    {autoDownload
                        ? 'Results are saved as soon as they are ready, and still shown here.'
                        : 'Results stay here until you download them. The preference is remembered on this device.'}
                </p>
            </div>
        </div>
    );
}
