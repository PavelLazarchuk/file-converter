'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ImageDropzone, useLoadedImage } from '@/components/image-dropzone';
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
import { useImageAction } from '@/hooks/use-image-action';
import { resizeImage } from '@/lib/actions';
import {
    DIMENSION_LIMITS,
    RESIZE_FITS,
    RESIZE_FIT_KEYS,
    ROTATIONS,
    ROTATION_KEYS,
    rotationSwapsDimensions,
} from '@/lib/image';
import { resizeSchema, type ResizeInput, type ResizeValues } from '@/lib/schemas';

const defaultValues: ResizeInput = { width: '', height: '', rotate: '0', fit: 'contain' };

function clampDimension(value: number): number {
    return Math.min(DIMENSION_LIMITS.max, Math.max(DIMENSION_LIMITS.min, Math.round(value)));
}

export function ResizeForm() {
    const { image, setImage } = useLoadedImage();
    const [lockAspect, setLockAspect] = useState(true);
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const [noEnlarge, setNoEnlarge] = useState(false);
    const { isPending, outcome, run, clearResult, autoDownload } = useImageAction(resizeImage);

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
    const sourceRatio = image ? image.width / image.height : null;
    const ratio = sourceRatio && rotationSwapsDimensions(rotate) ? 1 / sourceRatio : sourceRatio;

    function syncLinkedDimension(
        changed: 'width' | 'height',
        rawValue: string,
        locked = lockAspect
    ) {
        if (!locked || !ratio || !/^\d+$/.test(rawValue)) return;

        const value = Number(rawValue);

        if (value < DIMENSION_LIMITS.min) return;

        const linked = changed === 'width' ? value / ratio : value * ratio;

        setValue(changed === 'width' ? 'height' : 'width', String(clampDimension(linked)), {
            shouldValidate: true,
        });
    }

    const onSubmit = handleSubmit(values => {
        if (!image) return;

        run(image, {
            width: String(values.width),
            height: String(values.height),
            rotate: values.rotate,
            fit: values.fit,
            noEnlarge: String(noEnlarge),
            keepMetadata: String(!removeMetadata),
        });
    });

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                image={image}
                disabled={isPending}
                onImage={loaded => {
                    setImage(loaded);
                    clearResult();
                    reset({
                        ...defaultValues,
                        width: String(loaded.width),
                        height: String(loaded.height),
                    });
                    void trigger();
                }}
                onClear={() => {
                    setImage(null);
                    clearResult();
                    reset(defaultValues);
                }}
            />

            <div className="space-y-2">
                <Label htmlFor="rotate">Rotation</Label>
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
                                if (image && swapChanged) {
                                    const { width, height } = getValues();
                                    setValue('width', height, { shouldValidate: true });
                                    setValue('height', width, { shouldValidate: true });
                                }
                            }}
                            disabled={!image || isPending}
                        >
                            <SelectTrigger
                                id="rotate"
                                className="w-full"
                                aria-invalid={!!errors.rotate}
                            >
                                <SelectValue placeholder="Choose a rotation" />
                            </SelectTrigger>
                            <SelectContent>
                                {ROTATION_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {ROTATIONS[key].label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.rotate && (
                    <p className="text-sm text-destructive">{errors.rotate.message}</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="width">Width (px)</Label>
                    <IntegerInput
                        id="width"
                        min={DIMENSION_LIMITS.min}
                        max={DIMENSION_LIMITS.max}
                        placeholder="e.g. 1920"
                        disabled={!image || isPending}
                        aria-invalid={!!errors.width}
                        {...register('width', {
                            onChange: event => syncLinkedDimension('width', event.target.value),
                        })}
                    />
                    {errors.width && (
                        <p className="text-sm text-destructive">{errors.width.message}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="height">Height (px)</Label>
                    <IntegerInput
                        id="height"
                        min={DIMENSION_LIMITS.min}
                        max={DIMENSION_LIMITS.max}
                        placeholder="e.g. 1080"
                        disabled={!image || isPending}
                        aria-invalid={!!errors.height}
                        {...register('height', {
                            onChange: event => syncLinkedDimension('height', event.target.value),
                        })}
                    />
                    {errors.height && (
                        <p className="text-sm text-destructive">{errors.height.message}</p>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="fit">Fit</Label>
                <Controller
                    control={control}
                    name="fit"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? 'contain'}
                            onValueChange={field.onChange}
                            disabled={!image || isPending}
                        >
                            <SelectTrigger id="fit" className="w-full" aria-invalid={!!errors.fit}>
                                <SelectValue placeholder="Choose how the image should fit" />
                            </SelectTrigger>
                            <SelectContent>
                                {RESIZE_FIT_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {RESIZE_FITS[key].label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <p className="text-sm text-muted-foreground">
                    {RESIZE_FITS[fit ?? 'contain'].description}
                </p>
                {errors.fit && <p className="text-sm text-destructive">{errors.fit.message}</p>}
            </div>

            <div className="flex items-center gap-3">
                <Switch
                    id="lock-aspect"
                    checked={lockAspect}
                    disabled={!image || isPending}
                    onCheckedChange={checked => {
                        setLockAspect(checked);
                        if (checked) syncLinkedDimension('width', getValues('width'), true);
                    }}
                />
                <Label htmlFor="lock-aspect">Lock aspect ratio</Label>
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                    <Switch
                        id="no-enlarge"
                        checked={noEnlarge}
                        disabled={!image || isPending}
                        onCheckedChange={setNoEnlarge}
                    />
                    <Label htmlFor="no-enlarge">Don&apos;t enlarge smaller images</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                    Leaves the image at its original size when it is already smaller than the target
                    — upscaling only adds blur.
                </p>
            </div>

            <MetadataSwitch
                checked={removeMetadata}
                onCheckedChange={setRemoveMetadata}
                disabled={!image || isPending}
            />

            {outcome && (
                <ResultCard
                    outcome={outcome}
                    original={image && { size: image.file.size }}
                    onDismiss={clearResult}
                />
            )}

            <Button type="submit" className="w-full" disabled={!image || !isValid || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> Resizing…
                    </>
                ) : autoDownload ? (
                    'Resize & download'
                ) : (
                    'Resize'
                )}
            </Button>
        </form>
    );
}
