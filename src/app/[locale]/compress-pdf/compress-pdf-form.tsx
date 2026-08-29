'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { FieldError } from '@/components/field-error';
import { PdfDropzone, useLoadedPdfs } from '@/components/pdf-dropzone';
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
import { usePendingLabel, useFileAction } from '@/hooks/use-file-action';
import { compressPdf } from '@/lib/actions';
import { MAX_BATCH_FILES, PDF_COMPRESS_LEVELS, PDF_COMPRESS_LEVEL_KEYS } from '@/lib/image';
import { compressPdfSchema, type CompressPdfInput, type CompressPdfValues } from '@/lib/schemas';

const defaultValues: CompressPdfInput = { level: 'balanced' };

export function CompressPdfForm() {
    const t = useTranslations('CompressPdf');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const pendingLabel = usePendingLabel();
    const { documents, addPdfs, removePdf, clearPdfs } = useLoadedPdfs(MAX_BATCH_FILES);
    const { isPending, outcome, isLeaving, progress, run, clearResult, downloadAll, autoDownload } =
        useFileAction(compressPdf, 'compressed-pdfs.zip');

    const {
        control,
        handleSubmit,
        formState: { errors, isValid },
    } = useForm<CompressPdfInput, unknown, CompressPdfValues>({
        resolver: zodResolver(compressPdfSchema),
        mode: 'onChange',
        defaultValues,
    });

    const level = useWatch({ control, name: 'level' }) ?? 'balanced';
    const hasPdf = documents.length > 0;

    const onSubmit = handleSubmit(values => {
        if (!hasPdf) return;

        run(documents, { level: values.level });
    });

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <PdfDropzone
                documents={documents}
                max={MAX_BATCH_FILES}
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
                <Label htmlFor="level">{t('level')}</Label>
                <Controller
                    control={control}
                    name="level"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? 'balanced'}
                            onValueChange={value => {
                                field.onChange(value);
                                clearResult();
                            }}
                            disabled={!hasPdf || isPending}
                        >
                            <SelectTrigger
                                id="level"
                                className="w-full"
                                aria-invalid={!!errors.level}
                                aria-describedby={errors.level ? 'level-error' : undefined}
                            >
                                <SelectValue placeholder={form('choosePdfLevel')} />
                            </SelectTrigger>
                            <SelectContent>
                                {PDF_COMPRESS_LEVEL_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`pdfCompressLevels.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <p className="text-sm text-muted-foreground">
                    {labels(`pdfCompressLevels.${level}Hint`, {
                        width: PDF_COMPRESS_LEVELS[level].maxWidth ?? 0,
                    })}
                </p>
                <FieldError id="level-error" error={errors.level} />
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
