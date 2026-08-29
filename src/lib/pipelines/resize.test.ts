import { describe, expect, it } from 'vitest';

import { describeOutput, sourceImage } from '@/test/images';
import { resizePipeline } from './resize';

const base = {
    rotate: '0',
    fit: 'contain',
    withoutEnlargement: false,
    keepMetadata: false,
} as const;

describe('resizePipeline', () => {
    it('fits the image inside the box and names the file after the real output size', async () => {
        const source = await sourceImage('png', { width: 40, height: 20 });
        const output = await resizePipeline(source, { ...base, width: 20, height: 20 });
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([20, 20]);
        expect(output.filename).toBe('photo-20x20.png');
        expect(output.mimeType).toBe('image/png');
    });

    it('keeps the source format rather than the requested one', async () => {
        const source = await sourceImage('webp');
        const output = await resizePipeline(source, { ...base, width: 10, height: 10 });

        expect((await describeOutput(output.data)).format).toBe('webp');
        expect(output.filename.endsWith('.webp')).toBe(true);
    });

    it('leaves a smaller image alone when enlargement is refused', async () => {
        const source = await sourceImage('png', { width: 20, height: 20 });
        const output = await resizePipeline(source, {
            ...base,
            fit: 'inside',
            width: 200,
            height: 200,
            withoutEnlargement: true,
        });
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([20, 20]);
    });

    it('swaps the axes for a quarter turn before resizing', async () => {
        const source = await sourceImage('png', { width: 40, height: 20 });
        const output = await resizePipeline(source, {
            ...base,
            rotate: '90',
            fit: 'fill',
            width: 10,
            height: 30,
        });
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([10, 30]);
    });

    it('strips metadata unless it is asked to keep it', async () => {
        const source = await sourceImage('jpeg', { exif: true });
        const stripped = await resizePipeline(source, { ...base, width: 10, height: 10 });
        const kept = await resizePipeline(source, {
            ...base,
            width: 10,
            height: 10,
            keepMetadata: true,
        });

        expect((await describeOutput(stripped.data)).exif).toBeUndefined();
        expect((await describeOutput(kept.data)).exif).toBeDefined();
    });
    it('resizes every frame of an animation and names the file after one frame', async () => {
        const source = await sourceImage('webp', { frames: 3, width: 40, height: 20, noise: true });
        const output = await resizePipeline(source, { ...base, width: 20, height: 10 });
        const meta = await describeOutput(output.data);

        expect(meta.pages).toBe(3);
        expect(output.filename).toBe('photo-20x10.webp');
        expect(output.warning).toBeUndefined();
    });

    it('warns when a rotation forces the animation down to one frame', async () => {
        const source = await sourceImage('webp', { frames: 3, width: 40, height: 20, noise: true });
        const output = await resizePipeline(source, {
            ...base,
            rotate: '90',
            width: 20,
            height: 10,
        });

        expect(output.warning).toEqual({ code: 'animation_lost', frames: 3 });
    });
});
