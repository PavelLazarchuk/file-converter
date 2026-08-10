'use client';

import Image from 'next/image';
import { Download, FileCheck2, TriangleAlert, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAutoDownload } from '@/hooks/use-auto-download';
import { downloadResult, type ActionOutcome } from '@/hooks/use-image-action';
import { formatFileSize, sizeChange } from '@/lib/image';
import { cn } from '@/lib/utils';

const CHECKERBOARD: React.CSSProperties = {
    backgroundImage: 'repeating-conic-gradient(var(--muted) 0% 25%, var(--background) 0% 50%)',
    backgroundSize: '16px 16px',
};

type ResultCardProps = {
    outcome: ActionOutcome;
    original?: { size: number } | null;
    onDismiss: () => void;
};

export function ResultCard({ outcome, original, onDismiss }: ResultCardProps) {
    const { autoDownload, setAutoDownload } = useAutoDownload();
    const { result, previewUrl, width, height } = outcome;
    const size = result.data.byteLength;
    const change = original ? sizeChange(original.size, size) : null;

    return (
        <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-2.5">
                <FileCheck2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium">Result ready</p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div
                    className="flex h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border sm:h-32 sm:w-44"
                    style={CHECKERBOARD}
                >
                    {previewUrl ? (
                        <Image
                            src={previewUrl}
                            alt={result.filename}
                            width={width ?? 320}
                            height={height ?? 320}
                            unoptimized
                            className="max-h-full w-auto max-w-full object-contain"
                        />
                    ) : (
                        <span className="px-2 text-center font-mono text-xs text-muted-foreground">
                            No preview for this format
                        </span>
                    )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium">{result.filename}</p>
                    <p className="text-sm text-muted-foreground">
                        {width && height && `${width} × ${height} · `}
                        {formatFileSize(size)}
                    </p>
                    {original && change && (
                        <p className="text-sm text-muted-foreground">
                            was {formatFileSize(original.size)}{' '}
                            <span
                                className={cn(
                                    'font-medium',
                                    change.direction === 'smaller' &&
                                        'text-emerald-600 dark:text-emerald-400',
                                    change.direction === 'larger' &&
                                        'text-amber-600 dark:text-amber-400'
                                )}
                            >
                                {change.label}
                            </span>
                        </p>
                    )}
                </div>
            </div>

            {result.warning && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p>{result.warning}</p>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => downloadResult(result)}>
                    <Download />
                    {result.warning ? 'Download it anyway' : 'Download'}
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
