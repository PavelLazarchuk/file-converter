'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ImageDropzone, useLoadedImages } from '@/components/image-dropzone';
import { IntegerInput } from '@/components/integer-input';
import { MetadataSwitch } from '@/components/metadata-switch';
import { ResultCard } from '@/components/result-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { useImageAction } from '@/hooks/use-image-action';
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
    const { images, addImages, removeImage, clearImages } = useLoadedImages(MAX_BATCH_FILES);
    const [flipHorizontal, setFlipHorizontal] = useState(false);
    const [flipVertical, setFlipVertical] = useState(false);
    const [transparent, setTransparent] = useState(false);
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const { isPending, outcome, isLeaving, run, clearResult, downloadAll, autoDownload } =
        useImageAction(rotateImage, 'rotated-images.zip');

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
            angle: String(values.angle),
            background: values.background,
            transparent: String(transparent),
            flipHorizontal: String(flipHorizontal),
            flipVertical: String(flipVertical),
            keepMetadata: String(!removeMetadata),
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
                <Label>Rotation</Label>
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
                            {preset}° clockwise
                        </Button>
                    ))}
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!hasImages || isPending || angle === 0}
                        onClick={() => pickAngle(0)}
                    >
                        Reset
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="angle">Angle (degrees clockwise)</Label>
                <IntegerInput
                    id="angle"
                    min={ROTATE_ANGLE_LIMITS.min}
                    max={ROTATE_ANGLE_LIMITS.max}
                    placeholder="e.g. 90"
                    disabled={!hasImages || isPending}
                    aria-invalid={!!errors.angle}
                    {...register('angle', { onChange: clearResult })}
                />
                {errors.angle && <p className="text-sm text-destructive">{errors.angle.message}</p>}
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
                    <Label htmlFor="flip-horizontal">Mirror horizontally</Label>
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
                    <Label htmlFor="flip-vertical">Flip vertically</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                    Flips are applied after the rotation.
                </p>
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
                            <Label htmlFor="transparent">Transparent corners</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            An angle that isn&apos;t a multiple of 90° exposes corners.{' '}
                            {transparent
                                ? 'They stay transparent — except in JPEG, which has no alpha channel and falls back to the color below.'
                                : 'They are filled with the color below.'}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="background">Corner color</Label>
                        <Input
                            id="background"
                            type="color"
                            className="h-9 cursor-pointer p-1"
                            disabled={isPending}
                            aria-invalid={!!errors.background}
                            {...register('background', { onChange: clearResult })}
                        />
                        {errors.background && (
                            <p className="text-sm text-destructive">{errors.background.message}</p>
                        )}
                    </div>
                </div>
            )}

            {first && (
                <div className="space-y-2">
                    <Label>Preview</Label>
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
                    <p className="text-sm text-muted-foreground">
                        Approximate preview of the first image. The download is rendered at full
                        size, with the canvas grown to fit the rotation.
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
                disabled={!hasImages || !isValid || nothingToDo || isPending}
            >
                {isPending ? (
                    <>
                        <Spinner /> Rotating…
                    </>
                ) : nothingToDo ? (
                    'Pick an angle or a flip'
                ) : autoDownload ? (
                    'Rotate & download'
                ) : (
                    'Rotate'
                )}
            </Button>
        </form>
    );
}
