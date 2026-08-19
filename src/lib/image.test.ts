import { describe, expect, it } from 'vitest';

import {
    ASPECT_RATIOS,
    CONVERT_SOURCE_KEYS,
    CONVERT_TARGET_KEYS,
    CROP_RATIO_KEYS,
    DIMENSION_LIMITS,
    FORMAT_KEYS,
    SIZE_PRESETS,
    IMAGE_FORMATS,
    MAX_BATCH_BYTES,
    MAX_BATCH_FILES,
    MAX_FILE_SIZE,
    centeredCrop,
    circleOutputFormat,
    clampCropBox,
    conversionTargets,
    convertSourceFromMimeType,
    convertSourceFromSharpFormat,
    cropRatioForSize,
    cropRatioSize,
    defaultFreeCrop,
    fileExtension,
    fitPads,
    formatBase64Output,
    formatFileSize,
    formatFromMimeType,
    placeholderFontSize,
    placeholderLabel,
    rotateFillsCorners,
    rotateSuffix,
    filterCss,
    filterSuffix,
    filtersChangeNothing,
    FILTER_PRESETS,
    type FilterOptions,
    rotationSwapsDimensions,
    sizeChange,
    sizePreset,
    stripExtension,
    uniqueFilenames,
    watermarkLogoLayout,
    watermarkOffset,
    watermarkSvg,
    watermarkTextLayout,
} from './image';

