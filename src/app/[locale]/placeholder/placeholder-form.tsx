'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { FieldError } from '@/components/field-error';

import { IntegerInput } from '@/components/integer-input';
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
import { generatePlaceholder } from '@/lib/actions';
import {
    DIMENSION_LIMITS,
    FORMAT_KEYS,
    PLACEHOLDER_DEFAULTS,
    PLACEHOLDER_TEXT_MAX_LENGTH,
    placeholderFontSize,
    placeholderLabel,
} from '@/lib/image';
import { placeholderSchema, type PlaceholderInput, type PlaceholderValues } from '@/lib/schemas';

const PREVIEW_MAX_WIDTH = 288;
const PREVIEW_MAX_HEIGHT = 176;

export function PlaceholderForm() {
    const t = useTranslations('Placeholder');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const { isPending, outcome, isLeaving, run, clearResult, downloadAll, autoDownload } =
        useFileAction(generatePlaceholder);

    const {
        register,
        control,
        handleSubmit,
        formState: { errors, isValid },
    } = useForm<PlaceholderInput, unknown, PlaceholderValues>({
        resolver: zodResolver(placeholderSchema),
        mode: 'onChange',
        defaultValues: { ...PLACEHOLDER_DEFAULTS, text: '', format: 'png' },
    });

    const [widthRaw, heightRaw, bgColor, textColor, text] = useWatch({
        control,
        name: ['width', 'height', 'bgColor', 'textColor', 'text'],
    });

    const width = /^\d+$/.test(widthRaw ?? '') ? Number(widthRaw) : null;
    const height = /^\d+$/.test(heightRaw ?? '') ? Number(heightRaw) : null;
    const preview =
        width && height
            ? (() => {
                  const label = placeholderLabel(text?.trim() ?? '', width, height);
                  const scale = Math.min(1, PREVIEW_MAX_WIDTH / width, PREVIEW_MAX_HEIGHT / height);

                  return {
                      label,
                      width: Math.max(2, width * scale),
                      height: Math.max(2, height * scale),
                      fontSize: placeholderFontSize(width, height, label) * scale,
                  };
              })()
            : null;

    const onSubmit = handleSubmit(values => {
        run([], {
            width: values.width,
            height: values.height,
            bgColor: values.bgColor,
            textColor: values.textColor,
            text: values.text,
            format: values.format,
        });
    });

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="width">{t('width')}</Label>
                    <IntegerInput
                        id="width"
                        min={DIMENSION_LIMITS.min}
                        max={DIMENSION_LIMITS.max}
                        placeholder={t('widthPlaceholder')}
                        disabled={isPending}
                        aria-invalid={!!errors.width}
                        {...register('width')}
                    />
                    <FieldError error={errors.width} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="height">{t('height')}</Label>
                    <IntegerInput
                        id="height"
                        min={DIMENSION_LIMITS.min}
                        max={DIMENSION_LIMITS.max}
                        placeholder={t('heightPlaceholder')}
                        disabled={isPending}
                        aria-invalid={!!errors.height}
                        {...register('height')}
                    />
                    <FieldError error={errors.height} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="bgColor">{t('bgColor')}</Label>
                    <Input
                        id="bgColor"
                        type="color"
                        className="h-9 cursor-pointer p-1"
                        disabled={isPending}
                        aria-invalid={!!errors.bgColor}
                        {...register('bgColor')}
                    />
                    <FieldError error={errors.bgColor} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="textColor">{t('textColor')}</Label>
                    <Input
                        id="textColor"
                        type="color"
                        className="h-9 cursor-pointer p-1"
                        disabled={isPending}
                        aria-invalid={!!errors.textColor}
                        {...register('textColor')}
                    />
                    <FieldError error={errors.textColor} />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="text">{t('text')}</Label>
                <Input
                    id="text"
                    placeholder={width && height ? `${width} × ${height}` : t('textPlaceholder')}
                    maxLength={PLACEHOLDER_TEXT_MAX_LENGTH}
                    disabled={isPending}
                    aria-invalid={!!errors.text}
                    {...register('text')}
                />
                <FieldError error={errors.text} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="format">{t('format')}</Label>
                <Controller
                    control={control}
                    name="format"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? ''}
                            onValueChange={field.onChange}
                            disabled={isPending}
                        >
                            <SelectTrigger
                                id="format"
                                className="w-full"
                                aria-invalid={!!errors.format}
                            >
                                <SelectValue placeholder={form('chooseOutputFormat')} />
                            </SelectTrigger>
                            <SelectContent>
                                {FORMAT_KEYS.map(format => (
                                    <SelectItem key={format} value={format}>
                                        {labels(`formats.${format}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <FieldError error={errors.format} />
            </div>

            {preview && (
                <div className="space-y-2">
                    <Label>{t('preview')}</Label>
                    <div className="flex h-52 items-center justify-center rounded-xl border bg-muted/30 p-4">
                        <div
                            className="flex items-center justify-center overflow-hidden rounded-sm"
                            style={{
                                width: preview.width,
                                height: preview.height,
                                backgroundColor: bgColor,
                                color: textColor,
                            }}
                        >
                            <span
                                className="truncate px-1 font-medium"
                                style={{ fontSize: preview.fontSize }}
                            >
                                {preview.label}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{t('previewHint')}</p>
                </div>
            )}

            {outcome && (
                <ResultCard
                    outcome={outcome}
                    leaving={isLeaving}
                    onDismiss={clearResult}
                    onDownloadAll={downloadAll}
                />
            )}

            <Button type="submit" className="w-full" disabled={!isValid || isPending}>
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
