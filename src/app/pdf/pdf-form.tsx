'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ImageDropzone, useLoadedImage } from '@/components/image-dropzone';
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
import { CONVERT_SOURCE_KEYS, PDF_PAGE_SIZES, PDF_PAGE_SIZE_KEYS } from '@/lib/image';
import { imageToPdfSchema, type ImageToPdfInput, type ImageToPdfValues } from '@/lib/schemas';

export function PdfForm() {
    const { image, setImage } = useLoadedImage();
    const { isPending, outcome, run, clearResult, autoDownload } = useImageAction(imageToPdf);

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

    const onSubmit = handleSubmit(values => {
        if (!image) return;

        run(image, { pageSize: values.pageSize });
    });

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                image={image}
                formats={CONVERT_SOURCE_KEYS}
                disabled={isPending}
                onImage={loaded => {
                    setImage(loaded);
                    clearResult();
                    void trigger();
                }}
                onClear={() => {
                    setImage(null);
                    clearResult();
                }}
            />

            <div className="space-y-2">
                <Label htmlFor="pageSize">Page size</Label>
                <Controller
                    control={control}
                    name="pageSize"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? 'fit'}
                            onValueChange={field.onChange}
                            disabled={!image || isPending}
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
                    original={image && { size: image.file.size }}
                    onDismiss={clearResult}
                />
            )}

            <Button type="submit" className="w-full" disabled={!image || !isValid || isPending}>
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
