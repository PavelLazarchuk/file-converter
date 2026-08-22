import { describe, expect, it } from 'vitest';

import { FAVICON_PACK } from '../image';
import { describeOutput, sourceImage } from '@/test/images';
import { ProcessingError } from './core';
import { convertPipeline } from './convert';

const base = { keepMetadata: false, ico: null } as const;

function icoSizes(ico: Buffer): number[] {
    const count = ico.readUInt16LE(4);

    return Array.from({ length: count }, (_, index) => ico[6 + index * 16] || 256);
}

function zipNames(zip: Buffer): string[] {
    const names: string[] = [];

    for (let at = 0; at + 30 <= zip.length; at += 1) {
        if (zip.readUInt32LE(at) !== 0x04034b50) continue;

        const length = zip.readUInt16LE(at + 26);

        names.push(zip.subarray(at + 30, at + 30 + length).toString('utf8'));
    }

    return names;
}

describe('convertPipeline', () => {
    it('re-encodes to the target format', async () => {
        const source = await sourceImage('png');
        const output = await convertPipeline(source, { ...base, target: 'webp' });

        expect((await describeOutput(output.data)).format).toBe('webp');
        expect(output.filename).toBe('photo.webp');
        expect(output.mimeType).toBe('image/webp');
    });

    it('refuses a conversion that would change nothing', async () => {
        const source = await sourceImage('png');

        await expect(convertPipeline(source, { ...base, target: 'png' })).rejects.toMatchObject({
            code: 'same_format',
        });
    });

    it('flattens transparency onto white for JPEG', async () => {
        const source = await sourceImage('png', { alpha: true });
        const output = await convertPipeline(source, { ...base, target: 'jpeg' });

        expect((await describeOutput(output.data)).hasAlpha).toBe(false);
    });

    it('emits a data URI for base64, not an image', async () => {
        const source = await sourceImage('png');
        const output = await convertPipeline(source, { ...base, target: 'base64' });

        expect(Buffer.from(output.data).toString('utf8')).toMatch(
            /^data:image\/png;base64,[\w+/=]+$/
        );
        expect(output.filename).toBe('photo-base64.txt');
    });

    it('wraps the image in an SVG that embeds a PNG, rather than tracing it', async () => {
        const source = await sourceImage('jpeg', { width: 12, height: 8 });
        const output = await convertPipeline(source, { ...base, target: 'svg' });
        const svg = Buffer.from(output.data).toString('utf8');

        expect(svg.startsWith('<svg xmlns=')).toBe(true);
        expect(svg).toContain('width="12" height="8"');
        expect(svg).toContain('xlink:href="data:image/png;base64,');
        expect(output.mimeType).toBe('image/svg+xml');
    });

    it('builds a multi-size ICO when the pack is off', async () => {
        const source = await sourceImage('png', { width: 64, height: 64 });
        const output = await convertPipeline(source, {
            ...base,
            target: 'ico',
            ico: { sizes: [16, 32], pack: 'false' },
        });

        expect(icoSizes(Buffer.from(output.data))).toEqual([16, 32]);
        expect(output.filename).toBe('photo.ico');
    });

    it('zips a whole favicon pack when the pack is on', async () => {
        const source = await sourceImage('png', { width: 64, height: 64 });
        const output = await convertPipeline(source, {
            ...base,
            target: 'ico',
            ico: { sizes: [16], pack: 'true' },
        });
        const names = zipNames(Buffer.from(output.data));

        expect(names).toContain('favicon.ico');
        expect(names).toContain('apple-touch-icon.png');
        expect(names).toContain('site.webmanifest');
        expect(names).toEqual(
            expect.arrayContaining(FAVICON_PACK.manifestSizes.map(size => `icon-${size}.png`))
        );
        expect(output.filename).toBe('photo-favicons.zip');
    });

    it('rejects an ICO target with no options rather than guessing sizes', async () => {
        const source = await sourceImage('png');

        await expect(convertPipeline(source, { ...base, target: 'ico' })).rejects.toBeInstanceOf(
            ProcessingError
        );
    });
});
