'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { FieldError } from '@/components/field-error';
import { ImageDropzone, useLoadedImages } from '@/components/image-dropzone';
import { IntegerInput } from '@/components/integer-input';
import { MetadataSwitch } from '@/components/metadata-switch';
import { ResultCard } from '@/components/result-card';
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
import { filterImage } from '@/lib/actions';
import {
    BLUR_LIMITS,
    BRIGHTNESS_LIMITS,
    FILTER_DEFAULTS,
    FILTER_EFFECT_KEYS,
    FILTER_PRESETS,
    FILTER_PRESET_KEYS,
    HUE_LIMITS,
    MAX_BATCH_FILES,
    SATURATION_LIMITS,
    filterCss,
    filtersChangeNothing,
    type FilterOptions,
    type FilterPresetKey,
} from '@/lib/image';
import { filterSchema, type FilterInput, type FilterValues } from '@/lib/schemas';
import { cn } from '@/lib/utils';

const defaultValues: FilterInput = { ...FILTER_DEFAULTS };

const PREVIEW_BOX = 224;

function dial(raw: string | undefined, fallback: number): number {
    return /^\d+$/.test(raw ?? '') ? Number(raw) : fallback;
}

export function FiltersForm() {
    const t = useTranslations('Filters');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const pendingLabel = usePendingLabel();
    const { images, addImages, removeImage, clearImages } = useLoadedImages(MAX_BATCH_FILES);
    const [sharpen, setSharpen] = useState(false);
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const { isPending, outcome, isLeaving, progress, run, clearResult, downloadAll, autoDownload } =
        useFileAction(filterImage, 'filtered-images.zip');

    const {
        register,
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { errors, isValid },
    } = useForm<FilterInput, unknown, FilterValues>({
        resolver: zodResolver(filterSchema),
        mode: 'onChange',
        defaultValues,
    });

    const watched = useWatch({ control });
    const preview: FilterOptions = {
        effect: watched.effect ?? 'none',
        brightness: dial(watched.brightness, 100),
        saturation: dial(watched.saturation, 100),
        hue: dial(watched.hue, 0),
        blur: dial(watched.blur, 0),
        sharpen,
    };
    const hasImages = images.length > 0;
    const first = images[0] ?? null;
    const nothingToDo = filtersChangeNothing(preview);

    function applyPreset(key: FilterPresetKey) {
        const preset = FILTER_PRESETS[key];

        setValue('effect', preset.effect, { shouldValidate: true });
        setValue('brightness', String(preset.brightness), { shouldValidate: true });
        setValue('saturation', String(preset.saturation), { shouldValidate: true });
        setValue('hue', String(preset.hue), { shouldValidate: true });
        setValue('blur', String(preset.blur), { shouldValidate: true });
        setSharpen(preset.sharpen);
        clearResult();
    }

    function resetDials() {
        reset(defaultValues);
        setSharpen(false);
        clearResult();
    }

    const onSubmit = handleSubmit(values => {
        if (!hasImages || nothingToDo) return;

        run(images, {
            effect: values.effect,
            brightness: values.brightness,
            saturation: values.saturation,
            hue: values.hue,
            blur: values.blur,
            sharpen,
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
                }}
                onRemove={index => {
                    removeImage(index);
                    clearResult();
                }}
                onClear={() => {
                    clearImages();
                    resetDials();
                }}
            />

            <div className="space-y-2">
                <Label>{t('presets')}</Label>
                <div className="flex flex-wrap gap-2">
                    {FILTER_PRESET_KEYS.map(key => (
                        <Button
                            key={key}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!hasImages || isPending}
                            onClick={() => applyPreset(key)}
                            className="text-muted-foreground"
                        >
                            {labels(`filterPresets.${key}`)}
                        </Button>
                    ))}
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!hasImages || isPending || nothingToDo}
                        onClick={resetDials}
                    >
                        {t('reset')}
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="effect">{t('effect')}</Label>
                <Controller
                    control={control}
                    name="effect"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? 'none'}
                            disabled={!hasImages || isPending}
                            onValueChange={value => {
                                field.onChange(value);
                                clearResult();
                            }}
                        >
                            <SelectTrigger
                                id="effect"
                                className="w-full"
                                aria-invalid={!!errors.effect}
                            >
                                <SelectValue placeholder={form('chooseEffect')} />
                            </SelectTrigger>
                            <SelectContent>
                                {FILTER_EFFECT_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`effects.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <FieldError error={errors.effect} />
            </div>

            <div className="space-y-4 rounded-xl border bg-card p-4">
                <Label>{t('adjustments')}</Label>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="brightness">{t('brightness', BRIGHTNESS_LIMITS)}</Label>
                        <IntegerInput
                            id="brightness"
                            min={BRIGHTNESS_LIMITS.min}
                            max={BRIGHTNESS_LIMITS.max}
                            disabled={!hasImages || isPending}
                            aria-invalid={!!errors.brightness}
                            {...register('brightness', { onChange: clearResult })}
                        />
                        <FieldError error={errors.brightness} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="saturation">{t('saturation', SATURATION_LIMITS)}</Label>
                        <IntegerInput
                            id="saturation"
                            min={SATURATION_LIMITS.min}
                            max={SATURATION_LIMITS.max}
                            disabled={!hasImages || isPending}
                            aria-invalid={!!errors.saturation}
                            {...register('saturation', { onChange: clearResult })}
                        />
                        <FieldError error={errors.saturation} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="hue">{t('hue', HUE_LIMITS)}</Label>
                        <IntegerInput
                            id="hue"
                            min={HUE_LIMITS.min}
                            max={HUE_LIMITS.max}
                            disabled={!hasImages || isPending}
                            aria-invalid={!!errors.hue}
                            {...register('hue', { onChange: clearResult })}
                        />
                        <FieldError error={errors.hue} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="blur">{t('blur', BLUR_LIMITS)}</Label>
                        <IntegerInput
                            id="blur"
                            min={BLUR_LIMITS.min}
                            max={BLUR_LIMITS.max}
                            disabled={!hasImages || isPending}
                            aria-invalid={!!errors.blur}
                            {...register('blur', { onChange: clearResult })}
                        />
                        <FieldError error={errors.blur} />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="sharpen"
                            checked={sharpen}
                            disabled={!hasImages || isPending}
                            onCheckedChange={checked => {
                                setSharpen(checked);
                                clearResult();
                            }}
                        />
                        <Label htmlFor="sharpen">{t('sharpen')}</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">{t('sharpenHint')}</p>
                </div>
            </div>

            {first && (
                <div className="space-y-2">
                    <Label>{t('preview')}</Label>
                    <div
                        className="flex items-center justify-center overflow-hidden rounded-xl border bg-muted/30"
                        style={{ height: PREVIEW_BOX }}
                    >
                        <Image
                            src={first.previewUrl}
                            alt={first.file.name}
                            width={first.width}
                            height={first.height}
                            unoptimized
                            className={cn(
                                'max-h-[80%] w-auto max-w-[80%] object-contain',
                                'transition-[filter] duration-300 ease-out motion-reduce:transition-none'
                            )}
                            style={{ filter: filterCss(preview) }}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('previewHint')}</p>
                </div>
            )}

            <MetadataSwitch
                checked={removeMetadata}
                onCheckedChange={setRemoveMetadata}
                disabled={!hasImages || isPending}
            />

            {outcome && (
                <ResultCard
                    outcome={outcome}
                    leaving={isLeaving}
                    onDismiss={clearResult}
                    onDownloadAll={downloadAll}
                />
            )}

            <Button
                type="submit"
                className="w-full"
                disabled={!hasImages || !isValid || nothingToDo || isPending}
            >
                {isPending ? (
                    <>
                        <Spinner /> {pendingLabel(t('pending'), progress)}
                    </>
                ) : nothingToDo ? (
                    t('nothingToDo')
                ) : autoDownload ? (
                    t('submitDownload')
                ) : (
                    t('submit')
                )}
            </Button>
        </form>
    );
}
