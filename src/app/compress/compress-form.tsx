'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';

import { ImageDropzone, useLoadedImage } from '@/components/image-dropzone';
import { IntegerInput } from '@/components/integer-input';
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
import { compressImage } from '@/lib/actions';
import {
    DEFAULT_QUALITY,
    DEFAULT_TARGET_KB,
    QUALITY_LIMITS,
    TARGET_SIZE_LIMITS,
    TARGET_SIZE_PRESETS,
} from '@/lib/image';
import { compressSchema, type CompressInput, type CompressValues } from '@/lib/schemas';

const defaultValues: CompressInput = {
    mode: 'quality',
    quality: String(DEFAULT_QUALITY),
    targetKb: String(DEFAULT_TARGET_KB),
};

export function CompressForm() {
    const { image, setImage } = useLoadedImage();
    const { isPending, run } = useImageAction(compressImage);

    const {
        control,
        register,
        handleSubmit,
        reset,
        setValue,
        trigger,
        formState: { errors, isValid },
    } = useForm<CompressInput, unknown, CompressValues>({
        resolver: zodResolver(compressSchema),
        mode: 'onChange',
        defaultValues,
    });

    const mode = useWatch({ control, name: 'mode' });

    const onSubmit = handleSubmit(values => {
        if (!image) return;

        run(image, {
            mode: values.mode,
            quality: String(values.quality),
            targetKb: String(values.targetKb),
        });
    });

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                image={image}
                disabled={isPending}
                onImage={loaded => {
                    setImage(loaded);
                    void trigger();
                }}
                onClear={() => {
                    setImage(null);
                    reset(defaultValues);
                }}
            />

            <div className="space-y-2">
                <Label htmlFor="mode">Compression mode</Label>
                <Controller
                    control={control}
                    name="mode"
                    render={({ field }) => (
                        <Select
                            value={field.value}
                            onValueChange={value => {
                                field.onChange(value);

                                if (value === 'size') {
                                    setValue('quality', String(DEFAULT_QUALITY), {
                                        shouldValidate: true,
                                    });
                                } else {
                                    setValue('targetKb', String(DEFAULT_TARGET_KB), {
                                        shouldValidate: true,
                                    });
                                }
                            }}
                            disabled={!image || isPending}
                        >
                            <SelectTrigger id="mode" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="quality">By quality</SelectItem>
                                <SelectItem value="size">To a target file size</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>

            {mode === 'quality' ? (
                <div className="space-y-2">
                    <Label htmlFor="quality">
                        Quality ({QUALITY_LIMITS.min}–{QUALITY_LIMITS.max})
                    </Label>
                    <IntegerInput
                        id="quality"
                        min={QUALITY_LIMITS.min}
                        max={QUALITY_LIMITS.max}
                        placeholder={String(DEFAULT_QUALITY)}
                        disabled={!image || isPending}
                        aria-invalid={!!errors.quality}
                        {...register('quality')}
                    />
                    <p className="text-sm text-muted-foreground">
                        Target output quality: 1 gives the smallest file, 100 the best quality.
                    </p>
                    {errors.quality && (
                        <p className="text-sm text-destructive">{errors.quality.message}</p>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    <Label htmlFor="targetKb">Target size (KB)</Label>
                    <IntegerInput
                        id="targetKb"
                        min={TARGET_SIZE_LIMITS.min}
                        max={TARGET_SIZE_LIMITS.max}
                        placeholder={String(DEFAULT_TARGET_KB)}
                        disabled={!image || isPending}
                        aria-invalid={!!errors.targetKb}
                        {...register('targetKb')}
                    />
                    <div className="flex flex-wrap gap-2">
                        {TARGET_SIZE_PRESETS.map(preset => (
                            <Button
                                key={preset.kb}
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!image || isPending}
                                onClick={() =>
                                    setValue('targetKb', String(preset.kb), {
                                        shouldValidate: true,
                                    })
                                }
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Picks the highest quality that fits under the target. Dimensions stay the
                        same — if the target is unreachable, resize the image first.
                    </p>
                    {errors.targetKb && (
                        <p className="text-sm text-destructive">{errors.targetKb.message}</p>
                    )}
                </div>
            )}

            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <p>
                    All metadata (EXIF, GPS location, ICC profile, XMP) is stripped from the output.
                </p>
            </div>

            <Button type="submit" className="w-full" disabled={!image || !isValid || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> Compressing…
                    </>
                ) : (
                    'Compress & download'
                )}
            </Button>
        </form>
    );
}
