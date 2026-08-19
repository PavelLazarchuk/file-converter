'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useAutoDownload } from '@/hooks/use-auto-download';
import { useActionMessage } from '@/hooks/use-messages';
import type { ActionFailure, ActionFile, ActionResult } from '@/lib/actions';
import { downloadFile } from '@/lib/download';
import { renameAll } from '@/lib/filename-template';
import { BATCH_CHUNK_SIZE, ZIP_MIME_TYPE } from '@/lib/image';
import { Logger } from '@/lib/logger';
import { useFilenameTemplate } from '@/hooks/use-filename-template';
import { createZip } from '@/lib/zip';

export type Uploaded = { file: File };

export type OutcomeFile = {
    file: ActionFile;
    previewUrl: string | null;
    width: number | null;
    height: number | null;
};

export type ActionOutcome = {
    files: OutcomeFile[];
    failures: ActionFailure[];
};

export type DownloadCopy = {
    one: (name: string) => string;
    many: (count: number, name: string) => string;
};

export function downloadResult(file: ActionFile, as: string, copy: DownloadCopy): void {
    downloadFile(file.data, as, file.mimeType);
    toast.success(copy.one(as));
}

export function outcomeNames(files: readonly OutcomeFile[], template: string): string[] {
    return renameAll(
        files.map(entry => ({
            filename: entry.file.filename,
            width: entry.width,
            height: entry.height,
        })),
        template
    );
}

export function downloadResults(
    files: OutcomeFile[],
    zipName: string,
    template: string,
    copy: DownloadCopy
): void {
    if (files.length === 0) return;

    const names = outcomeNames(files, template);

    if (files.length === 1) {
        downloadResult(files[0].file, names[0], copy);

        return;
    }

    const zip = createZip(
        files.map((entry, index) => ({ name: names[index], data: entry.file.data }))
    );

    downloadFile(zip, zipName, ZIP_MIME_TYPE);
    toast.success(copy.many(files.length, zipName));
}

function describe(file: ActionFile): Promise<OutcomeFile> {
    const bare: OutcomeFile = { file, previewUrl: null, width: null, height: null };

    if (!file.mimeType.startsWith('image/')) return Promise.resolve(bare);

    const previewUrl = URL.createObjectURL(
        new Blob([file.data as BlobPart], { type: file.mimeType })
    );

    return new Promise(resolve => {
        const probe = new window.Image();

        probe.onload = () =>
            resolve({
                file,
                previewUrl,
                width: probe.naturalWidth || null,
                height: probe.naturalHeight || null,
            });
        probe.onerror = () => {
            URL.revokeObjectURL(previewUrl);
            resolve(bare);
        };
        probe.src = previewUrl;
    });
}

function revoke(outcome: ActionOutcome | null): void {
    for (const entry of outcome?.files ?? []) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    }
}

type RunOptions = {
    onResult?: (files: ActionFile[]) => 'handled' | void;
};

export type RunParams = Record<string, string | number | boolean | File>;

export type BatchProgress = { done: number; total: number };

export type FileActionOptions = { chunkSize?: number | null };

export function chunk<Item>(items: Item[], size: number): Item[][] {
    const groups: Item[][] = [];

    for (let index = 0; index < items.length; index += size) {
        groups.push(items.slice(index, index + size));
    }

    return groups;
}

export function usePendingLabel() {
    const t = useTranslations('Common');

    return useCallback(
        (verb: string, progress: BatchProgress | null) =>
            progress ? t('progress', { verb, done: progress.done, total: progress.total }) : verb,
        [t]
    );
}

const EXIT_DURATION = 200;

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    );
}

