'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { FieldError } from '@/components/field-error';
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
import { useFileAction } from '@/hooks/use-file-action';
import { organizePdf } from '@/lib/actions';
import { PDF_ORGANIZE_MODE_KEYS } from '@/lib/image';
import { organizePdfSchema, type OrganizePdfInput, type OrganizePdfValues } from '@/lib/schemas';

export function OrganizePdfForm() {
    const t = useTranslations('OrganizePdf');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const { documents, addPdfs, removePdf, clearPdfs } = useLoadedPdfs(1);
    const { isPending, outcome, isLeaving, run, clearResult, downloadAll, autoDownload } =
        useFileAction(organizePdf, 'pages.zip');

    const {
        control,
        handleSubmit,
        trigger,
        formState: { errors, isValid },
    } = useForm<OrganizePdfInput, unknown, OrganizePdfValues>({
        resolver: zodResolver(organizePdfSchema),
        mode: 'onChange',
        defaultValues: { mode: 'remove', pages: '' },
    });

    const mode = useWatch({ control, name: 'mode' }) ?? 'remove';
    const pages = useWatch({ control, name: 'pages' }) ?? '';
    const hasPdf = documents.length > 0;

    const onSubmit = handleSubmit(() => {
        if (!hasPdf) return;

        run(documents, { mode, pages });
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
                    void trigger();
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
                <Label htmlFor="mode">{t('mode')}</Label>
                <Controller
                    control={control}
                    name="mode"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? 'remove'}
                            onValueChange={value => {
                                field.onChange(value);
                                clearResult();
                            }}
                            disabled={!hasPdf || isPending}
                        >
                            <SelectTrigger
                                id="mode"
                                className="w-full"
                                aria-invalid={!!errors.mode}
                                aria-describedby={errors.mode ? 'mode-error' : undefined}
                            >
                                <SelectValue placeholder={form('chooseOrganizeMode')} />
                            </SelectTrigger>
                            <SelectContent>
                                {PDF_ORGANIZE_MODE_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`organizeModes.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <p className="text-sm text-muted-foreground">
                    {labels(`organizeModes.${mode}Hint`)}
                </p>
                <FieldError id="mode-error" error={errors.mode} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="pages">{t('pages')}</Label>
                <Controller
                    control={control}
                    name="pages"
                    render={({ field }) => (
                        <Input
                            id="pages"
                            autoComplete="off"
                            placeholder={t('pagesPlaceholder')}
                            disabled={!hasPdf || isPending}
                            aria-invalid={!!errors.pages}
                            aria-describedby={errors.pages ? 'pages-error' : undefined}
                            {...field}
                            value={field.value ?? ''}
                        />
                    )}
                />
                <p className="text-sm text-muted-foreground">
                    {mode === 'reorder' ? t('pagesHintReorder') : t('pagesHintRemove')}
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
