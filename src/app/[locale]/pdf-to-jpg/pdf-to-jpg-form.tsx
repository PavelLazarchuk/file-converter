'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { FieldError } from '@/components/field-error';
import { IntegerInput } from '@/components/integer-input';
import { PdfDropzone, useLoadedPdfs } from '@/components/pdf-dropzone';
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
import {
    BROWSER_OUTPUT_KEYS,
    DEFAULT_QUALITY,
    MAX_PDF_PARTS,
    PDF_RENDER_DPI_KEYS,
    QUALITY_LIMITS,
    browserOutputTakesQuality,
} from '@/lib/image';
import { pdfToImages } from '@/lib/pdf-render';
import { pdfToImagesSchema, type PdfToImagesInput, type PdfToImagesValues } from '@/lib/schemas';

const defaultValues: PdfToImagesInput = {
    format: 'jpeg',
    dpi: '150',
    quality: String(DEFAULT_QUALITY),
    pages: '',
};

export function PdfToJpgForm() {
    const t = useTranslations('PdfToImages');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const pendingLabel = usePendingLabel();
    const { documents, addPdfs, removePdf, clearPdfs } = useLoadedPdfs(1);
    const { isPending, outcome, isLeaving, progress, run, clearResult, downloadAll, autoDownload } =
        useFileAction(pdfToImages, 'pages.zip');

    const {
        control,
        register,
        handleSubmit,
        setValue,
        formState: { errors, isValid },
    } = useForm<PdfToImagesInput, unknown, PdfToImagesValues>({
        resolver: zodResolver(pdfToImagesSchema),
        mode: 'onChange',
        defaultValues,
    });

    const format = useWatch({ control, name: 'format' }) ?? 'jpeg';
    const dpi = useWatch({ control, name: 'dpi' }) ?? '150';
    const pages = useWatch({ control, name: 'pages' }) ?? '';
    const hasPdf = documents.length > 0;

    const onSubmit = handleSubmit(values => {
        if (!hasPdf) return;

        run(documents, { format: values.format, dpi: values.dpi, quality: values.quality, pages });
    });

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <PdfDropzone
                documents={documents}
                max={1}
                disabled={isPending}
                onAdd={added => {
                    addPdfs(added);
                    clearResult();
                }}
                onRemove={index => {
                    removePdf(index);
                    clearResult();
                }}
                onClear={() => {
                    clearPdfs();
                    clearResult();
                }}
            />

            <div className="space-y-2">
                <Label htmlFor="format">{t('format')}</Label>
                <Controller
                    control={control}
                    name="format"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? 'jpeg'}
                            onValueChange={value => {
                                field.onChange(value);
                                clearResult();

                                if (value === 'png') {
                                    setValue('quality', String(DEFAULT_QUALITY), {
                                        shouldValidate: true,
                                    });
                                }
                            }}
                            disabled={!hasPdf || isPending}
                        >
                            <SelectTrigger
                                id="format"
                                className="w-full"
                                aria-invalid={!!errors.format}
                                aria-describedby={errors.format ? 'format-error' : undefined}
                            >
                                <SelectValue placeholder={form('chooseOutputFormat')} />
                            </SelectTrigger>
                            <SelectContent>
                                {BROWSER_OUTPUT_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`formats.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {!browserOutputTakesQuality(format) && (
                    <p className="text-sm text-muted-foreground">{t('pngNote')}</p>
                )}
                <FieldError id="format-error" error={errors.format} />
            </div>

            {browserOutputTakesQuality(format) && (
                <div className="space-y-2">
                    <Label htmlFor="quality">
                        {t('quality', { min: QUALITY_LIMITS.min, max: QUALITY_LIMITS.max })}
                    </Label>
                    <IntegerInput
                        id="quality"
                        min={QUALITY_LIMITS.min}
                        max={QUALITY_LIMITS.max}
                        disabled={!hasPdf || isPending}
                        aria-invalid={!!errors.quality}
                        aria-describedby={errors.quality ? 'quality-error' : undefined}
                        {...register('quality', { onChange: clearResult })}
                    />
                    <p className="text-sm text-muted-foreground">{t('qualityHint')}</p>
                    <FieldError id="quality-error" error={errors.quality} />
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="dpi">{t('dpi')}</Label>
                <Controller
                    control={control}
                    name="dpi"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? '150'}
                            onValueChange={value => {
                                field.onChange(value);
                                clearResult();
                            }}
                            disabled={!hasPdf || isPending}
                        >
                            <SelectTrigger
                                id="dpi"
                                className="w-full"
                                aria-invalid={!!errors.dpi}
                                aria-describedby={errors.dpi ? 'dpi-error' : undefined}
                            >
                                <SelectValue placeholder={form('chooseDpi')} />
                            </SelectTrigger>
                            <SelectContent>
                                {PDF_RENDER_DPI_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`pdfDpi.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <p className="text-sm text-muted-foreground">{labels(`pdfDpi.${dpi}Hint`)}</p>
                <FieldError id="dpi-error" error={errors.dpi} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="pages">{t('pages')}</Label>
                <Input
                    id="pages"
                    autoComplete="off"
                    placeholder={t('pagesPlaceholder')}
                    disabled={!hasPdf || isPending}
                    aria-invalid={!!errors.pages}
                    aria-describedby={errors.pages ? 'pages-error' : undefined}
                    {...register('pages', { onChange: clearResult })}
                />
                <p className="text-sm text-muted-foreground">
                    {t('pagesHint', { max: MAX_PDF_PARTS })}
                </p>
                <FieldError id="pages-error" error={errors.pages} />
            </div>

            <p className="text-sm text-muted-foreground">{t('note')}</p>

            {outcome && (
                <ResultCard
                    outcome={outcome}
                    leaving={isLeaving}
                    onDismiss={clearResult}
                    onDownloadAll={downloadAll}
                />
            )}

            <Button type="submit" className="w-full" disabled={!hasPdf || !isValid || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> {pendingLabel(t('pending'), progress)}
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
