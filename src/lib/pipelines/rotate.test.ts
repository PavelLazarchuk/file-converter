import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { describeOutput, sourceImage } from '@/test/images';
import { rotatePipeline } from './rotate';

const base = {
    angle: 0,
    background: '#ffffff',
    flipHorizontal: false,
    flipVertical: false,
    transparent: false,
    keepMetadata: false,
} as const;

async function corner(data: Buffer | Uint8Array) {
    const { data: raw } = await sharp(Buffer.from(data))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    return [raw[0], raw[1], raw[2], raw[3]];
}

describe('rotatePipeline', () => {
    it('swaps the axes on a quarter turn and names the file after the angle', async () => {
        const source = await sourceImage('png', { width: 40, height: 30 });
        const output = await rotatePipeline(source, { ...base, angle: 90 });
        const meta = await describeOutput(output.data);

        expect([meta.width, meta.height]).toEqual([30, 40]);
        expect(output.filename).toBe('photo-90deg.png');
    });

    it('names a pure flip after the flip', async () => {
        const source = await sourceImage('png');
        const output = await rotatePipeline(source, {
            ...base,
            flipHorizontal: true,
            flipVertical: true,
        });

        expect(output.filename).toBe('photo-mirrored-flipped.png');
    });

    it('falls back to a generic name when nothing was asked for', async () => {
        const source = await sourceImage('png');

        expect((await rotatePipeline(source, base)).filename).toBe('photo-rotated.png');
    });

    it('fills the corners of an odd angle with the chosen background', async () => {
        const source = await sourceImage('png', { width: 40, height: 30 });
        const output = await rotatePipeline(source, { ...base, angle: 45, background: '#00ff00' });

        expect(await corner(output.data)).toEqual([0, 255, 0, 255]);
    });

    it('fills them transparently instead when the source format has an alpha channel', async () => {
        const source = await sourceImage('png', { width: 40, height: 30 });
        const output = await rotatePipeline(source, { ...base, angle: 45, transparent: true });
        const [, , , alpha] = await corner(output.data);

        expect(alpha).toBe(0);
    });

    it('ignores the transparent request for JPEG, which cannot carry alpha', async () => {
        const source = await sourceImage('jpeg', { width: 40, height: 30 });
        const output = await rotatePipeline(source, {
            ...base,
            angle: 45,
            transparent: true,
            background: '#00ff00',
        });
        const [red, green, blue] = await corner(output.data);

        expect((await describeOutput(output.data)).format).toBe('jpeg');
        expect([red, green, blue]).toEqual([0, 255, 0]);
    });
});
