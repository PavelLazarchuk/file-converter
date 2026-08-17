'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Download, FileCheck2, TriangleAlert, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAutoDownload } from '@/hooks/use-auto-download';
import { useFilenameTemplate } from '@/hooks/use-filename-template';
import { useSendToTool } from '@/hooks/use-handoff';
import {
    downloadResult,
    outcomeNames,
    type ActionOutcome,
    type OutcomeFile,
} from '@/hooks/use-file-action';
import { FILENAME_TEMPLATE_MAX_LENGTH, FILENAME_TOKENS } from '@/lib/filename-template';
import { handoffTargets } from '@/lib/handoff';
import { countLabel, formatFileSize, sizeChange } from '@/lib/image';
import { TOOLS } from '@/lib/site';
import { cn } from '@/lib/utils';

const CHECKERBOARD: React.CSSProperties = {
    backgroundImage: 'repeating-conic-gradient(var(--muted) 0% 25%, var(--background) 0% 50%)',
    backgroundSize: '16px 16px',
};

const ROW_STAGGER_MS = 60;

function Preview({ entry, className }: { entry: OutcomeFile; className?: string }) {
    const [decoded, setDecoded] = useState(false);

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
                            'inline-block animate-delta-pop font-medium motion-reduce:animate-none',
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
        <div className="grid grid-rows-[1fr] rounded-lg border border-amber-500/50 bg-amber-500/10 opacity-100 transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none starting:grid-rows-[0fr] starting:opacity-0">
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
    const targets = handoffTargets(
        files.map(entry => entry.file.mimeType),
        pathname
    );

    if (!targets.length) return null;

    const from = TOOLS.find(tool => tool.href === pathname)?.title ?? 'the last step';

    return (
        <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Keep going</p>
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
                        {tool.title}
                    </Button>
                ))}
            </div>
            <p className="text-sm text-muted-foreground">
                Opens the tool with{' '}
                {files.length === 1 ? 'this result' : `these ${files.length} results`} already
                loaded — no need to download and upload again.
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
                                        {entry.file.warning}
                                    </p>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Download ${names[index]}`}
                                onClick={() => downloadResult(entry.file, names[index])}
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

            <SendToTools files={files} names={names} />

            <div className="space-y-4 border-t pt-4">
                <div className="space-y-1.5">
                    <Label htmlFor="filename-template">Rename on download</Label>
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
                        Leave empty to keep the names above. Available:{' '}
                        {FILENAME_TOKENS.map((token, index) => (
                            <span key={token}>
                                {index > 0 && ', '}
                                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                                    {`{${token}}`}
                                </code>
                            </span>
                        ))}
                        . The extension is added for you.
                    </p>
                </div>

                <div className="space-y-1.5">
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
        </div>
    );
}
