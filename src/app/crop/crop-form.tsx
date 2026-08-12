'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ImageDropzone, useLoadedImages } from '@/components/image-dropzone';
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
import { useImageAction } from '@/hooks/use-image-action';
import { cropImage } from '@/lib/actions';
import {
    CROP_RATIO_KEYS,
    CROP_SHAPES,
    CROP_SHAPE_KEYS,
    centeredCrop,
    cropRatioLabel,
    cropRatioSize,
    defaultFreeCrop,
    type CropBox,
} from '@/lib/image';
import { cropFormSchema, type CropFormInput, type CropFormValues } from '@/lib/schemas';
import { CropArea } from './crop-area';
import { CropFields } from './crop-fields';

const defaultValues: CropFormInput = { ratio: '1:1', shape: 'rectangle' };

export function CropForm() {
    const { images, addImages, clearImages } = useLoadedImages();
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const [manualBox, setManualBox] = useState<{ key: string; box: CropBox } | null>(null);
    const { isPending, outcome, run, clearResult, downloadAll, autoDownload } =
        useImageAction(cropImage);
    const image = images[0] ?? null;

    const {
        control,
        handleSubmit,
        reset,
        trigger,
        formState: { errors, isValid },
    } = useForm<CropFormInput, unknown, CropFormValues>({
        resolver: zodResolver(cropFormSchema),
        mode: 'onChange',
        defaultValues,
    });

    const ratioKey = useWatch({ control, name: 'ratio' });
    const shape = useWatch({ control, name: 'shape' });
    const ratio = ratioKey ? cropRatioSize(ratioKey) : null;
    const boxKey = image && ratioKey ? `${image.previewUrl}|${ratioKey}` : null;
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
        clearResult();
        reset(defaultValues);
    }

    const onSubmit = handleSubmit(values => {
        if (!image || !box) return;

        run(images, {
            ratio: values.ratio,
            shape: values.shape,
            left: String(box.left),
            top: String(box.top),
            width: String(box.width),
            height: String(box.height),
            keepMetadata: String(!removeMetadata),
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

            <div className="space-y-2">
                <Label htmlFor="ratio">Aspect ratio</Label>
                <Controller
                    control={control}
                    name="ratio"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? ''}
                            onValueChange={field.onChange}
                            disabled={!image || isPending}
                        >
                            <SelectTrigger
                                id="ratio"
                                className="w-full"
                                aria-invalid={!!errors.ratio}
                            >
                                <SelectValue placeholder="Choose an aspect ratio" />
                            </SelectTrigger>
                            <SelectContent>
                                {CROP_RATIO_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {cropRatioLabel(key)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.ratio && <p className="text-sm text-destructive">{errors.ratio.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="shape">Shape</Label>
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
                                <SelectValue placeholder="Choose a crop shape" />
                            </SelectTrigger>
                            <SelectContent>
                                {CROP_SHAPE_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {CROP_SHAPES[key].label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {shape === 'circle' && (
                    <p className="text-sm text-muted-foreground">
                        Keeps only the area inside the ellipse; the corners become transparent. JPEG
                        exports as PNG so the transparency is preserved.
                    </p>
                )}
                {errors.shape && <p className="text-sm text-destructive">{errors.shape.message}</p>}
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
                            Output: {box.width} × {box.height} px. Drag the frame to reposition it,
                            or pull {ratio ? 'a corner' : 'an edge or corner'} to resize.
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
                <ResultCard outcome={outcome} onDismiss={clearResult} onDownloadAll={downloadAll} />
            )}

            <Button type="submit" className="w-full" disabled={!image || !isValid || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> Cropping…
                    </>
                ) : autoDownload ? (
                    'Crop & download'
                ) : (
                    'Crop'
                )}
            </Button>
        </form>
    );
}
