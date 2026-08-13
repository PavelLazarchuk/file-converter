'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import type { LoadedImage } from '@/components/image-dropzone';
import { useAutoDownload } from '@/hooks/use-auto-download';
import type { ActionFailure, ActionFile, ActionResult } from '@/lib/actions';
import { downloadFile } from '@/lib/download';
import { ZIP_MIME_TYPE, countLabel } from '@/lib/image';
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

const EXIT_DURATION = 200;

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    );
}

export function useImageAction(
    action: (formData: FormData) => Promise<ActionResult>,
    zipName = 'images.zip'
) {
    const [isPending, startTransition] = useTransition();
    const [outcome, setOutcomeState] = useState<ActionOutcome | null>(null);
    const [isLeaving, setIsLeaving] = useState(false);
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

    function run(
        images: LoadedImage[],
        params: Record<string, string | File>,
        options?: RunOptions
    ) {
        cancelExit();

        startTransition(async () => {
            setOutcome(null);

            const formData = new FormData();

            for (const image of images) formData.append('file', image.file);
            for (const [key, value] of Object.entries(params)) formData.append(key, value);

            const result = await action(formData).catch((error: unknown) => {
                console.error('Server action failed:', error);

                return {
                    success: false as const,
                    error: 'The request could not be sent. Check your connection and try again.',
                };
            });

            if (!result.success) {
                toast.error(result.error);

                return;
            }

            const failures = result.failures ?? [];
            const [first] = failures;

            if (first) {
                toast.error(
                    failures.length === 1
                        ? `${first.filename}: ${first.error}`
                        : `${countLabel(failures.length, 'file')} could not be processed — ${first.filename}: ${first.error}`
                );
            }

            if (options?.onResult?.(result.files) === 'handled') return;

            setOutcome({
                files: await Promise.all(result.files.map(describe)),
                failures,
            });

            const settled = failures.length === 0 && result.files.every(file => !file.warning);

            if (autoDownload && settled) downloadResults(result.files, zipName);
        });
    }

    return { isPending, outcome, isLeaving, run, clearResult, downloadAll, autoDownload };
}