export function useFileAction(
    action: (formData: FormData) => Promise<ActionResult>,
    zipName = 'images.zip',
    { chunkSize = BATCH_CHUNK_SIZE }: FileActionOptions = {}
) {
    const [isPending, startTransition] = useTransition();
    const [outcome, setOutcomeState] = useState<ActionOutcome | null>(null);
    const [isLeaving, setIsLeaving] = useState(false);
    const [progress, setProgress] = useState<BatchProgress | null>(null);
    const currentRef = useRef<ActionOutcome | null>(null);
    const exitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    const { autoDownload } = useAutoDownload();
    const { template } = useFilenameTemplate();
    const message = useActionMessage();
    const result = useTranslations('Result');
    const common = useTranslations('Common');
    const downloadCopy: DownloadCopy = {
        one: name => result('downloading', { name }),
        many: (count, name) =>
            result('downloadingZip', { files: common('files', { count }), name }),
    };
    const copyRef = useRef(downloadCopy);

    useEffect(() => {
        copyRef.current = downloadCopy;
    });

    const cancelExit = useCallback(() => {
        if (exitRef.current === null) return;

        clearTimeout(exitRef.current);
        exitRef.current = null;
        setIsLeaving(false);
    }, []);

    const setOutcome = useCallback((next: ActionOutcome | null) => {
        const previous = currentRef.current;

        if (previous !== next) revoke(previous);

        if (!mountedRef.current) {
            revoke(next);

            return;
        }

        currentRef.current = next;
        setOutcomeState(next);
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
            if (exitRef.current !== null) clearTimeout(exitRef.current);
            revoke(currentRef.current);
            currentRef.current = null;
        };
    }, []);

    const clearResult = useCallback(() => {
        if (exitRef.current !== null) return;
        if (!currentRef.current || prefersReducedMotion()) {
            setOutcome(null);

            return;
        }

        setIsLeaving(true);
        exitRef.current = setTimeout(() => {
            exitRef.current = null;
            setIsLeaving(false);
            setOutcome(null);
        }, EXIT_DURATION);
    }, [setOutcome]);

    const downloadAll = useCallback(() => {
        downloadResults(currentRef.current?.files ?? [], zipName, template, copyRef.current);
    }, [zipName, template]);

    const reportProgress = useCallback((next: BatchProgress | null) => {
        if (mountedRef.current) setProgress(next);
    }, []);

    function send(group: Uploaded[], params: RunParams): Promise<ActionResult> {
        const formData = new FormData();

        for (const upload of group) formData.append('file', upload.file);

        for (const [key, value] of Object.entries(params)) {
            formData.append(key, value instanceof File ? value : String(value));
        }

        return action(formData).catch((error: unknown): ActionResult => {
            Logger.error('action.transport_failed', { files: group.length, error });

            return { success: false, detail: { code: 'transport_failed' } };
        });
    }

    function run(images: Uploaded[], params: RunParams, options?: RunOptions) {
        cancelExit();

        startTransition(async () => {
            setOutcome(null);

            const groups = chunkSize && images.length ? chunk(images, chunkSize) : [images];
            const files: ActionFile[] = [];
            const failures: ActionFailure[] = [];
            let done = 0;

            reportProgress(groups.length > 1 ? { done, total: images.length } : null);

            for (const [index, group] of groups.entries()) {
                const outcome = await send(group, params);

                if (!outcome.success) {
                    if (!files.length) {
                        toast.error(message(outcome.detail));
                        reportProgress(null);

                        return;
                    }

                    for (const image of groups.slice(index).flat()) {
                        failures.push({ filename: image.file.name, detail: outcome.detail });
                    }

                    break;
                }

                files.push(...outcome.files);
                failures.push(...(outcome.failures ?? []));
                done += group.length;

                if (groups.length > 1) reportProgress({ done, total: images.length });
            }

            reportProgress(null);

            const [first] = failures;

            if (first) {
                const error = message(first.detail);

                toast.error(
                    failures.length === 1
                        ? result('failedToast', { name: first.filename, error })
                        : result('failedToastMany', {
                              files: common('files', { count: failures.length }),
                              name: first.filename,
                              error,
                          })
                );
            }

            if (options?.onResult?.(files) === 'handled') return;

            const described = await Promise.all(files.map(describe));

            setOutcome({ files: described, failures });

            const settled = failures.length === 0 && files.every(file => !file.warning);

            if (autoDownload && settled) {
                downloadResults(described, zipName, template, copyRef.current);
            }
        });
    }

    return {
        isPending,
        outcome,
        isLeaving,
        progress,
        run,
        clearResult,
        downloadAll,
        autoDownload,
    };
}
