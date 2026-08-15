import { z } from 'zod';

import {
    COMPRESS_MODES,
    CONVERT_TARGET_KEYS,
    CROP_RATIO_KEYS,
    CROP_SHAPE_KEYS,
    DIMENSION_LIMITS,
    FORMAT_KEYS,
    HEX_COLOR_PATTERN,
    ICO_SIZE_OPTIONS,
    PDF_PAGE_SIZE_KEYS,
    PLACEHOLDER_TEXT_MAX_LENGTH,
    QUALITY_LIMITS,
    RESIZE_FIT_KEYS,
    ROTATE_ANGLE_LIMITS,
    ROTATION_KEYS,
    TARGET_SIZE_LIMITS,
    WATERMARK_MARGIN_LIMITS,
    WATERMARK_MODE_KEYS,
    WATERMARK_OPACITY_LIMITS,
    WATERMARK_POSITION_KEYS,
    WATERMARK_SCALE_LIMITS,
    WATERMARK_TEXT_MAX_LENGTH,
} from './image';

function integerInRange(min: number, max: number, label: string) {
    return z
        .string({ error: `${label} is required` })
        .trim()
        .min(1, `${label} is required`)
        .regex(/^\d+$/, `${label} must be a whole number`)
        .transform(Number)
        .refine(
            value => value >= min && value <= max,
            `${label} must be between ${min} and ${max}`
        );
}

export const resizeSchema = z.object({
    width: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'Width'),
    height: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'Height'),
    rotate: z.enum(ROTATION_KEYS, { error: 'Choose a rotation' }),
    fit: z.enum(RESIZE_FIT_KEYS, { error: 'Choose how the image should fit' }),
});

export const cropSchema = z.object({
    ratio: z.enum(CROP_RATIO_KEYS, { error: 'Choose an aspect ratio' }),
    shape: z.enum(CROP_SHAPE_KEYS, { error: 'Choose a crop shape' }),
    left: integerInRange(0, DIMENSION_LIMITS.max - 1, 'Left offset'),
    top: integerInRange(0, DIMENSION_LIMITS.max - 1, 'Top offset'),
    width: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'Crop width'),
    height: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'Crop height'),
});

export const cropFormSchema = cropSchema.pick({ ratio: true, shape: true });

export const outputSizeSchema = z
    .string({ error: 'Invalid output size' })
    .trim()
    .regex(/^\d+x\d+$/, 'Output size must look like 1080x1080')
    .transform(value => {
        const [width, height] = value.split('x').map(Number);

        return { width, height };
    })
    .refine(
        ({ width, height }) =>
            [width, height].every(
                side => side >= DIMENSION_LIMITS.min && side <= DIMENSION_LIMITS.max
            ),
        `Output size must be between ${DIMENSION_LIMITS.min} and ${DIMENSION_LIMITS.max} px`
    );

export const rotateSchema = z.object({
    angle: integerInRange(ROTATE_ANGLE_LIMITS.min, ROTATE_ANGLE_LIMITS.max, 'Angle'),
    background: hexColor('Background color'),
});

export const watermarkSchema = z
    .object({
        mode: z.enum(WATERMARK_MODE_KEYS, { error: 'Choose a watermark type' }),
        text: z
            .string()
            .trim()
            .max(
                WATERMARK_TEXT_MAX_LENGTH,
                `Text must be at most ${WATERMARK_TEXT_MAX_LENGTH} characters`
            ),
        color: hexColor('Text color'),
        position: z.enum(WATERMARK_POSITION_KEYS, { error: 'Choose a position' }),
        opacity: integerInRange(
            WATERMARK_OPACITY_LIMITS.min,
            WATERMARK_OPACITY_LIMITS.max,
            'Opacity'
        ),
        scale: integerInRange(WATERMARK_SCALE_LIMITS.min, WATERMARK_SCALE_LIMITS.max, 'Size'),
        margin: integerInRange(WATERMARK_MARGIN_LIMITS.min, WATERMARK_MARGIN_LIMITS.max, 'Margin'),
    })
    .refine(values => values.mode !== 'text' || values.text.length > 0, {
        error: 'Watermark text is required',
        path: ['text'],
    });

