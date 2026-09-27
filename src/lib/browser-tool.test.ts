import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { browserTool } from './browser-tool';
import { ProcessingError } from './errors';

const schema = z.object({ quality: z.string().regex(/^\d+$/).transform(Number) });

function upload() {
    return { file: new File([new Uint8Array(1)], 'a.pdf') };
}

describe('browserTool', () => {
    it('validates the raw parameters the way the server would, then passes typed values', async () => {
        const run = vi.fn(async () => []);
        const tool = browserTool(schema, run);
        const progress = vi.fn();
        const source = upload();

        await tool.inBrowser(source, { quality: 70 }, progress);

        expect(run).toHaveBeenCalledWith(source, { quality: 70 }, progress);
    });

    it('rejects settings that do not parse as invalid_settings, before any work starts', async () => {
        const run = vi.fn(async () => []);
        const tool = browserTool(schema, run);
        const attempt = tool.inBrowser(upload(), { quality: 'lots' }, vi.fn());

        await expect(attempt).rejects.toBeInstanceOf(ProcessingError);
        await expect(attempt).rejects.toMatchObject({ detail: { code: 'invalid_settings' } });
        expect(run).not.toHaveBeenCalled();
    });
});
