'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import type { LoadedImage } from '@/components/image-dropzone';
import { useAutoDownload } from '@/hooks/use-auto-download';
import type { ActionFailure, ActionFile, ActionResult } from '@/lib/actions';
import { downloadFile } from '@/lib/download';
import { actionErrorMessage } from '@/lib/errors';
import { BATCH_CHUNK_SIZE, ZIP_MIME_TYPE, countLabel } from '@/lib/image';
import { Logger } from '@/lib/logger';
import { createZip } from '@/lib/zip';

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

export function downloadResult(file: ActionFile): void {
    downloadFile(file.data, file.filename, file.mimeType);
    toast.success(`Downloading ${file.filename}`);
}

export function downloadResults(files: ActionFile[], zipName: string): void {
    if (files.length === 0) return;
    if (files.length === 1) {
        downloadResult(files[0]);

        return;
    }

    const zip = createZip(files.map(file => ({ name: file.filename, data: file.data })));

    downloadFile(zip, zipName, ZIP_MIME_TYPE);
    toast.success(`Downloading ${countLabel(files.length, 'file')} as ${zipName}`);
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

export type ImageActionOptions = { chunkSize?: number | null };

export function chunk<Item>(items: Item[], size: number): Item[][] {
    const groups: Item[][] = [];

    for (let index = 0; index < items.length; index += size) {
        groups.push(items.slice(index, index + size));
    }

    return groups;
}

export function pendingLabel(verb: string, progress: BatchProgress | null): string {
    return progress ? `${verb} ${progress.done}/${progress.total}` : verb;
}

const EXIT_DURATION = 200;

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    );
}

export function useImageAction(
    action: (formData: FormData) => Promise<ActionResult>,
    zipName = 'images.zip',
    { chunkSize = BATCH_CHUNK_SIZE }: ImageActionOptions = {}
) {
    const [isPending, startTransition] = useTransition();
    const [outcome, setOutcomeState] = useState<ActionOutcome | null>(null);
    const [isLeaving, setIsLeaving] = useState(false);
    const [progress, setProgress] = useState<BatchProgress | null>(null);
    const currentRef = useRef<ActionOutcome | null>(null);
    const exitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    const { autoDownload } = useAutoDownload();

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
        const files = currentRef.current?.files.map(entry => entry.file) ?? [];

        downloadResults(files, zipName);
    }, [zipName]);

    const reportProgress = useCallback((next: BatchProgress | null) => {
        if (mountedRef.current) setProgress(next);
    }, []);

    function send(group: LoadedImage[], params: RunParams): Promise<ActionResult> {
        const formData = new FormData();

        for (const image of group) formData.append('file', image.file);

        for (const [key, value] of Object.entries(params)) {
            formData.append(key, value instanceof File ? value : String(value));
        }

        return action(formData).catch((error: unknown): ActionResult => {
            Logger.error('action.transport_failed', { files: group.length, error });

            return {
                success: false,
                code: 'transport_failed',
                error: actionErrorMessage({ code: 'transport_failed' }),
            };
        });
    }

    function run(images: LoadedImage[], params: RunParams, options?: RunOptions) {
        cancelExit();

        startTransition(async () => {
            setOutcome(null);

            const groups = chunkSize && images.length ? chunk(images, chunkSize) : [images];
            const files: ActionFile[] = [];
            const failures: ActionFailure[] = [];
            let done = 0;

            reportProgress(groups.length > 1 ? { done, total: images.length } : null);

            for (const [index, group] of groups.entries()) {
                const result = await send(group, params);

                if (!result.success) {
                    if (!files.length) {
                        toast.error(result.error);
                        reportProgress(null);

                        return;
                    }

                    for (const image of groups.slice(index).flat()) {
                        failures.push({
                            filename: image.file.name,
                            code: result.code,
                            error: result.error,
                        });
                    }

                    break;
                }

                files.push(...result.files);
                failures.push(...(result.failures ?? []));
                done += group.length;

                if (groups.length > 1) reportProgress({ done, total: images.length });
            }

            reportProgress(null);

            const [first] = failures;

            if (first) {
                toast.error(
                    failures.length === 1
                        ? `${first.filename}: ${first.error}`
                        : `${countLabel(failures.length, 'file')} could not be processed — ${first.filename}: ${first.error}`
                );
            }

            if (options?.onResult?.(files) === 'handled') return;

            setOutcome({ files: await Promise.all(files.map(describe)), failures });

            const settled = failures.length === 0 && files.every(file => !file.warning);

            if (autoDownload && settled) downloadResults(files, zipName);
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
