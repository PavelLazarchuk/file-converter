import { z } from 'zod';

import {
    ASPECT_RATIO_KEYS,
    COMPRESS_MODES,
    CONVERT_TARGET_KEYS,
    CROP_SHAPE_KEYS,
    DIMENSION_LIMITS,
    FORMAT_KEYS,
    HEX_COLOR_PATTERN,
    PLACEHOLDER_TEXT_MAX_LENGTH,
    QUALITY_LIMITS,
    ROTATION_KEYS,
    TARGET_SIZE_LIMITS,
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
});

export const cropSchema = z.object({
    ratio: z.enum(ASPECT_RATIO_KEYS, { error: 'Choose an aspect ratio' }),
    shape: z.enum(CROP_SHAPE_KEYS, { error: 'Choose a crop shape' }),
    left: integerInRange(0, DIMENSION_LIMITS.max - 1, 'Left offset'),
    top: integerInRange(0, DIMENSION_LIMITS.max - 1, 'Top offset'),
    width: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'Crop width'),
    height: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'Crop height'),
});

export const cropFormSchema = cropSchema.pick({ ratio: true, shape: true });

export const compressSchema = z.object({
    mode: z.enum(COMPRESS_MODES, { error: 'Choose a compression mode' }),
    quality: integerInRange(QUALITY_LIMITS.min, QUALITY_LIMITS.max, 'Quality'),
    targetKb: integerInRange(TARGET_SIZE_LIMITS.min, TARGET_SIZE_LIMITS.max, 'Target size'),
});

export const convertSchema = z.object({
    format: z.enum(CONVERT_TARGET_KEYS, { error: 'Choose a target format' }),
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

export type ResizeInput = z.input<typeof resizeSchema>;
export type ResizeValues = z.output<typeof resizeSchema>;
export type CropFormInput = z.input<typeof cropFormSchema>;
export type CropFormValues = z.output<typeof cropFormSchema>;
export type CompressInput = z.input<typeof compressSchema>;
export type CompressValues = z.output<typeof compressSchema>;
export type ConvertInput = z.input<typeof convertSchema>;
export type ConvertValues = z.output<typeof convertSchema>;
export type PlaceholderInput = z.input<typeof placeholderSchema>;
export type PlaceholderValues = z.output<typeof placeholderSchema>;
