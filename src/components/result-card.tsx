'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Download, FileCheck2, TriangleAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePathname } from '@/i18n/navigation';
import { useAutoDownload } from '@/hooks/use-auto-download';
import { useFilenameTemplate } from '@/hooks/use-filename-template';
import { useSendToTool } from '@/hooks/use-handoff';
import {
    downloadResult,
    outcomeNames,
    type ActionOutcome,
    type OutcomeFile,
} from '@/hooks/use-file-action';
import { useActionMessage, useFileSize, useWarningMessage } from '@/hooks/use-messages';
import { FILENAME_TEMPLATE_MAX_LENGTH, FILENAME_TOKENS } from '@/lib/filename-template';
import { handoffTargets } from '@/lib/handoff';
import { sizeChange } from '@/lib/image';
import { toolByHref } from '@/lib/site';
import { cn } from '@/lib/utils';

const CHECKERBOARD: React.CSSProperties = {
    backgroundImage: 'repeating-conic-gradient(var(--muted) 0% 25%, var(--background) 0% 50%)',
    backgroundSize: '16px 16px',
};

const ROW_STAGGER_MS = 60;

function Preview({ entry, className }: { entry: OutcomeFile; className?: string }) {
    const [decoded, setDecoded] = useState(false);
    const noPreview = useTranslations('Result')('noPreview');

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
                    ref={node => {
                        if (node?.complete) setDecoded(true);
                    }}
                    src={entry.previewUrl}
                    alt={entry.file.filename}
                    width={entry.width ?? 320}
                    height={entry.height ?? 320}
                    unoptimized
                    onLoad={() => setDecoded(true)}
                    onError={() => setDecoded(true)}
                    className={cn(
                        'max-h-full w-auto max-w-full object-contain transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
                        decoded ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                    )}
                />
            ) : (
                <span className="px-2 text-center font-mono text-xs text-muted-foreground">
                    {noPreview}
                </span>
            )}
        </div>
    );
}

function SizeLine({ entry }: { entry: OutcomeFile }) {
    const t = useTranslations('Result');
    const fileSize = useFileSize();
    const { originalSize } = entry.file;
    const size = entry.file.data.byteLength;
    const change = originalSize > 0 ? sizeChange(originalSize, size) : null;

    return (
        <>
            {entry.width && entry.height && `${entry.width} × ${entry.height} · `}
            {fileSize(size)}
            {change && (
                <>
                    {' · '}
                    {t('was', { size: fileSize(originalSize) })}{' '}
                    <span
                        className={cn(
                            'inline-block animate-delta-pop font-medium motion-reduce:animate-none',
                            change.direction === 'smaller' &&
                                'text-emerald-600 dark:text-emerald-400',
                            change.direction === 'larger' && 'text-amber-600 dark:text-amber-400'
                        )}
                    >
                        {change.direction === 'same'
                            ? t('noChange')
                            : t(change.direction, { percent: change.percent })}
                    </span>
                </>
            )}
        </>
    );
}

function Warning({ children, alert }: { children: React.ReactNode; alert?: boolean }) {
    return (
        <div
            role={alert ? 'alert' : undefined}
            className="grid grid-rows-[1fr] rounded-lg border border-amber-500/50 bg-amber-500/10 opacity-100 transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none starting:grid-rows-[0fr] starting:opacity-0"
        >
            <div className="overflow-hidden">
                <div className="flex items-start gap-2.5 p-3 text-sm">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0">{children}</div>
                </div>
            </div>
        </div>
    );
}

function SendToTools({ files, names }: { files: OutcomeFile[]; names: string[] }) {
    const pathname = usePathname();
    const sendToTool = useSendToTool();
    const t = useTranslations('Result');
    const tools = useTranslations('Tools');
    const targets = handoffTargets(
        files.map(entry => entry.file.mimeType),
        pathname
    );
    const current = toolByHref(pathname);

    if (!targets.length) return null;

    const from = current ? tools(`${current.key}.title`) : t('lastStep');

    return (
        <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">{t('keepGoing')}</p>
            <div className="flex flex-wrap gap-2">
                {targets.map(tool => (
                    <Button
                        key={tool.href}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            sendToTool(
                                tool,
                                from,
                                files.map((entry, index) => ({
                                    data: entry.file.data,
                                    filename: names[index],
                                    mimeType: entry.file.mimeType,
                                }))
                            )
                        }
                    >
                        <tool.icon />
                        {tools(`${tool.key}.title`)}
                    </Button>
                ))}
            </div>
            <p className="text-sm text-muted-foreground">
                {t('handoffHint', { count: files.length })}
            </p>
        </div>
    );
}

