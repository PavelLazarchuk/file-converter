import { describe, expect, it } from 'vitest';

import { describeOutput, sourceImage } from '@/test/images';
import { comparePipeline } from './compare';
import { applyQuality, compressPipeline, createDecoder } from './compress';
import { decode } from './core';

const base = { mode: 'quality', quality: 80, targetKb: 500 } as const;

describe('compressPipeline', () => {
    it('re-encodes at the requested quality and keeps the source format', async () => {
        const source = await sourceImage('jpeg', { width: 200, height: 200, noise: true });
        const output = await compressPipeline(source, { ...base, quality: 30 });

        expect((await describeOutput(output.data)).format).toBe('jpeg');
        expect(output.filename).toBe('photo-compressed.jpg');
        expect(output.mimeType).toBe('image/jpeg');
    });

    it('makes a lower quality smaller than a higher one', async () => {
        const source = await sourceImage('jpeg', { width: 200, height: 200, noise: true });
        const low = await compressPipeline(source, { ...base, quality: 20 });
        const high = await compressPipeline(source, { ...base, quality: 95 });

        expect(low.data.byteLength).toBeLessThan(high.data.byteLength);
    });

    it('hits a reachable target size without a warning', async () => {
        const source = await sourceImage('jpeg', { width: 400, height: 400, noise: true });
        const output = await compressPipeline(source, { ...base, mode: 'size', targetKb: 20 });

        expect(output.data.byteLength).toBeLessThanOrEqual(20 * 1024);
        expect(output.warning).toBeUndefined();
    });

    it('returns the smallest it managed, with a warning, when the target is out of reach', async () => {
        const source = await sourceImage('jpeg', { width: 1200, height: 1200, noise: true });
        const output = await compressPipeline(source, { ...base, mode: 'size', targetKb: 1 });

        expect(output.warning).toMatchObject({ code: 'target_missed', targetBytes: 1024 });
        expect(output.data.byteLength).toBeGreaterThan(1024);
    });
});

describe('createDecoder', () => {
    it('reuses the decoded pixels across encodes: the bytes match a plain decode', async () => {
        const source = await sourceImage('png', { width: 60, height: 40, noise: true });
        const nextPipeline = await createDecoder(source.buffer, source.metadata);
        const reused = await applyQuality(nextPipeline(), 'png', 70).toBuffer();
        const plain = await applyQuality(decode(source.buffer), 'png', 70).toBuffer();

        expect(reused.equals(plain)).toBe(true);
    });
});

describe('comparePipeline', () => {
    it('encodes one output per format, all from the same source', async () => {
        const source = await sourceImage('png', { width: 80, height: 60, noise: true });
        const outputs = await comparePipeline(source, ['jpeg', 'png', 'webp'], { quality: 70 });

        expect(outputs.map(output => output.filename)).toEqual([
            'photo.jpg',
            'photo.png',
            'photo.webp',
        ]);
        expect(await Promise.all(outputs.map(output => describeOutput(output.data)))).toMatchObject(
            [{ format: 'jpeg' }, { format: 'png' }, { format: 'webp' }]
        );
    });

    it('predicts what compressing produces, byte for byte', async () => {
        const source = await sourceImage('png', { width: 80, height: 60, noise: true });
        const [compared] = await comparePipeline(source, ['png'], { quality: 55 });
        const compressed = await compressPipeline(source, { ...base, quality: 55 });

        expect(Buffer.from(compared.data).equals(Buffer.from(compressed.data))).toBe(true);
    });
});
