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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { usePendingLabel, useFileAction } from '@/hooks/use-file-action';
import { useFileSize } from '@/hooks/use-messages';
import { watermarkImage } from '@/lib/actions';
import {
    CONVERT_SOURCE_KEYS,
    MAX_BATCH_BYTES,
    MAX_BATCH_FILES,
    MAX_BATCH_SIZE_LABEL,
    WATERMARK_DEFAULTS,
    WATERMARK_MARGIN_LIMITS,
    WATERMARK_MODE_KEYS,
    WATERMARK_OPACITY_LIMITS,
    WATERMARK_POSITION_KEYS,
    WATERMARK_SCALE_LIMITS,
    WATERMARK_TEXT_MAX_LENGTH,
    type WatermarkPosition,
} from '@/lib/image';
import { watermarkSchema, type WatermarkInput, type WatermarkValues } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import { WatermarkPreview } from './watermark-preview';

const defaultValues: WatermarkInput = { ...WATERMARK_DEFAULTS };

function numeric(value: string | undefined, fallback: number): number {
    return /^\d+$/.test(value ?? '') ? Number(value) : fallback;
}

export function WatermarkForm() {
    const t = useTranslations('Watermark');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const pendingLabel = usePendingLabel();
    const fileSize = useFileSize();
    const { images, addImages, removeImage, clearImages } = useLoadedImages(MAX_BATCH_FILES);
    const logos = useLoadedImages(1);
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const { isPending, outcome, isLeaving, progress, run, clearResult, downloadAll, autoDownload } =
        useFileAction(watermarkImage, 'watermarked-images.zip');

    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors, isValid },
    } = useForm<WatermarkInput, unknown, WatermarkValues>({
        resolver: zodResolver(watermarkSchema),
        mode: 'onChange',
        defaultValues,
    });

    const [mode, text, color, position, opacity, scale, margin] = useWatch({
        control,
        name: ['mode', 'text', 'color', 'position', 'opacity', 'scale', 'margin'],
    });

    const logo = logos.images[0] ?? null;
    const hasImages = images.length > 0;
    const usesLogo = mode === 'image';
    const missingLogo = usesLogo && !logo;
    const first = images[0] ?? null;
    const uploadedBytes =
        images.reduce((sum, image) => sum + image.file.size, 0) +
        (usesLogo && logo ? logo.file.size : 0);
    const overBudget = uploadedBytes > MAX_BATCH_BYTES;

    const onSubmit = handleSubmit(values => {
        if (!hasImages || missingLogo || overBudget) return;

        run(images, {
            mode: values.mode,
            text: values.text,
            color: values.color,
            position: values.position,
            opacity: values.opacity,
            scale: values.scale,
            margin: values.margin,
            keepMetadata: !removeMetadata,
            ...(usesLogo && logo ? { logo: logo.file } : {}),
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
                    clearResult();
                    reset(defaultValues);
                }}
            />

            <div className="space-y-2">
                <Label htmlFor="mode">{t('watermark')}</Label>
                <Controller
                    control={control}
                    name="mode"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? 'text'}
                            onValueChange={value => {
                                clearResult();
                                field.onChange(value);
                            }}
                            disabled={!hasImages || isPending}
                        >
                            <SelectTrigger
                                id="mode"
                                className="w-full"
                                aria-invalid={!!errors.mode}
                            >
                                <SelectValue placeholder={form('chooseWatermarkMode')} />
                            </SelectTrigger>
                            <SelectContent>
                                {WATERMARK_MODE_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`watermarkModes.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <FieldError error={errors.mode} />
            </div>

            {usesLogo ? (
                <div className="space-y-2">
                    <Label>{labels('watermarkModes.image')}</Label>
                    <ImageDropzone
                        images={logos.images}
                        formats={CONVERT_SOURCE_KEYS}
                        disabled={isPending}
                        receivesHandoff={false}
                        onAdd={loaded => {
                            logos.addImages(loaded);
                            clearResult();
                        }}
                        onRemove={() => {
                            logos.clearImages();
                            clearResult();
                        }}
                        onClear={() => {
                            logos.clearImages();
                            clearResult();
                        }}
                    />
                    <p className="text-sm text-muted-foreground">{t('logoHint')}</p>
                    {overBudget && (
                        <p className="text-sm text-destructive">
                            {t('overBudget', {
                                total: fileSize(uploadedBytes),
                                max: MAX_BATCH_SIZE_LABEL,
                            })}
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                        <Label htmlFor="text">{t('text')}</Label>
                        <Input
                            id="text"
                            placeholder={t('textPlaceholder')}
                            maxLength={WATERMARK_TEXT_MAX_LENGTH}
                            disabled={!hasImages || isPending}
                            aria-invalid={!!errors.text}
                            {...register('text', { onChange: clearResult })}
                        />
                        <FieldError error={errors.text} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="color">{t('color')}</Label>
                        <Input
                            id="color"
                            type="color"
                            className="h-9 w-full cursor-pointer p-1 sm:w-20"
                            disabled={!hasImages || isPending}
                            aria-invalid={!!errors.color}
                            {...register('color', { onChange: clearResult })}
                        />
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <Label>{t('position')}</Label>
                <Controller
                    control={control}
                    name="position"
                    render={({ field }) => (
                        <div className="grid w-fit grid-cols-3 gap-1.5">
                            {WATERMARK_POSITION_KEYS.map(key => {
                                const active = field.value === key;

                                return (
                                    <Button
                                        key={key}
                                        type="button"
                                        size="icon"
                                        variant={active ? 'default' : 'outline'}
                                        aria-pressed={active}
                                        aria-label={labels(`positions.${key}`)}
                                        title={labels(`positions.${key}`)}
                                        disabled={!hasImages || isPending}
                                        onClick={() => {
                                            clearResult();
                                            field.onChange(key);
                                        }}
                                    >
                                        <span
                                            className={cn(
                                                'size-2 rounded-full',
                                                active ? 'bg-current' : 'bg-muted-foreground/50'
                                            )}
                                        />
                                    </Button>
                                );
                            })}
                        </div>
                    )}
                />
                <p className="text-sm text-muted-foreground">
                    {labels(`positions.${(position as WatermarkPosition) ?? 'bottom-right'}`)}
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                    <Label htmlFor="scale">{t('scale')}</Label>
                    <IntegerInput
                        id="scale"
                        min={WATERMARK_SCALE_LIMITS.min}
                        max={WATERMARK_SCALE_LIMITS.max}
                        disabled={!hasImages || isPending}
                        aria-invalid={!!errors.scale}
                        {...register('scale', { onChange: clearResult })}
                    />
                    <FieldError error={errors.scale} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="opacity">{t('opacity')}</Label>
                    <IntegerInput
                        id="opacity"
                        min={WATERMARK_OPACITY_LIMITS.min}
                        max={WATERMARK_OPACITY_LIMITS.max}
                        disabled={!hasImages || isPending}
                        aria-invalid={!!errors.opacity}
                        {...register('opacity', { onChange: clearResult })}
                    />
                    <FieldError error={errors.opacity} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="margin">{t('margin')}</Label>
                    <IntegerInput
                        id="margin"
                        min={WATERMARK_MARGIN_LIMITS.min}
                        max={WATERMARK_MARGIN_LIMITS.max}
                        disabled={!hasImages || isPending}
                        aria-invalid={!!errors.margin}
                        {...register('margin', { onChange: clearResult })}
                    />
                    <FieldError error={errors.margin} />
                </div>
            </div>

            {first && (
                <div className="space-y-2">
                    <Label>{t('preview')}</Label>
                    <div className="flex justify-center rounded-xl border bg-muted/30 p-4">
                        <WatermarkPreview
                            image={first}
                            logo={usesLogo ? logo : null}
                            text={text ?? ''}
                            color={color ?? WATERMARK_DEFAULTS.color}
                            position={(position as WatermarkPosition) ?? 'bottom-right'}
                            opacity={numeric(opacity, 100)}
                            scale={numeric(scale, 30)}
                            margin={numeric(margin, 0)}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t('previewHint')}
                        {images.length > 1 && ` ${t('previewBatch')}`}
                    </p>
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
                disabled={!hasImages || !isValid || missingLogo || overBudget || isPending}
            >
                {isPending ? (
                    <>
                        <Spinner /> {pendingLabel(t('pending'), progress)}
                    </>
                ) : missingLogo ? (
                    t('needLogo')
                ) : overBudget ? (
                    t('overBudgetSubmit', { max: MAX_BATCH_SIZE_LABEL })
                ) : autoDownload ? (
                    t('submitDownload')
                ) : (
                    t('submit')
                )}
            </Button>
        </form>
    );
}
