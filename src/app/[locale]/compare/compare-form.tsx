'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { FieldError } from '@/components/field-error';
import { ImageDropzone, useLoadedImages } from '@/components/image-dropzone';
import { IntegerInput } from '@/components/integer-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useFileAction } from '@/hooks/use-file-action';
import { compareFormats } from '@/lib/actions';
import type { ActionFile } from '@/lib/actions';
import { COMPARE_FORMAT_KEYS, DEFAULT_QUALITY, QUALITY_LIMITS } from '@/lib/image';
import { compareSchema, type CompareInput, type CompareValues } from '@/lib/schemas';

import { FormatComparison } from './format-comparison';

type Comparison = { files: ActionFile[]; quality: number };

export function CompareForm() {
    const t = useTranslations('Compare');
    const { images, addImages, clearImages } = useLoadedImages();
    const [comparison, setComparison] = useState<Comparison | null>(null);
    const { isPending, run } = useFileAction(compareFormats);

    const {
        register,
        handleSubmit,
        trigger,
        formState: { errors, isValid },
    } = useForm<CompareInput, unknown, CompareValues>({
        resolver: zodResolver(compareSchema),
        mode: 'onChange',
        defaultValues: { quality: String(DEFAULT_QUALITY) },
    });

    const hasImage = images.length > 0;

    const onSubmit = handleSubmit(values => {
        if (!hasImage) return;

        run(
            images,
            { quality: values.quality },
            {
                onResult: files => {
                    if (files.length) setComparison({ files, quality: values.quality });

                    return 'handled';
                },
            }
        );
    });

    function reset() {
        setComparison(null);
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                images={images}
                disabled={isPending}
                onAdd={loaded => {
                    addImages(loaded);
                    reset();
                    void trigger();
                }}
                onRemove={() => {
                    clearImages();
                    reset();
                }}
                onClear={() => {
                    clearImages();
                    reset();
                }}
            />

            <div className="space-y-2">
                <Label htmlFor="quality">
                    {t('quality', { min: QUALITY_LIMITS.min, max: QUALITY_LIMITS.max })}
                </Label>
                <IntegerInput
                    id="quality"
                    min={QUALITY_LIMITS.min}
                    max={QUALITY_LIMITS.max}
                    disabled={!hasImage || isPending}
                    aria-invalid={!!errors.quality}
                    {...register('quality')}
                />
                <p className="text-sm text-muted-foreground">{t('qualityHint')}</p>
                <FieldError error={errors.quality} />
            </div>

            {comparison && (
                <FormatComparison
                    files={comparison.files}
                    quality={comparison.quality}
                    onDismiss={reset}
                />
            )}

            <Button type="submit" className="w-full" disabled={!hasImage || !isValid || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> {t('pending', { count: COMPARE_FORMAT_KEYS.length })}
                    </>
                ) : (
                    t('submit')
                )}
            </Button>
        </form>
    );
}
