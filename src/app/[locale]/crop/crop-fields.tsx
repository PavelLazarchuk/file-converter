'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { IntegerInput } from '@/components/integer-input';
import { Label } from '@/components/ui/label';
import { DIMENSION_LIMITS, clampCropBox, type CropBox } from '@/lib/image';

const FIELDS = [{ key: 'left' }, { key: 'top' }, { key: 'width' }, { key: 'height' }] as const;

type Field = (typeof FIELDS)[number]['key'];

function nextBox(
    box: CropBox,
    field: Field,
    value: number,
    source: { width: number; height: number },
    ratio: { width: number; height: number } | null
): CropBox {
    if (ratio && (field === 'width' || field === 'height')) {
        const requested = field === 'width' ? value : (value * ratio.width) / ratio.height;
        const maxWidth = Math.min(source.width, (source.height * ratio.width) / ratio.height);
        const width = Math.max(1, Math.min(requested, maxWidth));

        return clampCropBox(
            { ...box, width, height: (width * ratio.height) / ratio.width },
            source.width,
            source.height
        );
    }

    return clampCropBox({ ...box, [field]: value }, source.width, source.height);
}

type CropFieldsProps = {
    box: CropBox;
    source: { width: number; height: number };
    ratio: { width: number; height: number } | null;
    disabled?: boolean;
    onChange: (box: CropBox) => void;
};

export function CropFields({ box, source, ratio, disabled, onChange }: CropFieldsProps) {
    const t = useTranslations('Crop');
    const [raw, setRaw] = useState<Partial<Record<Field, string>>>({});

    function handleChange(field: Field, value: string) {
        setRaw(current => ({ ...current, [field]: value }));

        if (!/^\d+$/.test(value)) return;

        onChange(nextBox(box, field, Number(value), source, ratio));
    }

    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {FIELDS.map(({ key }) => (
                <div key={key} className="space-y-2">
                    <Label htmlFor={`crop-${key}`}>{t(`fields.${key}`)}</Label>
                    <IntegerInput
                        id={`crop-${key}`}
                        min={0}
                        max={DIMENSION_LIMITS.max}
                        disabled={disabled}
                        value={raw[key] ?? String(box[key])}
                        onChange={event => handleChange(key, event.target.value)}
                        onBlur={() => setRaw(current => ({ ...current, [key]: undefined }))}
                    />
                </div>
            ))}
        </div>
    );
}
