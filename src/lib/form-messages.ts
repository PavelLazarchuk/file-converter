export const FIELD_LABELS = [
    'width',
    'height',
    'left',
    'top',
    'cropWidth',
    'cropHeight',
    'angle',
    'background',
    'quality',
    'targetSize',
    'opacity',
    'size',
    'margin',
    'bgColor',
    'textColor',
] as const;

export type FieldLabel = (typeof FIELD_LABELS)[number];

export type FieldMessage =
    | { k: 'required'; label: FieldLabel }
    | { k: 'integer'; label: FieldLabel }
    | { k: 'range'; label: FieldLabel; min: number; max: number }
    | { k: 'hex'; label: FieldLabel }
    | { k: 'maxLength'; max: number }
    | { k: 'chooseRotation' }
    | { k: 'chooseFit' }
    | { k: 'chooseRatio' }
    | { k: 'chooseShape' }
    | { k: 'chooseWatermarkMode' }
    | { k: 'choosePosition' }
    | { k: 'chooseCompressMode' }
    | { k: 'chooseTargetFormat' }
    | { k: 'chooseOutputFormat' }
    | { k: 'choosePageSize' }
    | { k: 'watermarkTextRequired' }
    | { k: 'outputSizeInvalid' }
    | { k: 'outputSizePattern' }
    | { k: 'outputSizeRange'; min: number; max: number }
    | { k: 'icoSizesRequired' }
    | { k: 'icoSizesTooMany' }
    | { k: 'icoSizesInvalid'; sizes: string }
    | { k: 'icoPackInvalid' };

export function fieldMessage(message: FieldMessage): string {
    return JSON.stringify(message);
}

export function parseFieldMessage(raw: string | undefined): FieldMessage | null {
    if (!raw || !raw.startsWith('{')) return null;

    try {
        const parsed: unknown = JSON.parse(raw);

        return typeof parsed === 'object' && parsed !== null && 'k' in parsed
            ? (parsed as FieldMessage)
            : null;
    } catch {
        return null;
    }
}
