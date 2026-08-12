import { describe, expect, it } from 'vitest';

import {
    ASPECT_RATIOS,
    CONVERT_SOURCE_KEYS,
    CONVERT_TARGET_KEYS,
    CROP_RATIO_KEYS,
    FORMAT_KEYS,
    IMAGE_FORMATS,
    MAX_BATCH_BYTES,
    MAX_BATCH_FILES,
    MAX_FILE_SIZE,
    acceptedFormatsLabel,
    centeredCrop,
    circleOutputFormat,
    clampCropBox,
    conversionTargets,
    convertSourceFromMimeType,
    convertSourceFromSharpFormat,
    countLabel,
    cropRatioLabel,
    cropRatioSize,
    defaultFreeCrop,
    fileExtension,
    fitPads,
    formatBase64Output,
    formatFileSize,
    formatFromMimeType,
    placeholderFontSize,
    placeholderLabel,
    rotationSwapsDimensions,
    sizeChange,
    stripExtension,
    uniqueFilenames,
} from './image';

describe('format tables', () => {
    it('describes every convert target', () => {
        for (const key of CONVERT_TARGET_KEYS) {
            expect(IMAGE_FORMATS[key]).toMatchObject({
                label: expect.any(String),
                mimeType: expect.any(String),
                extension: expect.any(String),
            });
        }
    });

    it('keeps ICO and base64 out of the accepted inputs', () => {
        expect(CONVERT_SOURCE_KEYS).not.toContain('ico');
        expect(CONVERT_SOURCE_KEYS).not.toContain('base64');
        expect(CONVERT_TARGET_KEYS).toContain('ico');
    });

    it('maps sharp format names onto our keys', () => {
        expect(convertSourceFromSharpFormat('jpg')).toBe('jpeg');
        expect(convertSourceFromSharpFormat('heif')).toBe('avif');
        expect(convertSourceFromSharpFormat('tiff')).toBeNull();
        expect(convertSourceFromSharpFormat(undefined)).toBeNull();
    });

    it('maps mime types back to keys', () => {
        expect(formatFromMimeType('image/webp')).toBe('webp');
        expect(formatFromMimeType('image/gif')).toBeNull();
        expect(convertSourceFromMimeType('image/gif')).toBe('gif');
        expect(convertSourceFromMimeType('application/pdf')).toBeNull();
    });
});

describe('conversionTargets', () => {
    it('drops the source format for a single image', () => {
        const targets = conversionTargets(['image/png']);

        expect(targets).not.toContain('png');
        expect(targets).toContain('jpeg');
    });

    it('keeps a format that is a real conversion for at least one image', () => {
        const targets = conversionTargets(['image/png', 'image/jpeg']);

        expect(targets).toContain('png');
        expect(targets).toContain('jpeg');
    });

    it('is empty without images', () => {
        expect(conversionTargets([])).toEqual([]);
    });
});

describe('acceptedFormatsLabel', () => {
    it('joins with a trailing "or"', () => {
        expect(acceptedFormatsLabel(['jpeg', 'png', 'webp'])).toBe('JPEG, PNG or WEBP');
        expect(acceptedFormatsLabel(['png'])).toBe('PNG');
        expect(acceptedFormatsLabel([])).toBe('');
    });
});

describe('crop geometry', () => {
    it('clamps a box to the source', () => {
        expect(clampCropBox({ left: -20, top: 500, width: 9999, height: 40 }, 100, 80)).toEqual({
            left: 0,
            top: 40,
            width: 100,
            height: 40,
        });
    });

    it('rounds fractional boxes', () => {
        expect(
            clampCropBox({ left: 10.4, top: 10.6, width: 20.5, height: 20.4 }, 100, 100)
        ).toEqual({ left: 10, top: 11, width: 21, height: 20 });
    });

    it('never returns a zero-sized box', () => {
        const box = clampCropBox({ left: 0, top: 0, width: 0, height: 0 }, 50, 50);

        expect(box.width).toBe(1);
        expect(box.height).toBe(1);
    });

    it('centers a ratio crop inside the source', () => {
        expect(centeredCrop(400, 200, 1, 1)).toEqual({
            left: 100,
            top: 0,
            width: 200,
            height: 200,
        });
        expect(centeredCrop(200, 400, 16, 9)).toEqual({
            left: 0,
            top: 143,
            width: 200,
            height: 113,
        });
    });

    it('defaults a free crop to 80% of the source', () => {
        expect(defaultFreeCrop(100, 50)).toEqual({ left: 10, top: 5, width: 80, height: 40 });
    });

    it('exposes free alongside the fixed ratios', () => {
        expect(CROP_RATIO_KEYS[0]).toBe('free');
        expect(cropRatioSize('free')).toBeNull();
        expect(cropRatioSize('16:9')).toEqual(ASPECT_RATIOS['16:9']);
        expect(cropRatioLabel('free')).toBe('Free — any size');
    });

    it('exports circular JPEG crops as PNG so the corners stay transparent', () => {
        expect(circleOutputFormat('jpeg')).toBe('png');
        expect(circleOutputFormat('webp')).toBe('webp');
    });
});

