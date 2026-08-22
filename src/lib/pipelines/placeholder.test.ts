import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { describeOutput } from '@/test/images';
import { placeholderPipeline } from './placeholder';

const base = {
    width: 300,
    height: 200,
    bgColor: '#112233',
    textColor: '#ffffff',
    text: '',
    format: 'png',
} as const;

describe('placeholderPipeline', () => {
    it('draws the requested size in the requested format and names it after both', async () => {
        const output = await placeholderPipeline(base);
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([300, 200]);
        expect(meta.format).toBe('png');
        expect(output.filename).toBe('placeholder-300x200.png');
        expect(output.mimeType).toBe('image/png');
    });

    it('fills the background with the chosen colour', async () => {
        const output = await placeholderPipeline(base);
        const { data } = await sharp(Buffer.from(output.data)).raw().toBuffer({
            resolveWithObject: true,
        });

        expect([data[0], data[1], data[2]]).toEqual([0x11, 0x22, 0x33]);
    });

    it('escapes label text rather than letting it close the SVG', async () => {
        const output = await placeholderPipeline({ ...base, text: '<script>&"' });
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([300, 200]);
    });

    it('honours a non-default output format', async () => {
        const output = await placeholderPipeline({ ...base, format: 'webp' });

        expect((await describeOutput(output.data)).format).toBe('webp');
        expect(output.filename.endsWith('.webp')).toBe(true);
    });
});
