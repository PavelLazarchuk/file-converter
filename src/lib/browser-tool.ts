import type { z } from 'zod';

import type { RunParams, Uploaded } from '@/hooks/use-file-action';
import type { ActionFile } from './actions';
import { invalid } from './errors';

export type BrowserProgress = (done: number, total: number) => void;

export type BrowserTool = {
    inBrowser: (
        upload: Uploaded,
        params: RunParams,
        progress: BrowserProgress
    ) => Promise<ActionFile[]>;
};

export function browserTool<Schema extends z.ZodType>(
    schema: Schema,
    run: (
        upload: Uploaded,
        values: z.output<Schema>,
        progress: BrowserProgress
    ) => Promise<ActionFile[]>
): BrowserTool {
    return {
        async inBrowser(upload, params, progress) {
            const parsed = schema.safeParse(
                Object.fromEntries(
                    Object.entries(params).map(([key, value]) => [
                        key,
                        value instanceof File ? value : String(value),
                    ])
                )
            );

            if (!parsed.success) throw invalid(parsed.error);

            return run(upload, parsed.data, progress);
        },
    };
}

export function yieldToBrowser(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}
