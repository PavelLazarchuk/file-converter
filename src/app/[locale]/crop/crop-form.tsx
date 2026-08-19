'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { FieldError } from '@/components/field-error';
import { ImageDropzone, useLoadedImages } from '@/components/image-dropzone';
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
import { useFileAction } from '@/hooks/use-file-action';
import { cropImage } from '@/lib/actions';
import {
    CROP_RATIO_KEYS,
    CROP_SHAPE_KEYS,
    centeredCrop,
    cropRatioForSize,
    cropRatioSize,
    defaultFreeCrop,
    type CropBox,
    type SizePreset,
} from '@/lib/image';
import { cropFormSchema, type CropFormInput, type CropFormValues } from '@/lib/schemas';
import { CropArea } from './crop-area';
import { CropFields } from './crop-fields';

const defaultValues: CropFormInput = { ratio: '1:1', shape: 'rectangle' };

export function CropForm() {
    const t = useTranslations('Crop');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const { images, addImages, clearImages } = useLoadedImages();
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const [preset, setPreset] = useState<SizePreset | null>(null);
    const [manualBox, setManualBox] = useState<{ key: string; box: CropBox } | null>(null);
    const { isPending, outcome, isLeaving, run, clearResult, downloadAll, autoDownload } =
        useFileAction(cropImage);
    const image = images[0] ?? null;

    const {
        control,
        handleSubmit,
        reset,
        setValue,
        trigger,
        formState: { errors, isValid },
    } = useForm<CropFormInput, unknown, CropFormValues>({
        resolver: zodResolver(cropFormSchema),
        mode: 'onChange',
        defaultValues,
    });

    const ratioKey = useWatch({ control, name: 'ratio' });
    const shape = useWatch({ control, name: 'shape' });
    const ratio = preset
        ? { width: preset.width, height: preset.height }
        : ratioKey
          ? cropRatioSize(ratioKey)
          : null;
    const boxKey = image && ratioKey ? `${image.previewUrl}|${preset?.key ?? ratioKey}` : null;
    const defaultBox =
        image && ratioKey
            ? ratio
                ? centeredCrop(image.width, image.height, ratio.width, ratio.height)
                : defaultFreeCrop(image.width, image.height)
            : null;
    const box = manualBox && manualBox.key === boxKey ? manualBox.box : defaultBox;

    function resetForm() {
        clearImages();
        setManualBox(null);
        setPreset(null);
        clearResult();
        reset(defaultValues);
    }

    const onSubmit = handleSubmit(values => {
        if (!image || !box) return;

        run(images, {
            ratio: values.ratio,
            shape: values.shape,
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            keepMetadata: !removeMetadata,
            ...(preset ? { resizeTo: `${preset.width}x${preset.height}` } : {}),
        });
    });

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                images={images}
                disabled={isPending}
                onAdd={loaded => {
                    addImages(loaded);
                    setManualBox(null);
                    clearResult();
                    void trigger();
                }}
                onRemove={resetForm}
                onClear={resetForm}
            />

            <SizePresets
                activeKey={preset?.key ?? null}
                disabled={!image || isPending}
                hint={`${t('presetHint')}${preset ? ` ${t('presetActiveHint')}` : ''}`}
                onSelect={next => {
                    const cleared = preset?.key === next.key;

                    setPreset(cleared ? null : next);
                    setManualBox(null);
                    clearResult();

                    if (!cleared)
                        setValue('ratio', cropRatioForSize(next), { shouldValidate: true });
                }}
            />

            <div className="space-y-2">
                <Label htmlFor="ratio">{t('ratio')}</Label>
                <Controller
                    control={control}
                    name="ratio"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? ''}
                            onValueChange={value => {
                                setPreset(null);
                                field.onChange(value);
                            }}
                            disabled={!image || isPending}
                        >
                            <SelectTrigger
                                id="ratio"
                                className="w-full"
                                aria-invalid={!!errors.ratio}
                            >
                                <SelectValue placeholder={form('chooseRatio')} />
                            </SelectTrigger>
                            <SelectContent>
                                {CROP_RATIO_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`ratios.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <FieldError error={errors.ratio} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="shape">{t('shape')}</Label>
                <Controller
                    control={control}
                    name="shape"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? ''}
                            onValueChange={field.onChange}
                            disabled={!image || isPending}
                        >
                            <SelectTrigger
                                id="shape"
                                className="w-full"
                                aria-invalid={!!errors.shape}
                            >
                                <SelectValue placeholder={form('chooseShape')} />
                            </SelectTrigger>
                            <SelectContent>
                                {CROP_SHAPE_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`shapes.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {shape === 'circle' && (
                    <p className="text-sm text-muted-foreground">{t('circleHint')}</p>
                )}
                <FieldError error={errors.shape} />
            </div>

            {image && box && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <CropArea
                            image={image}
                            ratio={ratio}
                            box={box}
                            shape={shape}
                            disabled={isPending}
                            onChange={next => {
                                if (boxKey) setManualBox({ key: boxKey, box: next });
                            }}
                        />
                        <p className="text-sm text-muted-foreground">
                            {t('output', {
                                width: preset ? preset.width : box.width,
                                height: preset ? preset.height : box.height,
                            })}
                            {preset
                                ? ` ${t('outputScaled', {
                                      width: box.width,
                                      height: box.height,
                                  })}`
                                : ''}{' '}
                            {ratio ? t('dragCorner') : t('dragEdge')}
                        </p>
                    </div>
                    <CropFields
                        box={box}
                        source={{ width: image.width, height: image.height }}
                        ratio={ratio}
                        disabled={isPending}
                        onChange={next => {
                            if (boxKey) setManualBox({ key: boxKey, box: next });
                        }}
                    />
                </div>
            )}

            <MetadataSwitch
                checked={removeMetadata}
                onCheckedChange={setRemoveMetadata}
                disabled={!image || isPending}
            />

            {outcome && (
                <ResultCard
                    outcome={outcome}
                    leaving={isLeaving}
                    onDismiss={clearResult}
                    onDownloadAll={downloadAll}
                />
            )}

            <Button type="submit" className="w-full" disabled={!image || !isValid || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> {t('pending')}
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
