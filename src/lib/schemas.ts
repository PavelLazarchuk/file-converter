import { z } from 'zod';

import { fieldMessage, type FieldLabel } from './form-messages';
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

function integerInRange(min: number, max: number, label: FieldLabel) {
    return z
        .string({ error: fieldMessage({ k: 'required', label }) })
        .trim()
        .min(1, fieldMessage({ k: 'required', label }))
        .regex(/^\d+$/, fieldMessage({ k: 'integer', label }))
        .transform(Number)
        .refine(
            value => value >= min && value <= max,
            fieldMessage({ k: 'range', label, min, max })
        );
}

export const resizeSchema = z.object({
    width: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'width'),
    height: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'height'),
    rotate: z.enum(ROTATION_KEYS, { error: fieldMessage({ k: 'chooseRotation' }) }),
    fit: z.enum(RESIZE_FIT_KEYS, { error: fieldMessage({ k: 'chooseFit' }) }),
});

export const cropSchema = z.object({
    ratio: z.enum(CROP_RATIO_KEYS, { error: fieldMessage({ k: 'chooseRatio' }) }),
    shape: z.enum(CROP_SHAPE_KEYS, { error: fieldMessage({ k: 'chooseShape' }) }),
    left: integerInRange(0, DIMENSION_LIMITS.max - 1, 'left'),
    top: integerInRange(0, DIMENSION_LIMITS.max - 1, 'top'),
    width: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'cropWidth'),
    height: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'cropHeight'),
});

export const cropFormSchema = cropSchema.pick({ ratio: true, shape: true });

export const outputSizeSchema = z
    .string({ error: fieldMessage({ k: 'outputSizeInvalid' }) })
    .trim()
    .regex(/^\d+x\d+$/, fieldMessage({ k: 'outputSizePattern' }))
    .transform(value => {
        const [width, height] = value.split('x').map(Number);

        return { width, height };
    })
    .refine(
        ({ width, height }) =>
            [width, height].every(
                side => side >= DIMENSION_LIMITS.min && side <= DIMENSION_LIMITS.max
            ),
        fieldMessage({
            k: 'outputSizeRange',
            min: DIMENSION_LIMITS.min,
            max: DIMENSION_LIMITS.max,
        })
    );

export const rotateSchema = z.object({
    angle: integerInRange(ROTATE_ANGLE_LIMITS.min, ROTATE_ANGLE_LIMITS.max, 'angle'),
    background: hexColor('background'),
});

export const watermarkSchema = z
    .object({
        mode: z.enum(WATERMARK_MODE_KEYS, { error: fieldMessage({ k: 'chooseWatermarkMode' }) }),
        text: z
            .string()
            .trim()
            .max(
                WATERMARK_TEXT_MAX_LENGTH,
                fieldMessage({ k: 'maxLength', max: WATERMARK_TEXT_MAX_LENGTH })
            ),
        color: hexColor('textColor'),
        position: z.enum(WATERMARK_POSITION_KEYS, { error: fieldMessage({ k: 'choosePosition' }) }),
        opacity: integerInRange(
            WATERMARK_OPACITY_LIMITS.min,
            WATERMARK_OPACITY_LIMITS.max,
            'opacity'
        ),
        scale: integerInRange(WATERMARK_SCALE_LIMITS.min, WATERMARK_SCALE_LIMITS.max, 'size'),
        margin: integerInRange(WATERMARK_MARGIN_LIMITS.min, WATERMARK_MARGIN_LIMITS.max, 'margin'),
    })
    .refine(values => values.mode !== 'text' || values.text.length > 0, {
        error: fieldMessage({ k: 'watermarkTextRequired' }),
        path: ['text'],
    });

export const compressSchema = z.object({
    mode: z.enum(COMPRESS_MODES, { error: fieldMessage({ k: 'chooseCompressMode' }) }),
    quality: integerInRange(QUALITY_LIMITS.min, QUALITY_LIMITS.max, 'quality'),
    targetKb: integerInRange(TARGET_SIZE_LIMITS.min, TARGET_SIZE_LIMITS.max, 'targetSize'),
});

export const compareSchema = z.object({
    quality: integerInRange(QUALITY_LIMITS.min, QUALITY_LIMITS.max, 'quality'),
});

export const convertSchema = z.object({
    format: z.enum(CONVERT_TARGET_KEYS, { error: fieldMessage({ k: 'chooseTargetFormat' }) }),
});

const icoSizes = new Set<number>(ICO_SIZE_OPTIONS);

const ICO_SIZES_MAX_LENGTH = 64;

export const icoOptionsSchema = z.object({
    sizes: z
        .string({ error: fieldMessage({ k: 'icoSizesRequired' }) })
        .trim()
        .min(1, fieldMessage({ k: 'icoSizesRequired' }))
        .max(ICO_SIZES_MAX_LENGTH, fieldMessage({ k: 'icoSizesTooMany' }))
        .transform(value => [...new Set(value.split(',').map(Number))].sort((a, b) => a - b))
        .refine(
            sizes =>
                sizes.length > 0 &&
                sizes.length <= ICO_SIZE_OPTIONS.length &&
                sizes.every(size => icoSizes.has(size)),
            fieldMessage({ k: 'icoSizesInvalid', sizes: ICO_SIZE_OPTIONS.join(', ') })
        ),
    pack: z.enum(['true', 'false'], { error: fieldMessage({ k: 'icoPackInvalid' }) }),
});

function hexColor(label: FieldLabel) {
    return z
        .string({ error: fieldMessage({ k: 'required', label }) })
        .trim()
        .regex(HEX_COLOR_PATTERN, fieldMessage({ k: 'hex', label }));
}

export const placeholderSchema = z.object({
    width: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'width'),
    height: integerInRange(DIMENSION_LIMITS.min, DIMENSION_LIMITS.max, 'height'),
    bgColor: hexColor('bgColor'),
    textColor: hexColor('textColor'),
    text: z
        .string()
        .trim()
        .max(
            PLACEHOLDER_TEXT_MAX_LENGTH,
            fieldMessage({ k: 'maxLength', max: PLACEHOLDER_TEXT_MAX_LENGTH })
        ),
    format: z.enum(FORMAT_KEYS, { error: fieldMessage({ k: 'chooseOutputFormat' }) }),
});

export const imageToPdfSchema = z.object({
    pageSize: z.enum(PDF_PAGE_SIZE_KEYS, { error: fieldMessage({ k: 'choosePageSize' }) }),
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
