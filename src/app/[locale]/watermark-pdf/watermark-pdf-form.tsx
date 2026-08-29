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
import { watermarkPdf } from '@/lib/actions';
import {
    MAX_BATCH_FILES,
    WATERMARK_ANGLE_LIMITS,
    WATERMARK_DEFAULTS,
    WATERMARK_LAYOUT_KEYS,
    WATERMARK_MARGIN_LIMITS,
    WATERMARK_OPACITY_LIMITS,
    WATERMARK_POSITION_KEYS,
    WATERMARK_SCALE_LIMITS,
    WATERMARK_TEXT_MAX_LENGTH,
    type WatermarkPosition,
} from '@/lib/image';
import { watermarkPdfSchema, type WatermarkPdfInput, type WatermarkPdfValues } from '@/lib/schemas';
import { cn } from '@/lib/utils';

const { text, color, position, opacity, scale, margin, layout, angle } = WATERMARK_DEFAULTS;

const defaultValues: WatermarkPdfInput = {
    text,
    color,
    position,
    opacity,
    scale,
    margin,
    layout,
    angle,
};

export function WatermarkPdfForm() {
    const t = useTranslations('WatermarkPdf');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const pendingLabel = usePendingLabel();
    const { documents, addPdfs, removePdf, clearPdfs } = useLoadedPdfs(MAX_BATCH_FILES);
    const { isPending, outcome, isLeaving, progress, run, clearResult, downloadAll, autoDownload } =
        useFileAction(watermarkPdf, 'watermarked-pdfs.zip');

    const {
        register,
        control,
        handleSubmit,
        formState: { errors, isValid },
    } = useForm<WatermarkPdfInput, unknown, WatermarkPdfValues>({
        resolver: zodResolver(watermarkPdfSchema),
        mode: 'onChange',
        defaultValues,
    });

    const [position, layout] = useWatch({ control, name: ['position', 'layout'] });
    const isTiled = layout === 'tile';
    const hasPdf = documents.length > 0;
    const locked = !hasPdf || isPending;

    const onSubmit = handleSubmit(values => {
        if (!hasPdf) return;

        run(documents, {
            text: values.text,
            color: values.color,
            position: values.position,
            opacity: values.opacity,
            scale: values.scale,
            margin: values.margin,
            layout: values.layout,
            angle: values.angle,
        });
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

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                    <Label htmlFor="text">{t('text')}</Label>
                    <Input
                        id="text"
                        placeholder={t('textPlaceholder')}
                        maxLength={WATERMARK_TEXT_MAX_LENGTH}
                        disabled={locked}
                        aria-invalid={!!errors.text}
                        aria-describedby={errors.text ? 'text-error' : undefined}
                        {...register('text', { onChange: clearResult })}
                    />
                    <FieldError id="text-error" error={errors.text} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="color">{t('color')}</Label>
                    <Input
                        id="color"
                        type="color"
                        className="h-9 w-full cursor-pointer p-1 sm:w-20"
                        disabled={locked}
                        aria-invalid={!!errors.color}
                        aria-describedby={errors.color ? 'color-error' : undefined}
                        {...register('color', { onChange: clearResult })}
                    />
                    <FieldError id="color-error" error={errors.color} />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="layout">{t('layout')}</Label>
                <Controller
                    control={control}
                    name="layout"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? 'single'}
                            onValueChange={value => {
                                clearResult();
                                field.onChange(value);
                            }}
                            disabled={locked}
                        >
                            <SelectTrigger
                                id="layout"
                                className="w-full"
                                aria-invalid={!!errors.layout}
                                aria-describedby={errors.layout ? 'layout-error' : undefined}
                            >
                                <SelectValue placeholder={form('chooseWatermarkLayout')} />
                            </SelectTrigger>
                            <SelectContent>
                                {WATERMARK_LAYOUT_KEYS.map(key => (
                                    <SelectItem key={key} value={key}>
                                        {labels(`watermarkLayouts.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <FieldError id="layout-error" error={errors.layout} />
                {isTiled && <p className="text-sm text-muted-foreground">{t('layoutHint')}</p>}
            </div>

            {!isTiled && (
                <div className="space-y-2">
                    <Label>{t('position')}</Label>
                    <Controller
                        control={control}
                        name="position"
                        render={({ field }) => (
                            <div className="grid w-fit grid-cols-3 gap-1.5">
                                {WATERMARK_POSITION_KEYS.map(key => {
                                    const active = field.value === key;

                                    return (
                                        <Button
                                            key={key}
                                            type="button"
                                            size="icon"
                                            variant={active ? 'default' : 'outline'}
                                            aria-pressed={active}
                                            aria-label={labels(`positions.${key}`)}
                                            title={labels(`positions.${key}`)}
                                            disabled={locked}
                                            onClick={() => {
                                                clearResult();
                                                field.onChange(key);
                                            }}
                                        >
                                            <span
                                                className={cn(
                                                    'size-2 rounded-full',
                                                    active ? 'bg-current' : 'bg-muted-foreground/50'
                                                )}
                                            />
                                        </Button>
                                    );
                                })}
                            </div>
                        )}
                    />
                    <p className="text-sm text-muted-foreground">
                        {labels(`positions.${(position as WatermarkPosition) ?? 'bottom-right'}`)}
                    </p>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                    <Label htmlFor="scale">{t('scale')}</Label>
                    <IntegerInput
                        id="scale"
                        min={WATERMARK_SCALE_LIMITS.min}
                        max={WATERMARK_SCALE_LIMITS.max}
                        disabled={locked}
                        aria-invalid={!!errors.scale}
                        aria-describedby={errors.scale ? 'scale-error' : undefined}
                        {...register('scale', { onChange: clearResult })}
                    />
                    <FieldError id="scale-error" error={errors.scale} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="opacity">{t('opacity')}</Label>
                    <IntegerInput
                        id="opacity"
                        min={WATERMARK_OPACITY_LIMITS.min}
                        max={WATERMARK_OPACITY_LIMITS.max}
                        disabled={locked}
                        aria-invalid={!!errors.opacity}
                        aria-describedby={errors.opacity ? 'opacity-error' : undefined}
                        {...register('opacity', { onChange: clearResult })}
                    />
                    <FieldError id="opacity-error" error={errors.opacity} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="margin">{isTiled ? t('marginTile') : t('margin')}</Label>
                    <IntegerInput
                        id="margin"
                        min={WATERMARK_MARGIN_LIMITS.min}
                        max={WATERMARK_MARGIN_LIMITS.max}
                        disabled={locked}
                        aria-invalid={!!errors.margin}
                        aria-describedby={errors.margin ? 'margin-error' : undefined}
                        {...register('margin', { onChange: clearResult })}
                    />
                    <FieldError id="margin-error" error={errors.margin} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="angle">{t('angle')}</Label>
                    <IntegerInput
                        id="angle"
                        min={WATERMARK_ANGLE_LIMITS.min}
                        max={WATERMARK_ANGLE_LIMITS.max}
                        disabled={locked}
                        aria-invalid={!!errors.angle}
                        aria-describedby={errors.angle ? 'angle-error' : undefined}
                        {...register('angle', { onChange: clearResult })}
                    />
                    <FieldError id="angle-error" error={errors.angle} />
                </div>
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
