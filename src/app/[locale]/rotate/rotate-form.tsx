'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useForm, useWatch } from 'react-hook-form';
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
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { usePendingLabel, useFileAction } from '@/hooks/use-file-action';
import { rotateImage } from '@/lib/actions';
import {
    MAX_BATCH_FILES,
    ROTATE_ANGLE_LIMITS,
    ROTATE_ANGLE_PRESETS,
    ROTATE_DEFAULTS,
    rotateFillsCorners,
} from '@/lib/image';
import { rotateSchema, type RotateInput, type RotateValues } from '@/lib/schemas';
import { cn } from '@/lib/utils';

const defaultValues: RotateInput = { ...ROTATE_DEFAULTS };

const PREVIEW_BOX = 224;

export function RotateForm() {
    const t = useTranslations('Rotate');
    const pendingLabel = usePendingLabel();
    const { images, addImages, removeImage, clearImages } = useLoadedImages(MAX_BATCH_FILES);
    const [flipHorizontal, setFlipHorizontal] = useState(false);
    const [flipVertical, setFlipVertical] = useState(false);
    const [transparent, setTransparent] = useState(false);
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const { isPending, outcome, isLeaving, progress, run, clearResult, downloadAll, autoDownload } =
        useFileAction(rotateImage, 'rotated-images.zip');

    const {
        register,
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { errors, isValid },
    } = useForm<RotateInput, unknown, RotateValues>({
        resolver: zodResolver(rotateSchema),
        mode: 'onChange',
        defaultValues,
    });

    const angleRaw = useWatch({ control, name: 'angle' });
    const angle = /^\d+$/.test(angleRaw ?? '') ? Number(angleRaw) : 0;
    const hasImages = images.length > 0;
    const first = images[0] ?? null;
    const nothingToDo = angle === 0 && !flipHorizontal && !flipVertical;
    const fillsCorners = rotateFillsCorners(angle);

    function pickAngle(value: number) {
        setValue('angle', String(value), { shouldValidate: true });
        clearResult();
    }

    const onSubmit = handleSubmit(values => {
        if (!hasImages || nothingToDo) return;

        run(images, {
            angle: values.angle,
            background: values.background,
            transparent,
            flipHorizontal,
            flipVertical,
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
                    clearResult();
                    reset(defaultValues);
                    setFlipHorizontal(false);
                    setFlipVertical(false);
                }}
            />

            <div className="space-y-2">
                <Label>{t('rotation')}</Label>
                <div className="flex flex-wrap gap-2">
                    {ROTATE_ANGLE_PRESETS.map(preset => (
                        <Button
                            key={preset}
                            type="button"
                            size="sm"
                            variant={angle === preset ? 'default' : 'outline'}
                            aria-pressed={angle === preset}
                            disabled={!hasImages || isPending}
                            onClick={() => pickAngle(preset)}
                            className={cn(angle !== preset && 'text-muted-foreground')}
                        >
                            {t('clockwise', { angle: preset })}
                        </Button>
                    ))}
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!hasImages || isPending || angle === 0}
                        onClick={() => pickAngle(0)}
                    >
                        {t('reset')}
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="angle">{t('angle')}</Label>
                <IntegerInput
                    id="angle"
                    min={ROTATE_ANGLE_LIMITS.min}
                    max={ROTATE_ANGLE_LIMITS.max}
                    placeholder={t('anglePlaceholder')}
                    disabled={!hasImages || isPending}
                    aria-invalid={!!errors.angle}
                    aria-describedby={errors.angle ? 'angle-error' : undefined}
                    {...register('angle', { onChange: clearResult })}
                />
                <FieldError id="angle-error" error={errors.angle} />
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <Switch
                        id="flip-horizontal"
                        checked={flipHorizontal}
                        disabled={!hasImages || isPending}
                        onCheckedChange={checked => {
                            setFlipHorizontal(checked);
                            clearResult();
                        }}
                    />
                    <Label htmlFor="flip-horizontal">{t('mirror')}</Label>
                </div>
                <div className="flex items-center gap-3">
                    <Switch
                        id="flip-vertical"
                        checked={flipVertical}
                        disabled={!hasImages || isPending}
                        onCheckedChange={checked => {
                            setFlipVertical(checked);
                            clearResult();
                        }}
                    />
                    <Label htmlFor="flip-vertical">{t('flip')}</Label>
                </div>
                <p className="text-sm text-muted-foreground">{t('flipHint')}</p>
            </div>

            {fillsCorners && (
                <div className="space-y-4 rounded-xl border bg-card p-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="transparent"
                                checked={transparent}
                                disabled={isPending}
                                onCheckedChange={checked => {
                                    setTransparent(checked);
                                    clearResult();
                                }}
                            />
                            <Label htmlFor="transparent">{t('transparent')}</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {t('cornersHint')}{' '}
                            {transparent ? t('cornersTransparent') : t('cornersFilled')}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="background">{t('cornerColor')}</Label>
                        <Input
                            id="background"
                            type="color"
                            className="h-9 cursor-pointer p-1"
                            disabled={isPending}
                            aria-invalid={!!errors.background}
                            aria-describedby={errors.background ? 'background-error' : undefined}
                            {...register('background', { onChange: clearResult })}
                        />
                        <FieldError id="background-error" error={errors.background} />
                    </div>
                </div>
            )}

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
                            className="max-h-[70%] w-auto max-w-[70%] object-contain transition-transform duration-300 ease-out motion-reduce:transition-none"
                            style={{
                                transform: `rotate(${angle}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
                            }}
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
