'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import type { LoadedImage } from '@/components/image-dropzone';
import type { ActionResult } from '@/lib/actions';
import { downloadFile } from '@/lib/download';

export type ActionSuccess = Extract<ActionResult, { success: true }>;

export function useImageAction(action: (formData: FormData) => Promise<ActionResult>) {
    const [isPending, startTransition] = useTransition();

    function run(
        image: LoadedImage | null,
        params: Record<string, string>,
        onSuccess?: (result: ActionSuccess) => void
    ) {
        startTransition(async () => {
            const formData = new FormData();

            if (image) formData.append('file', image.file);
            for (const [key, value] of Object.entries(params)) formData.append(key, value);

            const result = await action(formData);

            if (!result.success) {
                toast.error(result.error);
            } else if (onSuccess) {
                onSuccess(result);
            } else {
                downloadFile(result.data, result.filename, result.mimeType);
                toast.success(`Downloading ${result.filename}`);
            }
        });
    }

    return { isPending, run };
}
