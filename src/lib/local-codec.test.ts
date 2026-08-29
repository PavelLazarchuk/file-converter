import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { imageBuffer } from '@/test/images';
import {
    LOCAL_MAX_FILE_SIZE,
    type LocalSource,
    fitsLocalBudget,
    isLocalCodec,
    localCompressible,
    localConvertible,
    sniffCodec,
} from './local-codec';

function upload(name: string, bytes: number, size?: [number, number]): LocalSource {
    return {
        file: new File([new Uint8Array(bytes)], name),
        ...(size ? { width: size[0], height: size[1] } : {}),
    };
}

describe('sniffCodec', () => {
    it.each(['jpeg', 'png', 'webp'] as const)('recognises a real %s by its bytes', async format => {
        const bytes = new Uint8Array(await imageBuffer(format));

        expect(sniffCodec(bytes)).toBe(format);
    });

    it('recognises nothing in a format the codecs cannot open', async () => {
        const gif = new Uint8Array(await imageBuffer('gif'));
        const tiff = new Uint8Array(
            await sharp(await imageBuffer('png'))
                .tiff()
                .toBuffer()
        );

        expect(sniffCodec(gif)).toBeNull();
        expect(sniffCodec(tiff)).toBeNull();
        expect(sniffCodec(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    });

    it('does not mistake a RIFF container that is not WEBP', () => {
        const wav = new Uint8Array([
            0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
        ]);

        expect(sniffCodec(wav)).toBeNull();
    });
});

describe('choosing between the browser and the server', () => {
    it('takes a small JPEG in the browser and leaves an oversized one to the server', async () => {
        const bytes = new Uint8Array(await imageBuffer('jpeg'));

        expect(localCompressible(upload('a.jpg', 1000), bytes, 'quality')).toBe('jpeg');
        expect(
            localCompressible(upload('a.jpg', LOCAL_MAX_FILE_SIZE + 1), bytes, 'quality')
        ).toBeNull();
    });

    it('leaves the target-size search to the server, which can iterate', async () => {
        const bytes = new Uint8Array(await imageBuffer('jpeg'));

        expect(localCompressible(upload('a.jpg', 1000), bytes, 'size')).toBeNull();
    });

    it('leaves PNG compression to sharp, which can quantize a palette', async () => {
        const bytes = new Uint8Array(await imageBuffer('png'));

        expect(localCompressible(upload('a.png', 1000), bytes, 'quality')).toBeNull();
    });

    it('converts between the three codecs it carries', async () => {
        const bytes = new Uint8Array(await imageBuffer('jpeg'));

        expect(localConvertible(upload('a.jpg', 1000), bytes, 'webp', false)).toBe('webp');
        expect(localConvertible(upload('a.jpg', 1000), bytes, 'png', false)).toBe('png');
    });

    it('hands anything it cannot encode back to the server', async () => {
        const bytes = new Uint8Array(await imageBuffer('jpeg'));
        const file = upload('a.jpg', 1000);

        expect(localConvertible(file, bytes, 'avif', false)).toBeNull();
        expect(localConvertible(file, bytes, 'ico', false)).toBeNull();
        expect(localConvertible(file, bytes, 'svg', false)).toBeNull();
        expect(localConvertible(file, bytes, 'base64', false)).toBeNull();
        expect(localConvertible(file, bytes, 'gif', false)).toBeNull();
    });

    it('never runs locally when the metadata has to survive, because the codecs drop it', async () => {
        const bytes = new Uint8Array(await imageBuffer('jpeg', { exif: true }));

        expect(localConvertible(upload('a.jpg', 1000), bytes, 'webp', true)).toBeNull();
    });

    it('leaves a same-format request to the server, which owns the same_format error', async () => {
        const bytes = new Uint8Array(await imageBuffer('png'));

        expect(localConvertible(upload('a.png', 1000), bytes, 'png', false)).toBeNull();
    });

    it('leaves a source it cannot decode to the server', async () => {
        const bytes = new Uint8Array(await imageBuffer('gif'));

        expect(localConvertible(upload('a.gif', 1000), bytes, 'png', false)).toBeNull();
        expect(localCompressible(upload('a.gif', 1000), bytes, 'quality')).toBeNull();
    });

    it('rejects an empty upload rather than encoding nothing', () => {
        expect(fitsLocalBudget(upload('a.jpg', 0))).toBe(false);
        expect(isLocalCodec('avif')).toBe(false);
        expect(isLocalCodec('webp')).toBe(true);
    });

    it('leaves an image past the pixel limit to the server, which owns pixel_limit', async () => {
        const bytes = new Uint8Array(await imageBuffer('jpeg'));
        const huge = upload('a.jpg', 1000, [12000, 12000]);

        expect(fitsLocalBudget(huge)).toBe(false);
        expect(localCompressible(huge, bytes, 'quality')).toBeNull();
        expect(localConvertible(huge, bytes, 'webp', false)).toBeNull();
        expect(fitsLocalBudget(upload('a.jpg', 1000, [4000, 3000]))).toBe(true);
    });
});
