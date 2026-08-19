'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Download, Trophy, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { downloadResult } from '@/hooks/use-file-action';
import { useFileSize } from '@/hooks/use-messages';
import type { ActionFile } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { sizeChange } from '@/lib/image';
import { cn } from '@/lib/utils';

export type ComparisonProps = {
    files: ActionFile[];
    quality: number;
    onDismiss: () => void;
};

type Row = {
    file: ActionFile;
    label: string;
    size: number;
    previewUrl: string;
};

function formatLabel(filename: string): string {
    const extension = filename.slice(filename.lastIndexOf('.') + 1).toUpperCase();

    return extension === 'JPG' ? 'JPEG' : extension;
}

export function FormatComparison({ files, quality, onDismiss }: ComparisonProps) {
    const t = useTranslations('Compare');
    const result = useTranslations('Result');
    const fileSize = useFileSize();
    const previews = useMemo(
        () =>
            files.map(file =>
                URL.createObjectURL(new Blob([file.data as BlobPart], { type: file.mimeType }))
            ),
        [files]
    );

    useEffect(
        () => () => {
            for (const url of previews) URL.revokeObjectURL(url);
        },
        [previews]
    );

    const rows = useMemo<Row[]>(
        () =>
            files
                .map((file, index) => ({
                    file,
                    label: formatLabel(file.filename),
                    size: file.data.byteLength,
                    previewUrl: previews[index] ?? '',
                }))
                .sort((a, b) => a.size - b.size),
        [files, previews]
    );

    if (!rows.length) return null;

    const originalSize = files[0].originalSize;
    const best = rows[0];
    const widest = rows[rows.length - 1].size;

    return (
        <div className="space-y-4 rounded-xl border bg-card p-4 motion-reduce:animate-none animate-in duration-300 ease-out fade-in-0 zoom-in-95 slide-in-from-bottom-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                    <Trophy className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                        <p className="text-sm font-medium">
                            {t('winner', { format: best.label, size: fileSize(best.size) })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {t('encodedAt', { quality, size: fileSize(originalSize) })}
                        </p>
                    </div>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={result('discard')}
                    onClick={onDismiss}
                >
                    <X />
                </Button>
            </div>

            <ul className="space-y-2">
                {rows.map(row => {
                    const change = originalSize > 0 ? sizeChange(originalSize, row.size) : null;
                    const winner = row === best;

                    return (
                        <li
                            key={row.file.filename}
                            className={cn(
                                'flex items-center gap-3 rounded-lg border p-2',
                                winner && 'border-emerald-500/50 bg-emerald-500/5'
                            )}
                        >
                            <div className="relative size-12 shrink-0 overflow-hidden rounded border bg-muted">
                                {row.previewUrl && (
                                    <Image
                                        src={row.previewUrl}
                                        alt={t('preview', { format: row.label })}
                                        fill
                                        unoptimized
                                        className="object-contain"
                                    />
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2">
                                    <span className="text-sm font-medium">{row.label}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {fileSize(row.size)}
                                    </span>
                                    {change && change.direction !== 'same' && (
                                        <span
                                            className={cn(
                                                'text-xs font-medium',
                                                change.direction === 'smaller'
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-amber-600 dark:text-amber-400'
                                            )}
                                        >
                                            {t('vsOriginal', {
                                                change: result(change.direction, {
                                                    percent: change.percent,
                                                }),
                                            })}
                                        </span>
                                    )}
                                </div>
                                <div
                                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                                    role="presentation"
                                >
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
                                            winner ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                                        )}
                                        style={{
                                            width: `${widest > 0 ? Math.max(2, (row.size / widest) * 100) : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant={winner ? 'default' : 'ghost'}
                                size="icon"
                                aria-label={result('downloadOne', { name: row.file.filename })}
                                onClick={() =>
                                    downloadResult(row.file, row.file.filename, {
                                        one: name => result('downloading', { name }),
                                        many: (count, name) =>
                                            result('downloadingZip', {
                                                files: String(count),
                                                name,
                                            }),
                                    })
                                }
                            >
                                <Download />
                            </Button>
                        </li>
                    );
                })}
            </ul>

            <p className="text-sm text-muted-foreground">{t('caveat')}</p>
        </div>
    );
}