type ResultCardProps = {
    outcome: ActionOutcome;
    leaving?: boolean;
    onDismiss: () => void;
    onDownloadAll: () => void;
};

export function ResultCard({ outcome, leaving, onDismiss, onDownloadAll }: ResultCardProps) {
    const { autoDownload, setAutoDownload } = useAutoDownload();
    const { template, setTemplate } = useFilenameTemplate();
    const t = useTranslations('Result');
    const common = useTranslations('Common');
    const message = useActionMessage();
    const warningMessage = useWarningMessage();
    const { files, failures } = outcome;
    const single = files.length === 1 ? files[0] : null;
    const names = outcomeNames(files, template);

    return (
        <div
            className={cn(
                'space-y-4 rounded-xl border bg-card p-4 motion-reduce:animate-none',
                leaving
                    ? 'animate-out duration-200 ease-in fade-out-0 zoom-out-95 slide-out-to-top-1'
                    : 'animate-in duration-300 ease-out fade-in-0 zoom-in-95 slide-in-from-bottom-3'
            )}
        >
            <div role="status" className="flex items-start gap-2.5">
                <FileCheck2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium">
                    {single
                        ? t('ready')
                        : t('readyCount', { files: common('results', { count: files.length }) })}
                </p>
            </div>

            {single ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Preview entry={single} className="h-40 w-full shrink-0 sm:h-32 sm:w-44" />
                    <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium">{names[0]}</p>
                        <p className="text-sm text-muted-foreground">
                            <SizeLine entry={single} />
                        </p>
                    </div>
                </div>
            ) : (
                <ul className="divide-y rounded-lg border">
                    {files.map((entry, index) => (
                        <li
                            key={entry.file.filename}
                            className="flex animate-in items-center gap-3 p-2 duration-300 ease-out fade-in-0 slide-in-from-bottom-2 fill-mode-backwards motion-reduce:animate-none"
                            style={{ animationDelay: `${index * ROW_STAGGER_MS}ms` }}
                        >
                            <Preview entry={entry} className="size-14 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{names[index]}</p>
                                <p className="text-xs text-muted-foreground">
                                    <SizeLine entry={entry} />
                                </p>
                                {entry.file.warning && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                        {warningMessage(entry.file.warning)}
                                    </p>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={t('downloadOne', { name: names[index] })}
                                onClick={() =>
                                    downloadResult(entry.file, names[index], {
                                        one: name => t('downloading', { name }),
                                        many: (count, name) =>
                                            t('downloadingZip', {
                                                files: common('files', { count }),
                                                name,
                                            }),
                                    })
                                }
                            >
                                <Download />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            {single?.file.warning && <Warning>{warningMessage(single.file.warning)}</Warning>}

            {failures.length > 0 && (
                <Warning alert>
                    <p className="font-medium">
                        {t('failed', { files: common('files', { count: failures.length }) })}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                        {failures.map(problem => (
                            <li key={problem.filename} className="break-words">
                                <span className="font-medium">{problem.filename}</span> —{' '}
                                {message(problem.detail)}
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
                            ? t('downloadAnyway')
                            : t('download')
                        : t('downloadAll')}
                </Button>
                <Button type="button" variant="outline" onClick={onDismiss}>
                    <X />
                    {t('discard')}
                </Button>
            </div>

            <SendToTools files={files} names={names} />

            <div className="space-y-4 border-t pt-4">
                <div className="space-y-1.5">
                    <Label htmlFor="filename-template">{t('rename')}</Label>
                    <Input
                        id="filename-template"
                        value={template}
                        maxLength={FILENAME_TEMPLATE_MAX_LENGTH}
                        placeholder="{name}"
                        spellCheck={false}
                        autoComplete="off"
                        onChange={event => setTemplate(event.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                        {t.rich('renameHint', {
                            tokens: () => (
                                <>
                                    {FILENAME_TOKENS.map((token, index) => (
                                        <span key={token}>
                                            {index > 0 && ', '}
                                            <code className="rounded bg-muted px-1 py-0.5 text-xs">
                                                {`{${token}}`}
                                            </code>
                                        </span>
                                    ))}
                                </>
                            ),
                        })}
                    </p>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="auto-download"
                            checked={autoDownload}
                            onCheckedChange={setAutoDownload}
                        />
                        <Label htmlFor="auto-download">{t('autoDownload')}</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {autoDownload ? t('autoDownloadOn') : t('autoDownloadOff')}
                    </p>
                </div>
            </div>
        </div>
    );
}
