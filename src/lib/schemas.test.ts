import { describe, expect, it } from 'vitest';

import {
    DIMENSION_LIMITS,
    PLACEHOLDER_TEXT_MAX_LENGTH,
    QUALITY_LIMITS,
    WATERMARK_TEXT_MAX_LENGTH,
} from './image';
import {
    compressSchema,
    convertSchema,
    cropSchema,
    icoOptionsSchema,
    imageToPdfSchema,
    outputSizeSchema,
    placeholderSchema,
    resizeSchema,
    rotateSchema,
    watermarkSchema,
} from './schemas';

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
    return result.error?.issues[0]?.message;
}

describe('resizeSchema', () => {
    it('parses string input into numbers', () => {
        const result = resizeSchema.safeParse({
            width: '800',
            height: '600',
            rotate: '90',
            fit: 'cover',
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ width: 800, height: 600, rotate: '90', fit: 'cover' });
    });

    it('rejects blanks, decimals and out-of-range values', () => {
        expect(
            firstError(
                resizeSchema.safeParse({ width: '', height: '10', rotate: '0', fit: 'contain' })
            )
        ).toBe('Width is required');
        expect(
            firstError(
                resizeSchema.safeParse({ width: '10.5', height: '10', rotate: '0', fit: 'contain' })
            )
        ).toBe('Width must be a whole number');
        expect(
            firstError(
                resizeSchema.safeParse({
                    width: String(DIMENSION_LIMITS.max + 1),
                    height: '10',
                    rotate: '0',
                    fit: 'contain',
                })
            )
        ).toContain('must be between');
    });

    it('rejects unknown rotations and fits', () => {
        expect(
            resizeSchema.safeParse({ width: '10', height: '10', rotate: '45', fit: 'contain' })
                .success
        ).toBe(false);
        expect(
            resizeSchema.safeParse({ width: '10', height: '10', rotate: '0', fit: 'squish' })
                .success
        ).toBe(false);
    });
});

describe('cropSchema', () => {
    const valid = {
        ratio: '1:1',
        shape: 'rectangle',
        left: '0',
        top: '0',
        width: '100',
        height: '100',
    };

    it('accepts a zero offset', () => {
        expect(cropSchema.safeParse(valid).success).toBe(true);
    });

    it('accepts the free ratio', () => {
        expect(cropSchema.safeParse({ ...valid, ratio: 'free' }).success).toBe(true);
    });

    it('rejects a zero-sized crop', () => {
        expect(cropSchema.safeParse({ ...valid, width: '0' }).success).toBe(false);
    });

    it('rejects a negative offset', () => {
        expect(cropSchema.safeParse({ ...valid, left: '-1' }).success).toBe(false);
    });
});

describe('compressSchema', () => {
    it('parses quality mode', () => {
        const result = compressSchema.safeParse({
            mode: 'quality',
            quality: '80',
            targetKb: '500',
        });

        expect(result.data).toEqual({ mode: 'quality', quality: 80, targetKb: 500 });
    });

    it('bounds the quality', () => {
        expect(
            compressSchema.safeParse({
                mode: 'quality',
                quality: String(QUALITY_LIMITS.max + 1),
                targetKb: '500',
            }).success
        ).toBe(false);
        expect(
            compressSchema.safeParse({ mode: 'quality', quality: '0', targetKb: '500' }).success
        ).toBe(false);
    });
});

describe('convertSchema', () => {
    it('accepts every advertised target', () => {
        expect(convertSchema.safeParse({ format: 'ico' }).success).toBe(true);
        expect(convertSchema.safeParse({ format: 'base64' }).success).toBe(true);
    });

    it('rejects an unknown target', () => {
        expect(convertSchema.safeParse({ format: 'bmp' }).success).toBe(false);
    });
});

describe('icoOptionsSchema', () => {
    it('parses, sorts and deduplicates the size list', () => {
        const result = icoOptionsSchema.safeParse({ sizes: '48,16,16,32', pack: 'false' });

        expect(result.data?.sizes).toEqual([16, 32, 48]);
    });

    it('rejects sizes outside the offered set', () => {
        expect(icoOptionsSchema.safeParse({ sizes: '17', pack: 'false' }).success).toBe(false);
        expect(icoOptionsSchema.safeParse({ sizes: '', pack: 'false' }).success).toBe(false);
    });

    it('rejects a long list before parsing it', () => {
        expect(icoOptionsSchema.safeParse({ sizes: '16,'.repeat(40), pack: 'false' }).success).toBe(
            false
        );
    });

    it('only takes a boolean-ish pack flag', () => {
        expect(icoOptionsSchema.safeParse({ sizes: '16', pack: 'yes' }).success).toBe(false);
    });
});

