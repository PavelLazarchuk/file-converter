import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { describeOutput, sourceImage } from '@/test/images';
import { filterPipeline } from './filter';

const base = {
    effect: 'none',
    brightness: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    sharpen: false,
    keepMetadata: false,
} as const;

async function firstPixel(data: Buffer | Uint8Array) {
    const { data: raw } = await sharp(Buffer.from(data))
        .raw()
        .toBuffer({ resolveWithObject: true });

    return [raw[0], raw[1], raw[2]];
}

describe('filterPipeline', () => {
    it('names the file after the effect, and generically when there is none', async () => {
        const source = await sourceImage('png');

        expect((await filterPipeline(source, base)).filename).toBe('photo-filtered.png');
        expect((await filterPipeline(source, { ...base, effect: 'sepia' })).filename).toBe(
            'photo-sepia.png'
        );
    });

    it('flattens the channels to one value for grayscale', async () => {
        const source = await sourceImage('png');
        const output = await filterPipeline(source, { ...base, effect: 'grayscale' });
        const [red, green, blue] = await firstPixel(output.data);

        expect(red).toBe(green);
        expect(green).toBe(blue);
    });

    it('inverts every channel', async () => {
        const source = await sourceImage('png');
        const before = await firstPixel(source.buffer);
        const after = await firstPixel(
            (await filterPipeline(source, { ...base, effect: 'invert' })).data
        );

        expect(after).toEqual(before.map(channel => 255 - channel));
    });

    it('brightens without leaving the source format', async () => {
        const source = await sourceImage('webp');
        const output = await filterPipeline(source, { ...base, brightness: 200 });
        const [red] = await firstPixel(output.data);
        const [wasRed] = await firstPixel(source.buffer);

        expect(red).toBeGreaterThan(wasRed);
        expect((await describeOutput(output.data)).format).toBe('webp');
    });

    it('keeps metadata only on request', async () => {
        const source = await sourceImage('jpeg', { exif: true });
        const stripped = await filterPipeline(source, { ...base, effect: 'sepia' });
        const kept = await filterPipeline(source, {
            ...base,
            effect: 'sepia',
            keepMetadata: true,
        });

        expect((await describeOutput(stripped.data)).exif).toBeUndefined();
        expect((await describeOutput(kept.data)).exif).toBeDefined();
    });
});
