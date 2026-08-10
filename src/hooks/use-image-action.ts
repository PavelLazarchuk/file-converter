'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import type { LoadedImage } from '@/components/image-dropzone';
import { useAutoDownload } from '@/hooks/use-auto-download';
import type { ActionResult } from '@/lib/actions';
import { downloadFile } from '@/lib/download';

export type ActionSuccess = Extract<ActionResult, { success: true }>;

export type ActionOutcome = {
    result: ActionSuccess;
    previewUrl: string | null;
    width: number | null;
    height: number | null;
};

export function downloadResult(result: ActionSuccess): void {
    downloadFile(result.data, result.filename, result.mimeType);
    toast.success(`Downloading ${result.filename}`);
}

function describe(result: ActionSuccess): Promise<ActionOutcome> {
    const bare: ActionOutcome = { result, previewUrl: null, width: null, height: null };

    if (!result.mimeType.startsWith('image/')) return Promise.resolve(bare);

    const previewUrl = URL.createObjectURL(
        new Blob([result.data as BlobPart], { type: result.mimeType })
    );

    return new Promise(resolve => {
        const probe = new window.Image();

        probe.onload = () =>
            resolve({
                result,
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

type RunOptions = {
    onResult?: (result: ActionSuccess) => 'handled' | void;
};

export function useImageAction(action: (formData: FormData) => Promise<ActionResult>) {
    const [isPending, startTransition] = useTransition();
    const [outcome, setOutcomeState] = useState<ActionOutcome | null>(null);
    const currentRef = useRef<ActionOutcome | null>(null);
    const mountedRef = useRef(true);
    const { autoDownload } = useAutoDownload();

    const setOutcome = useCallback((next: ActionOutcome | null) => {
        const previous = currentRef.current;

        if (previous?.previewUrl && previous !== next) URL.revokeObjectURL(previous.previewUrl);

        if (!mountedRef.current) {
            if (next?.previewUrl) URL.revokeObjectURL(next.previewUrl);

            return;
        }

        currentRef.current = next;
        setOutcomeState(next);
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;

            if (currentRef.current?.previewUrl) URL.revokeObjectURL(currentRef.current.previewUrl);

            currentRef.current = null;
        };
    }, []);

    const clearResult = useCallback(() => setOutcome(null), [setOutcome]);

    function run(image: LoadedImage | null, params: Record<string, string>, options?: RunOptions) {
        startTransition(async () => {
            setOutcome(null);

            const formData = new FormData();

            if (image) formData.append('file', image.file);
            for (const [key, value] of Object.entries(params)) formData.append(key, value);

            const result = await action(formData);

            if (!result.success) {
                toast.error(result.error);

                return;
            }

            if (options?.onResult?.(result) === 'handled') return;

            setOutcome(await describe(result));

            if (autoDownload && !result.warning) downloadResult(result);
        });
    }

    return { isPending, outcome, run, clearResult, autoDownload };
}