describe('placeholderSchema', () => {
    const valid = {
        width: '600',
        height: '400',
        bgColor: '#e2e8f0',
        textColor: '#64748b',
        text: '',
        format: 'png',
    };

    it('accepts the defaults', () => {
        expect(placeholderSchema.safeParse(valid).success).toBe(true);
    });

    it('requires six-digit hex colors', () => {
        expect(placeholderSchema.safeParse({ ...valid, bgColor: '#fff' }).success).toBe(false);
        expect(placeholderSchema.safeParse({ ...valid, bgColor: 'red' }).success).toBe(false);
    });

    it('caps the label length', () => {
        expect(
            placeholderSchema.safeParse({
                ...valid,
                text: 'x'.repeat(PLACEHOLDER_TEXT_MAX_LENGTH + 1),
            }).success
        ).toBe(false);
    });
});

describe('imageToPdfSchema', () => {
    it('takes the three page sizes', () => {
        for (const pageSize of ['fit', 'a4', 'letter']) {
            expect(imageToPdfSchema.safeParse({ pageSize }).success).toBe(true);
        }

        expect(imageToPdfSchema.safeParse({ pageSize: 'a3' }).success).toBe(false);
    });
});

describe('outputSizeSchema', () => {
    it('splits a WxH preset into numbers', () => {
        expect(outputSizeSchema.safeParse('1080x1350').data).toEqual({
            width: 1080,
            height: 1350,
        });
    });

    it('rejects anything that is not two whole numbers', () => {
        for (const value of ['1080', '1080*1080', '10.5x10', 'x', '1080x']) {
            expect(outputSizeSchema.safeParse(value).success).toBe(false);
        }
    });

    it('holds the preset to the same dimension limits as everything else', () => {
        expect(outputSizeSchema.safeParse('0x100').success).toBe(false);
        expect(outputSizeSchema.safeParse(`${DIMENSION_LIMITS.max + 1}x100`).success).toBe(false);
    });
});

describe('rotateSchema', () => {
    it('parses the angle into a number', () => {
        expect(rotateSchema.safeParse({ angle: '270', background: '#ffffff' }).data).toEqual({
            angle: 270,
            background: '#ffffff',
        });
    });

    it('stops at a full turn and rejects a bad color', () => {
        expect(rotateSchema.safeParse({ angle: '360', background: '#ffffff' }).success).toBe(false);
        expect(rotateSchema.safeParse({ angle: '10', background: 'white' }).success).toBe(false);
    });
});

describe('watermarkSchema', () => {
    const valid = {
        mode: 'text',
        text: '© Me',
        color: '#ffffff',
        position: 'bottom-right',
        opacity: '55',
        scale: '30',
        margin: '24',
    };

    it('accepts a text watermark', () => {
        expect(watermarkSchema.safeParse(valid).data).toMatchObject({
            mode: 'text',
            opacity: 55,
            scale: 30,
            margin: 24,
        });
    });

    it('requires the text only when the watermark is text', () => {
        expect(watermarkSchema.safeParse({ ...valid, text: '' }).success).toBe(false);
        expect(firstError(watermarkSchema.safeParse({ ...valid, text: '' }))).toBe(
            'Watermark text is required'
        );
        expect(watermarkSchema.safeParse({ ...valid, mode: 'image', text: '' }).success).toBe(true);
    });

    it('caps the text and holds the percentages in range', () => {
        expect(
            watermarkSchema.safeParse({
                ...valid,
                text: 'x'.repeat(WATERMARK_TEXT_MAX_LENGTH + 1),
            }).success
        ).toBe(false);
        expect(watermarkSchema.safeParse({ ...valid, opacity: '0' }).success).toBe(false);
        expect(watermarkSchema.safeParse({ ...valid, scale: '101' }).success).toBe(false);
        expect(watermarkSchema.safeParse({ ...valid, position: 'middle' }).success).toBe(false);
    });
});
