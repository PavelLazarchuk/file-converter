'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ImageDropzone, useLoadedImages } from '@/components/image-dropzone';
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
import { imageToPdf } from '@/lib/actions';
import {
    CONVERT_SOURCE_KEYS,
    MAX_BATCH_FILES,
    PDF_PAGE_SIZES,
    PDF_PAGE_SIZE_KEYS,
    countLabel,
} from '@/lib/image';
import { imageToPdfSchema, type ImageToPdfInput, type ImageToPdfValues } from '@/lib/schemas';

export function PdfForm() {
    const { images, addImages, removeImage, moveImage, clearImages } =
        useLoadedImages(MAX_BATCH_FILES);
    const { isPending, outcome, isLeaving, run, clearResult, downloadAll, autoDownload } =
        useImageAction(imageToPdf, undefined, { chunkSize: null });

    const {
        control,
        handleSubmit,
        trigger,
        formState: { errors, isValid },
    } = useForm<ImageToPdfInput, unknown, ImageToPdfValues>({
        resolver: zodResolver(imageToPdfSchema),
        mode: 'onChange',
        defaultValues: { pageSize: 'fit' },
    });

    const pageSize = useWatch({ control, name: 'pageSize' }) ?? 'fit';
    const hasImages = images.length > 0;

    const onSubmit = handleSubmit(values => {
        if (!hasImages) return;

        run(images, { pageSize: values.pageSize });
    });

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                images={images}
                max={MAX_BATCH_FILES}
                formats={CONVERT_SOURCE_KEYS}
                disabled={isPending}
                onAdd={loaded => {
                    addImages(loaded);
                    clearResult();
                    void trigger();
                }}
                onRemove={index => {
                    removeImage(index);
                    clearResult();
                }}
                onMove={(from, to) => {
                    moveImage(from, to);
                    clearResult();
                }}
                onClear={() => {
                    clearImages();
                    clearResult();
                }}
            />

            {images.length > 1 && (
                <p className="text-sm text-muted-foreground">
                    {countLabel(images.length, 'image')} become {countLabel(images.length, 'page')}{' '}
                    in one PDF, in the order above — use the arrows to rearrange them.
                </p>
            )}

            <div className="space-y-2">
                <Label htmlFor="pageSize">Page size</Label>
                <Controller
                    control={control}
                    name="pageSize"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? 'fit'}
                            onValueChange={field.onChange}
                            disabled={!hasImages || isPending}
                        >
                            <SelectTrigger
                                id="pageSize"
                                className="w-full"
                                aria-invalid={!!errors.pageSize}
                            >
                                <SelectValue placeholder="Choose a page size" />
                            </SelectTrigger>
                            <SelectContent>
                                {PDF_PAGE_SIZE_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {PDF_PAGE_SIZES[key].label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <p className="text-sm text-muted-foreground">
                    {PDF_PAGE_SIZES[pageSize].description}
                </p>
                {errors.pageSize && (
                    <p className="text-sm text-destructive">{errors.pageSize.message}</p>
                )}
            </div>

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
                        <Spinner /> Building PDF…
                    </>
                ) : autoDownload ? (
                    'Convert & download'
                ) : (
                    'Convert to PDF'
                )}
            </Button>
        </form>
    );
}
