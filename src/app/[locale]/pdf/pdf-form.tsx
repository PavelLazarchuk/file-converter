'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { FieldError } from '@/components/field-error';

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
import { useFileAction } from '@/hooks/use-file-action';
import { imageToPdf } from '@/lib/actions';
import { CONVERT_SOURCE_KEYS, MAX_BATCH_FILES, PDF_PAGE_SIZE_KEYS } from '@/lib/image';
import { imageToPdfSchema, type ImageToPdfInput, type ImageToPdfValues } from '@/lib/schemas';

export function PdfForm() {
    const t = useTranslations('ImagesToPdf');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const count = useTranslations('Common');
    const { images, addImages, removeImage, moveImage, clearImages } =
        useLoadedImages(MAX_BATCH_FILES);
    const { isPending, outcome, isLeaving, run, clearResult, downloadAll, autoDownload } =
        useFileAction(imageToPdf, undefined, { chunkSize: null });

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
                    {t('batchNote', {
                        images: count('images', { count: images.length }),
                        pages: count('pages', { count: images.length }),
                    })}
                </p>
            )}

            <div className="space-y-2">
                <Label htmlFor="pageSize">{t('pageSize')}</Label>
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
                                aria-describedby={errors.pageSize ? 'pageSize-error' : undefined}
                            >
                                <SelectValue placeholder={form('choosePageSize')} />
                            </SelectTrigger>
                            <SelectContent>
                                {PDF_PAGE_SIZE_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`pageSizes.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <p className="text-sm text-muted-foreground">
                    {labels(`pageSizes.${pageSize}Hint`)}
                </p>
                <FieldError id="pageSize-error" error={errors.pageSize} />
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
