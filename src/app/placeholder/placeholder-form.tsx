'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { IntegerInput } from '@/components/integer-input';
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
import { useImageAction } from '@/hooks/use-image-action';
import { generatePlaceholder } from '@/lib/actions';
import {
    DIMENSION_LIMITS,
    FORMAT_KEYS,
    IMAGE_FORMATS,
    PLACEHOLDER_DEFAULTS,
    PLACEHOLDER_TEXT_MAX_LENGTH,
    placeholderFontSize,
    placeholderLabel,
} from '@/lib/image';
import { placeholderSchema, type PlaceholderInput, type PlaceholderValues } from '@/lib/schemas';

const PREVIEW_MAX_WIDTH = 288;
const PREVIEW_MAX_HEIGHT = 176;

export function PlaceholderForm() {
    const { isPending, run } = useImageAction(generatePlaceholder);

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
        run(null, {
            width: String(values.width),
            height: String(values.height),
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
                    <Label htmlFor="width">Width (px)</Label>
                    <IntegerInput
                        id="width"
                        min={DIMENSION_LIMITS.min}
                        max={DIMENSION_LIMITS.max}
                        placeholder="e.g. 600"
                        disabled={isPending}
                        aria-invalid={!!errors.width}
                        {...register('width')}
                    />
                    {errors.width && (
                        <p className="text-sm text-destructive">{errors.width.message}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="height">Height (px)</Label>
                    <IntegerInput
                        id="height"
                        min={DIMENSION_LIMITS.min}
                        max={DIMENSION_LIMITS.max}
                        placeholder="e.g. 400"
                        disabled={isPending}
                        aria-invalid={!!errors.height}
                        {...register('height')}
                    />
                    {errors.height && (
                        <p className="text-sm text-destructive">{errors.height.message}</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="bgColor">Background color</Label>
                    <Input
                        id="bgColor"
                        type="color"
                        className="h-9 cursor-pointer p-1"
                        disabled={isPending}
                        aria-invalid={!!errors.bgColor}
                        {...register('bgColor')}
                    />
                    {errors.bgColor && (
                        <p className="text-sm text-destructive">{errors.bgColor.message}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="textColor">Text color</Label>
                    <Input
                        id="textColor"
                        type="color"
                        className="h-9 cursor-pointer p-1"
                        disabled={isPending}
                        aria-invalid={!!errors.textColor}
                        {...register('textColor')}
                    />
                    {errors.textColor && (
                        <p className="text-sm text-destructive">{errors.textColor.message}</p>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="text">Text (optional)</Label>
                <Input
                    id="text"
                    placeholder={
                        width && height ? `${width} × ${height}` : 'Defaults to the dimensions'
                    }
                    maxLength={PLACEHOLDER_TEXT_MAX_LENGTH}
                    disabled={isPending}
                    aria-invalid={!!errors.text}
                    {...register('text')}
                />
                {errors.text && <p className="text-sm text-destructive">{errors.text.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
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
                                <SelectValue placeholder="Choose an output format" />
                            </SelectTrigger>
                            <SelectContent>
                                {FORMAT_KEYS.map(format => (
                                    <SelectItem key={format} value={format}>
                                        {IMAGE_FORMATS[format].label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.format && (
                    <p className="text-sm text-destructive">{errors.format.message}</p>
                )}
            </div>

            {preview && (
                <div className="space-y-2">
                    <Label>Preview</Label>
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
                    <p className="text-sm text-muted-foreground">
                        Approximate preview, scaled to fit. The download renders at full size.
                    </p>
                </div>
            )}

            <Button type="submit" className="w-full" disabled={!isValid || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> Generating…
                    </>
                ) : (
                    'Generate & download'
                )}
            </Button>
        </form>
    );
}
