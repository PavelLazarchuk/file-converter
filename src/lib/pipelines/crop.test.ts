import { describe, expect, it } from 'vitest';

import { describeOutput, sourceImage } from '@/test/images';
import { cropPipeline } from './crop';

const box = { ratio: 'free', shape: 'rectangle', left: 5, top: 5, width: 20, height: 10 } as const;

describe('cropPipeline', () => {
    it('extracts the requested box and names a free crop after its pixel size', async () => {
        const source = await sourceImage('png', { width: 40, height: 30 });
        const output = await cropPipeline(source, { ...box, target: null, keepMetadata: false });
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([20, 10]);
        expect(output.filename).toBe('photo-20x10.png');
    });

    it('names a fixed-ratio crop after the ratio', async () => {
        const source = await sourceImage('png', { width: 40, height: 30 });
        const output = await cropPipeline(source, {
            ...box,
            ratio: '16:9',
            target: null,
            keepMetadata: false,
        });

        expect(output.filename).toBe('photo-16x9.png');
    });

    it('clamps a box that runs past the edge instead of failing', async () => {
        const source = await sourceImage('png', { width: 40, height: 30 });
        const output = await cropPipeline(source, {
            ...box,
            left: 35,
            top: 25,
            width: 100,
            height: 100,
            target: null,
            keepMetadata: false,
        });
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([40, 30]);
    });

    it('scales the extracted frame to the requested output size', async () => {
        const source = await sourceImage('png', { width: 40, height: 30 });
        const output = await cropPipeline(source, {
            ...box,
            target: { width: 100, height: 50 },
            keepMetadata: false,
        });
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([100, 50]);
        expect(output.filename).toBe('photo-100x50.png');
    });

    it('leaves a circle crop transparent, so a JPEG source comes back as a PNG', async () => {
        const source = await sourceImage('jpeg', { width: 40, height: 30 });
        const output = await cropPipeline(source, {
            ...box,
            shape: 'circle',
            target: null,
            keepMetadata: false,
        });
        const meta = await describeOutput(output.data);

        expect(meta.format).toBe('png');
        expect(meta.hasAlpha).toBe(true);
        expect(output.filename).toBe('photo-20x10-circle.png');
        expect(output.mimeType).toBe('image/png');
    });
});
