'use client';

import { useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DropzoneShell, RemoveButton, ReorderControls } from '@/components/dropzone-shell';
import { Button } from '@/components/ui/button';
import { useHandoffIntake } from '@/hooks/use-handoff';
import { useFileSize } from '@/hooks/use-messages';
import { useUploads } from '@/hooks/use-uploads';
import { MAX_BATCH_SIZE_LABEL, MAX_FILE_SIZE_LABEL } from '@/lib/image';
import { acceptUploads, totalUploadBytes, uploadProblemSummary } from '@/lib/uploads';

export type LoadedFile = { file: File; id: string };

export function useLoadedFiles(max: number) {
    return useUploads<LoadedFile>({ max });
}

export type FileDropzoneCopy = {
    count: (count: number) => string;
    full: (max: number) => string;
    notAccepted: (name: string) => string;
    idle: string;
    drag: string;
    hint: string;
};

export type FileDropzoneProps = {
    files: LoadedFile[];
    onAdd: (files: LoadedFile[]) => void;
    onRemove: (index: number) => void;
    onClear: () => void;
    onMove?: (from: number, to: number) => void;
    disabled?: boolean;
    max: number;
    receivesHandoff?: boolean;
    accept: string;
    accepts: (file: File) => boolean;
    icon: LucideIcon;
    copy: FileDropzoneCopy;
};

export function FileDropzone({
    files,
    onAdd,
    onRemove,
    onClear,
    onMove,
    disabled,
    max,
    receivesHandoff = true,
    accept,
    accepts,
    icon: Icon,
    copy,
}: FileDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const idRef = useRef(0);
    const single = max === 1;
    const t = useTranslations('Uploads');
    const count = useTranslations('Common');
    const fileSize = useFileSize();

    function loadFiles(incoming: File[]) {
        if (disabled || !incoming.length) return;

        const { accepted, problems } = acceptUploads(incoming, {
            max,
            single,
            currentCount: files.length,
            currentBytes: totalUploadBytes(files),
            accepts,
            copy: {
                full: copy.full,
                noRoom: room => t('noRoomFiles', { count: count('moreFiles', { count: room }) }),
                unsupported: copy.notAccepted,
                tooLarge: name => t('tooLarge', { name, max: MAX_FILE_SIZE_LABEL }),
                overBudget: name => t('overBudget', { name, max: MAX_BATCH_SIZE_LABEL }),
            },
        });
        const summary = uploadProblemSummary(problems, (first, extra) =>
            t('moreProblems', { first, count: extra })
        );

        if (summary) toast.error(summary);
        if (!accepted.length) return;

        onAdd(accepted.map(file => ({ file, id: `file-${(idRef.current += 1)}` })));
    }

    useHandoffIntake(loadFiles, receivesHandoff);

    const hiddenInput = (
        <input
            ref={inputRef}
            type="file"
            multiple={!single}
            accept={accept}
            className="sr-only"
            disabled={disabled}
            onChange={event => {
                loadFiles([...(event.target.files ?? [])]);
                event.target.value = '';
            }}
        />
    );

    if (files.length) {
        return (
            <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                        {copy.count(files.length)} · {fileSize(totalUploadBytes(files))}
                    </p>
                    {!single && (
                        <p className="text-sm text-muted-foreground">
                            {t('limitLine', { max, maxBatch: MAX_BATCH_SIZE_LABEL })}
                        </p>
                    )}
                </div>

                <ol className="divide-y rounded-lg border">
                    {files.map((entry, index) => (
                        <li key={entry.id} className="flex items-center gap-3 p-2">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded border bg-muted">
                                <Icon className="size-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{entry.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {single
                                        ? fileSize(entry.file.size)
                                        : `${t('position', {
                                              index: index + 1,
                                              total: files.length,
                                          })} · ${fileSize(entry.file.size)}`}
                                </p>
                            </div>
                            {onMove && (
                                <ReorderControls
                                    label={entry.file.name}
                                    index={index}
                                    count={files.length}
                                    disabled={disabled}
                                    onMove={onMove}
                                />
                            )}
                            <RemoveButton
                                label={entry.file.name}
                                disabled={disabled}
                                onClick={() => onRemove(index)}
                            />
                        </li>
                    ))}
                </ol>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || (!single && files.length >= max)}
                        onClick={() => inputRef.current?.click()}
                    >
                        {single ? t('chooseDifferent') : t('addMore')}
                    </Button>
                    {!single && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disabled}
                            onClick={onClear}
                        >
                            {t('removeAll')}
                        </Button>
                    )}
                </div>
                {hiddenInput}
            </div>
        );
    }

    return (
        <DropzoneShell
            accept={accept}
            multiple={!single}
            disabled={disabled}
            onFiles={loadFiles}
            dragIcon={<Icon className="size-6 text-primary" />}
            idleLabel={copy.idle}
            dragLabel={copy.drag}
            hint={copy.hint}
        />
    );
}