export const compressSchema = z.object({
    mode: z.enum(COMPRESS_MODES, { error: 'Choose a compression mode' }),
    quality: integerInRange(QUALITY_LIMITS.min, QUALITY_LIMITS.max, 'Quality'),
    targetKb: integerInRange(TARGET_SIZE_LIMITS.min, TARGET_SIZE_LIMITS.max, 'Target size'),
});

export const compareSchema = z.object({
    quality: integerInRange(QUALITY_LIMITS.min, QUALITY_LIMITS.max, 'Quality'),
});

export const convertSchema = z.object({
    format: z.enum(CONVERT_TARGET_KEYS, { error: 'Choose a target format' }),
});

const icoSizes = new Set<number>(ICO_SIZE_OPTIONS);

const ICO_SIZES_MAX_LENGTH = 64;

export const icoOptionsSchema = z.object({
    sizes: z
        .string({ error: 'Choose at least one icon size' })
        .trim()
        .min(1, 'Choose at least one icon size')
        .max(ICO_SIZES_MAX_LENGTH, 'Too many icon sizes')
        .transform(value => [...new Set(value.split(',').map(Number))].sort((a, b) => a - b))
        .refine(
            sizes =>
                sizes.length > 0 &&
                sizes.length <= ICO_SIZE_OPTIONS.length &&
                sizes.every(size => icoSizes.has(size)),
            `Icon sizes must be any of ${ICO_SIZE_OPTIONS.join(', ')} px`
        ),
    pack: z.enum(['true', 'false'], { error: 'Invalid favicon pack option' }),
});

function hexColor(label: string) {
    return z
        .string({ error: `${label} is required` })
        .trim()
        .regex(HEX_COLOR_PATTERN, `${label} must be a hex color like #aabbcc`);
}

export const placeholderSchema = z.object({
    width: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'Width'),
    height: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'Height'),
    bgColor: hexColor('Background color'),
    textColor: hexColor('Text color'),
    text: z
        .string()
        .trim()
        .max(
            PLACEHOLDER_TEXT_MAX_LENGTH,
            `Text must be at most ${PLACEHOLDER_TEXT_MAX_LENGTH} characters`
        ),
    format: z.enum(FORMAT_KEYS, { error: 'Choose an output format' }),
});

export const imageToPdfSchema = z.object({
    pageSize: z.enum(PDF_PAGE_SIZE_KEYS, { error: 'Choose a page size' }),
});

export type ResizeInput = z.input<typeof resizeSchema>;
export type ResizeValues = z.output<typeof resizeSchema>;
export type CropValues = z.output<typeof cropSchema>;
export type CropFormInput = z.input<typeof cropFormSchema>;
export type CropFormValues = z.output<typeof cropFormSchema>;
export type OutputSizeValues = z.output<typeof outputSizeSchema>;
export type IcoOptionsValues = z.output<typeof icoOptionsSchema>;
export type CompareInput = z.input<typeof compareSchema>;
export type CompareValues = z.output<typeof compareSchema>;

export type CompressInput = z.input<typeof compressSchema>;
export type CompressValues = z.output<typeof compressSchema>;
export type ConvertInput = z.input<typeof convertSchema>;
export type ConvertValues = z.output<typeof convertSchema>;
export type PlaceholderInput = z.input<typeof placeholderSchema>;
export type PlaceholderValues = z.output<typeof placeholderSchema>;
export type ImageToPdfInput = z.input<typeof imageToPdfSchema>;
export type ImageToPdfValues = z.output<typeof imageToPdfSchema>;
export type RotateInput = z.input<typeof rotateSchema>;
export type RotateValues = z.output<typeof rotateSchema>;
export type WatermarkInput = z.input<typeof watermarkSchema>;
export type WatermarkValues = z.output<typeof watermarkSchema>;