describe('format tables', () => {
    it('describes every convert target', () => {
        for (const key of CONVERT_TARGET_KEYS) {
            expect(IMAGE_FORMATS[key]).toMatchObject({
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

    it('reports the size delta with a direction', () => {
        expect(sizeChange(1000, 500)).toEqual({ direction: 'smaller', percent: 50 });
        expect(sizeChange(1000, 1500)).toEqual({ direction: 'larger', percent: 50 });
        expect(sizeChange(1000, 1000)).toEqual({ direction: 'same', percent: 0 });
        expect(sizeChange(0, 100)).toEqual({ direction: 'same', percent: 0 });
        expect(sizeChange(100_000, 99_999)).toEqual({ direction: 'same', percent: 0 });
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

describe('filters', () => {
    const neutral: FilterOptions = {
        effect: 'none',
        brightness: 100,
        saturation: 100,
        hue: 0,
        blur: 0,
        sharpen: false,
    };

    it('treats every dial at its neutral value as a no-op', () => {
        expect(filtersChangeNothing(neutral)).toBe(true);
        expect(filtersChangeNothing({ ...neutral, effect: 'sepia' })).toBe(false);
        expect(filtersChangeNothing({ ...neutral, brightness: 101 })).toBe(false);
        expect(filtersChangeNothing({ ...neutral, saturation: 99 })).toBe(false);
        expect(filtersChangeNothing({ ...neutral, hue: 1 })).toBe(false);
        expect(filtersChangeNothing({ ...neutral, blur: 1 })).toBe(false);
        expect(filtersChangeNothing({ ...neutral, sharpen: true })).toBe(false);
    });

    it('names the output after the effect, or generically without one', () => {
        expect(filterSuffix({ ...neutral, effect: 'grayscale' })).toBe('grayscale');
        expect(filterSuffix({ ...neutral, brightness: 130 })).toBe('filtered');
    });

    it('builds a CSS filter that lists only the dials that moved', () => {
        expect(filterCss(neutral)).toBe('none');
        expect(filterCss({ ...neutral, effect: 'invert', brightness: 120 })).toBe(
            'invert(1) brightness(1.2)'
        );
        expect(filterCss({ ...neutral, saturation: 0, hue: 180, blur: 3 })).toBe(
            'saturate(0) hue-rotate(180deg) blur(3px)'
        );
    });

    it('ships presets that all do something', () => {
        for (const preset of Object.values(FILTER_PRESETS)) {
            expect(filtersChangeNothing(preset)).toBe(false);
        }
    });
});

describe('rotation naming', () => {
    it('records every operation that was applied', () => {
        expect(rotateSuffix({ angle: 90, flipHorizontal: false, flipVertical: false })).toBe(
            '90deg'
        );
        expect(rotateSuffix({ angle: 0, flipHorizontal: true, flipVertical: false })).toBe(
            'mirrored'
        );
        expect(rotateSuffix({ angle: 45, flipHorizontal: true, flipVertical: true })).toBe(
            '45deg-mirrored-flipped'
        );
        expect(rotateSuffix({ angle: 0, flipHorizontal: false, flipVertical: false })).toBe(
            'rotated'
        );
    });

    it('knows which angles expose corners', () => {
        expect(rotateFillsCorners(0)).toBe(false);
        expect(rotateFillsCorners(270)).toBe(false);
        expect(rotateFillsCorners(45)).toBe(true);
    });
});

describe('size presets', () => {
    it('gives every preset a unique key and a usable box', () => {
        const keys = SIZE_PRESETS.map(preset => preset.key);

        expect(new Set(keys).size).toBe(keys.length);

        for (const preset of SIZE_PRESETS) {
            expect(preset.width).toBeGreaterThan(0);
            expect(preset.width).toBeLessThanOrEqual(DIMENSION_LIMITS.max);
            expect(preset.height).toBeLessThanOrEqual(DIMENSION_LIMITS.max);
            expect(preset.height).toBeGreaterThan(0);
        }
    });

    it('matches a preset to the named ratio the crop select shows', () => {
        expect(cropRatioForSize({ width: 1080, height: 1080 })).toBe('1:1');
        expect(cropRatioForSize({ width: 1080, height: 1920 })).toBe('9:16');
        expect(cropRatioForSize({ width: 1280, height: 720 })).toBe('16:9');
        expect(cropRatioForSize({ width: 1200, height: 630 })).toBe('free');
    });

    it('looks a preset up by key', () => {
        expect(sizePreset('avatar')).toMatchObject({ width: 400, height: 400 });
        expect(sizePreset('nope')).toBeNull();
        expect(sizePreset(null)).toBeNull();
    });
});

describe('watermark layout', () => {
    const image = { width: 1000, height: 800 };

    it('sizes text against the share of the width it should cover', () => {
        const quarter = watermarkTextLayout(image, 25, 'Hello');
        const half = watermarkTextLayout(image, 50, 'Hello');

        expect(quarter.width).toBeLessThan(half.width);
        expect(quarter.width).toBeGreaterThan(0);
        expect(half.fontSize).toBeGreaterThan(quarter.fontSize);
    });

    it('never builds an overlay larger than the image', () => {
        const wide = watermarkTextLayout({ width: 40, height: 20 }, 100, 'a very long watermark');
        const tall = watermarkTextLayout({ width: 200, height: 12 }, 100, 'x');

        expect(wide.width).toBeLessThanOrEqual(40);
        expect(wide.height).toBeLessThanOrEqual(20);
        expect(tall.height).toBeLessThanOrEqual(12);
    });

    it('scales a logo to the requested share of the width, keeping its ratio', () => {
        const layout = watermarkLogoLayout(image, 20, { width: 400, height: 200 });

        expect(layout).toEqual({ width: 200, height: 100 });
    });

    it('shrinks a logo that would not fit', () => {
        const layout = watermarkLogoLayout({ width: 100, height: 40 }, 100, {
            width: 400,
            height: 400,
        });

        expect(layout.width).toBeLessThanOrEqual(100);
        expect(layout.height).toBeLessThanOrEqual(40);
    });

    it('escapes the text it puts in the SVG', () => {
        const svg = watermarkSvg({ width: 100, height: 20, fontSize: 14 }, '<Ben & Co>', '#ffffff');

        expect(svg).toContain('&lt;Ben &amp; Co&gt;');
        expect(svg).not.toContain('<Ben');
    });
});

describe('watermark placement', () => {
    const image = { width: 1000, height: 500 };
    const overlay = { width: 200, height: 100 };

    it('anchors each corner with the margin', () => {
        expect(watermarkOffset('top-left', image, overlay, 20)).toEqual({ left: 20, top: 20 });
        expect(watermarkOffset('bottom-right', image, overlay, 20)).toEqual({
            left: 780,
            top: 380,
        });
        expect(watermarkOffset('center', image, overlay, 20)).toEqual({ left: 400, top: 200 });
        expect(watermarkOffset('top', image, overlay, 20)).toEqual({ left: 400, top: 20 });
        expect(watermarkOffset('left', image, overlay, 20)).toEqual({ left: 20, top: 200 });
    });

    it('keeps the overlay inside the image when the margin is too big', () => {
        expect(watermarkOffset('bottom-right', image, overlay, 5000)).toEqual({
            left: 0,
            top: 0,
        });
        expect(watermarkOffset('top-left', image, { width: 1000, height: 500 }, 50)).toEqual({
            left: 0,
            top: 0,
        });
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
