'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { FieldError } from '@/components/field-error';
import { ImageDropzone, useLoadedImages } from '@/components/image-dropzone';
import { IntegerInput } from '@/components/integer-input';
import { MetadataSwitch } from '@/components/metadata-switch';
import { ResultCard } from '@/components/result-card';
import { SizePresets } from '@/components/size-presets';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { usePendingLabel, useFileAction } from '@/hooks/use-file-action';
import { resizeImage } from '@/lib/actions';
import {
    DIMENSION_LIMITS,
    MAX_BATCH_FILES,
    RESIZE_FIT_KEYS,
    ROTATION_KEYS,
    rotationSwapsDimensions,
} from '@/lib/image';
import { resizeSchema, type ResizeInput, type ResizeValues } from '@/lib/schemas';

const defaultValues: ResizeInput = { width: '', height: '', rotate: '0', fit: 'contain' };

function clampDimension(value: number): number {
    return Math.min(DIMENSION_LIMITS.max, Math.max(DIMENSION_LIMITS.min, Math.round(value)));
}

export function ResizeForm() {
    const t = useTranslations('Resize');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const pendingLabel = usePendingLabel();
    const { images, addImages, removeImage, clearImages } = useLoadedImages(MAX_BATCH_FILES);
    const [lockAspect, setLockAspect] = useState(true);
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const [noEnlarge, setNoEnlarge] = useState(false);
    const [presetKey, setPresetKey] = useState<string | null>(null);
    const { isPending, outcome, isLeaving, progress, run, clearResult, downloadAll, autoDownload } =
        useFileAction(resizeImage, 'resized-images.zip');

    const {
        register,
        control,
        handleSubmit,
        reset,
        setValue,
        getValues,
        trigger,
        formState: { errors, isValid },
    } = useForm<ResizeInput, unknown, ResizeValues>({
        resolver: zodResolver(resizeSchema),
        mode: 'onChange',
        defaultValues,
    });

    const rotate = useWatch({ control, name: 'rotate' });
    const fit = useWatch({ control, name: 'fit' });
    const hasImages = images.length > 0;
    const first = images[0] ?? null;
    const sourceRatio = first ? first.width / first.height : null;
    const ratio = sourceRatio && rotationSwapsDimensions(rotate) ? 1 / sourceRatio : sourceRatio;

    function syncLinkedDimension(
        changed: 'width' | 'height',
        rawValue: string,
        locked = lockAspect
    ) {
        setPresetKey(null);

        if (!locked || !ratio || !/^\d+$/.test(rawValue)) return;

        const value = Number(rawValue);

        if (value < DIMENSION_LIMITS.min) return;

        const linked = changed === 'width' ? value / ratio : value * ratio;

        setValue(changed === 'width' ? 'height' : 'width', String(clampDimension(linked)), {
            shouldValidate: true,
        });
    }

    const onSubmit = handleSubmit(values => {
        if (!hasImages) return;

        run(images, {
            width: values.width,
            height: values.height,
            rotate: values.rotate,
            fit: values.fit,
            noEnlarge,
            keepMetadata: !removeMetadata,
        });
    });

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                images={images}
                max={MAX_BATCH_FILES}
                disabled={isPending}
                onAdd={loaded => {
                    addImages(loaded);
                    clearResult();

                    if (!hasImages) {
                        setPresetKey(null);
                        reset({
                            ...defaultValues,
                            width: String(loaded[0].width),
                            height: String(loaded[0].height),
                        });
                    }

                    void trigger();
                }}
                onRemove={index => {
                    removeImage(index);
                    clearResult();
                }}
                onClear={() => {
                    clearImages();
                    clearResult();
                    setPresetKey(null);
                    reset(defaultValues);
                }}
            />

            <div className="space-y-2">
                <Label htmlFor="rotate">{t('rotation')}</Label>
                <Controller
                    control={control}
                    name="rotate"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? '0'}
                            onValueChange={value => {
                                const swapChanged =
                                    rotationSwapsDimensions(field.value) !==
                                    rotationSwapsDimensions(
                                        value as (typeof ROTATION_KEYS)[number]
                                    );
                                field.onChange(value);
                                if (hasImages && swapChanged) {
                                    const { width, height } = getValues();

                                    setPresetKey(null);
                                    setValue('width', height, { shouldValidate: true });
                                    setValue('height', width, { shouldValidate: true });
                                }
                            }}
                            disabled={!hasImages || isPending}
                        >
                            <SelectTrigger
                                id="rotate"
                                className="w-full"
                                aria-invalid={!!errors.rotate}
                            >
                                <SelectValue placeholder={form('chooseRotation')} />
                            </SelectTrigger>
                            <SelectContent>
                                {ROTATION_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`rotations.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <FieldError error={errors.rotate} />
            </div>

            <SizePresets
                activeKey={presetKey}
                disabled={!hasImages || isPending}
                hint={t('presetHint')}
                onSelect={preset => {
                    clearResult();
                    setValue('width', String(preset.width), { shouldValidate: true });
                    setValue('height', String(preset.height), { shouldValidate: true });
                    setValue('fit', 'cover', { shouldValidate: true });
                    setLockAspect(false);
                    setPresetKey(preset.key);
                }}
            />

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="width">{t('width')}</Label>
                    <IntegerInput
                        id="width"
                        min={DIMENSION_LIMITS.min}
                        max={DIMENSION_LIMITS.max}
                        placeholder={t('widthPlaceholder')}
                        disabled={!hasImages || isPending}
                        aria-invalid={!!errors.width}
                        {...register('width', {
                            onChange: event => syncLinkedDimension('width', event.target.value),
                        })}
                    />
                    <FieldError error={errors.width} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="height">{t('height')}</Label>
                    <IntegerInput
                        id="height"
                        min={DIMENSION_LIMITS.min}
                        max={DIMENSION_LIMITS.max}
                        placeholder={t('heightPlaceholder')}
                        disabled={!hasImages || isPending}
                        aria-invalid={!!errors.height}
                        {...register('height', {
                            onChange: event => syncLinkedDimension('height', event.target.value),
                        })}
                    />
                    <FieldError error={errors.height} />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="fit">{t('fit')}</Label>
                <Controller
                    control={control}
                    name="fit"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? 'contain'}
                            onValueChange={value => {
                                setPresetKey(null);
                                field.onChange(value);
                            }}
                            disabled={!hasImages || isPending}
                        >
                            <SelectTrigger id="fit" className="w-full" aria-invalid={!!errors.fit}>
                                <SelectValue placeholder={form('chooseFit')} />
                            </SelectTrigger>
                            <SelectContent>
                                {RESIZE_FIT_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`fits.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <p className="text-sm text-muted-foreground">
                    {labels(`fits.${fit ?? 'contain'}Hint`)}
                </p>
                <FieldError error={errors.fit} />
            </div>

            <div className="flex items-center gap-3">
                <Switch
                    id="lock-aspect"
                    checked={lockAspect}
                    disabled={!hasImages || isPending}
                    onCheckedChange={checked => {
                        setLockAspect(checked);
                        if (checked) syncLinkedDimension('width', getValues('width'), true);
                    }}
                />
                <Label htmlFor="lock-aspect">{t('lockAspect')}</Label>
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                    <Switch
                        id="no-enlarge"
                        checked={noEnlarge}
                        disabled={!hasImages || isPending}
                        onCheckedChange={setNoEnlarge}
                    />
                    <Label htmlFor="no-enlarge">{t('noEnlarge')}</Label>
                </div>
                <p className="text-sm text-muted-foreground">{t('noEnlargeHint')}</p>
            </div>

            <MetadataSwitch
                checked={removeMetadata}
                onCheckedChange={setRemoveMetadata}
                disabled={!hasImages || isPending}
            />

            {images.length > 1 && <p className="text-sm text-muted-foreground">{t('batchNote')}</p>}

            {outcome && (
                <ResultCard
                    outcome={outcome}
                    leaving={isLeaving}
                    onDismiss={clearResult}
                    onDownloadAll={downloadAll}
                />
            )}

            <Button type="submit" className="w-full" disabled={!hasImages || !isValid || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> {pendingLabel(t('pending'), progress)}
                    </>
                ) : autoDownload ? (
                    t('submitDownload')
                ) : (
                    t('submit')
                )}
            </Button>
        </form>
    );
}
