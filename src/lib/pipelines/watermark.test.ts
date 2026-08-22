import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { describeOutput, imageBuffer, sourceImage } from '@/test/images';
import { watermarkPipeline } from './watermark';

const base = {
    mode: 'text',
    text: 'Sample',
    color: '#ffffff',
    position: 'bottom-right',
    opacity: 100,
    scale: 30,
    margin: 10,
    logo: null,
    keepMetadata: false,
} as const;

async function logoOf(size: number) {
    const buffer = await imageBuffer('png', { width: size, height: size, noise: true });

    return { buffer, size: { width: size, height: size } };
}

async function pixelDistance(before: Buffer, after: Buffer | Uint8Array): Promise<number> {
    const [left, right] = await Promise.all(
        [before, Buffer.from(after)].map(data => sharp(data).ensureAlpha().raw().toBuffer())
    );
    let distance = 0;

    for (let at = 0; at < left.length; at += 1) distance += Math.abs(left[at] - right[at]);

    return distance;
}

describe('watermarkPipeline', () => {
    it('marks the image without changing its size or format', async () => {
        const source = await sourceImage('png', { width: 200, height: 120 });
        const output = await watermarkPipeline(source, base);
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([200, 120]);
        expect(meta.format).toBe('png');
        expect(output.filename).toBe('photo-watermarked.png');
        expect(await pixelDistance(source.buffer, output.data)).toBeGreaterThan(0);
    });

    it('puts the mark where it was asked to: opposite corners differ', async () => {
        const source = await sourceImage('png', { width: 200, height: 120 });
        const topLeft = await watermarkPipeline(source, { ...base, position: 'top-left' });
        const bottomRight = await watermarkPipeline(source, { ...base, position: 'bottom-right' });

        expect(Buffer.from(topLeft.data).equals(Buffer.from(bottomRight.data))).toBe(false);
    });

    it('fades the overlay, so a lower opacity disturbs fewer pixels', async () => {
        const source = await sourceImage('png', { width: 200, height: 120 });
        const solid = await watermarkPipeline(source, { ...base, opacity: 100 });
        const faint = await watermarkPipeline(source, { ...base, opacity: 10 });

        expect(await pixelDistance(source.buffer, faint.data)).toBeLessThan(
            await pixelDistance(source.buffer, solid.data)
        );
    });

    it('composites a logo overlay too', async () => {
        const source = await sourceImage('png', { width: 200, height: 120 });
        const output = await watermarkPipeline(source, { ...base, logo: await logoOf(40) });

        expect(await pixelDistance(source.buffer, output.data)).toBeGreaterThan(0);
    });

    it('clamps a logo larger than the photo, which sharp would otherwise refuse', async () => {
        const source = await sourceImage('png', { width: 60, height: 40 });
        const output = await watermarkPipeline(source, {
            ...base,
            scale: 100,
            margin: 0,
            logo: await logoOf(400),
        });
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([60, 40]);
    });
});