describe('resize helpers', () => {
    it('knows which rotations swap the dimensions', () => {
        expect(rotationSwapsDimensions('90')).toBe(true);
        expect(rotationSwapsDimensions('270')).toBe(true);
        expect(rotationSwapsDimensions('180')).toBe(false);
        expect(rotationSwapsDimensions('0')).toBe(false);
    });

    it('only pads on contain', () => {
        expect(fitPads('contain')).toBe(true);
        expect(fitPads('cover')).toBe(false);
    });
});

describe('filenames', () => {
    it('strips and reads extensions', () => {
        expect(stripExtension('holiday.photo.jpg')).toBe('holiday.photo');
        expect(stripExtension('noextension')).toBe('noextension');
        expect(fileExtension('holiday.photo.jpg')).toBe('jpg');
        expect(fileExtension('noextension')).toBe('');
    });

    it('deduplicates collisions without touching the first use', () => {
        expect(uniqueFilenames(['a.png', 'b.png', 'a.png', 'a.png'])).toEqual([
            'a.png',
            'b.png',
            'a-2.png',
            'a-3.png',
        ]);
    });

    it('does not reuse a name a later file already claims', () => {
        expect(uniqueFilenames(['a.png', 'a-2.png', 'a.png'])).toEqual([
            'a.png',
            'a-2.png',
            'a-3.png',
        ]);
    });

    it('handles names without an extension', () => {
        expect(uniqueFilenames(['README', 'README'])).toEqual(['README', 'README-2']);
    });
});

describe('formatting', () => {
    it('scales byte counts', () => {
        expect(formatFileSize(512)).toBe('512 B');
        expect(formatFileSize(2048)).toBe('2.0 KB');
        expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });

    it('pluralizes counts', () => {
        expect(countLabel(1, 'image')).toBe('1 image');
        expect(countLabel(3, 'result')).toBe('3 results');
        expect(countLabel(0, 'file')).toBe('0 files');
    });

    it('reports the size delta with a direction', () => {
        expect(sizeChange(1000, 500)).toEqual({ direction: 'smaller', label: '−50%' });
        expect(sizeChange(1000, 1500)).toEqual({ direction: 'larger', label: '+50%' });
        expect(sizeChange(1000, 1000)).toEqual({ direction: 'same', label: 'no change' });
        expect(sizeChange(0, 100)).toEqual({ direction: 'same', label: 'no change' });
        expect(sizeChange(100_000, 99_999)).toEqual({ direction: 'same', label: 'no change' });
    });
});

describe('base64 snippets', () => {
    const uri = 'data:image/png;base64,AAAA';

    it('wraps the data URI for each output kind', () => {
        expect(formatBase64Output('uri', uri, 'cat')).toBe(uri);
        expect(formatBase64Output('img', uri, 'cat')).toBe(`<img src="${uri}" alt="cat" />`);
        expect(formatBase64Output('css', uri, 'cat')).toContain(`url('${uri}')`);
    });
});

describe('placeholder text', () => {
    it('falls back to the dimensions', () => {
        expect(placeholderLabel('', 600, 400)).toBe('600 × 400');
        expect(placeholderLabel('Hero', 600, 400)).toBe('Hero');
    });

    it('shrinks the font so long labels fit', () => {
        expect(placeholderFontSize(600, 400, '600 × 400')).toBeGreaterThan(0);
        expect(placeholderFontSize(600, 400, 'x'.repeat(60))).toBeLessThan(
            placeholderFontSize(600, 400, 'x')
        );
        expect(placeholderFontSize(10, 10, 'x'.repeat(60))).toBeGreaterThanOrEqual(4);
    });
});

describe('limits', () => {
    it('keeps the batch total within the per-file cap', () => {
        expect(MAX_BATCH_BYTES).toBeLessThanOrEqual(MAX_FILE_SIZE);
        expect(MAX_BATCH_FILES).toBeGreaterThan(1);
    });

    it('accepts the four editable formats everywhere', () => {
        expect(FORMAT_KEYS.every(key => CONVERT_SOURCE_KEYS.includes(key))).toBe(true);
    });
});
