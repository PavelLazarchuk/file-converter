'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { ImageDropzone, useLoadedImage } from '@/components/image-dropzone';
import { MetadataSwitch } from '@/components/metadata-switch';
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
import { convertImage } from '@/lib/actions';
import { downloadFile } from '@/lib/download';
import {
    CONVERT_SOURCE_KEYS,
    ICO_SIZES,
    IMAGE_FORMATS,
    conversionTargets,
    convertSourceFromMimeType,
    formatFileSize,
} from '@/lib/image';
import { convertSchema, type ConvertInput, type ConvertValues } from '@/lib/schemas';

const DATA_URI_PREVIEW_LIMIT = 2000;

type DataUriResult = { value: string; filename: string };

export function ConvertForm() {
    const { image, setImage } = useLoadedImage();
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const [dataUri, setDataUri] = useState<DataUriResult | null>(null);
    const { isPending, run } = useImageAction(convertImage);

    const {
        control,
        handleSubmit,
        reset,
        trigger,
        formState: { errors, isValid },
    } = useForm<ConvertInput, unknown, ConvertValues>({
        resolver: zodResolver(convertSchema),
        mode: 'onChange',
    });

    const sourceFormat = image ? convertSourceFromMimeType(image.file.type) : null;
    const targets = image ? conversionTargets(image.file.type) : [];
    const target = useWatch({ control, name: 'format' });

    const onSubmit = handleSubmit(values => {
        if (!image) return;
        if (values.format === 'base64') {
            run(image, { format: values.format }, result => {
                setDataUri({
                    value: new TextDecoder().decode(result.data),
                    filename: result.filename,
                });
                toast.success('Base64 data URI ready');
            });

            return;
        }

        run(image, { format: values.format, keepMetadata: String(!removeMetadata) });
    });

    async function copyDataUri(value: string) {
        try {
            await navigator.clipboard.writeText(value);
            toast.success('Copied to clipboard');
        } catch {
            toast.error('Could not access the clipboard.');
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                image={image}
                formats={CONVERT_SOURCE_KEYS}
                disabled={isPending}
                onImage={loaded => {
                    setImage(loaded);
                    setDataUri(null);
                    reset({ format: conversionTargets(loaded.file.type)[0] });
                    void trigger();
                }}
                onClear={() => {
                    setImage(null);
                    setDataUri(null);
                    reset({ format: undefined });
                }}
            />

            <div className="space-y-2">
                <Label htmlFor="format">Convert to</Label>
                <Controller
                    control={control}
                    name="format"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? ''}
                            onValueChange={value => {
                                setDataUri(null);
                                field.onChange(value);
                            }}
                            disabled={!image || isPending}
                        >
                            <SelectTrigger
                                id="format"
                                className="w-full"
                                aria-invalid={!!errors.format}
                            >
                                <SelectValue placeholder="Choose a target format" />
                            </SelectTrigger>
                            <SelectContent>
                                {targets.map(format => (
                                    <SelectItem key={format} value={format}>
                                        {IMAGE_FORMATS[format].label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {sourceFormat && (
                    <p className="text-sm text-muted-foreground">
                        Detected source format: {IMAGE_FORMATS[sourceFormat].label} (
                        {IMAGE_FORMATS[sourceFormat].mimeType})
                    </p>
                )}
                {target === 'svg' && (
                    <p className="text-sm text-muted-foreground">
                        Embeds the image as a base64-encoded PNG inside an SVG file. The pixels are
                        not traced into vector shapes, so it won&apos;t scale beyond the original
                        resolution.
                    </p>
                )}
                {target === 'ico' && (
                    <p className="text-sm text-muted-foreground">
                        Builds a favicon containing {ICO_SIZES.join(', ')} px versions of the image,
                        fitted on a transparent background.
                    </p>
                )}
                {target === 'base64' && (
                    <p className="text-sm text-muted-foreground">
                        Encodes the uploaded file byte-for-byte as a data: URI for embedding in CSS
                        or HTML. Best for small images — the text is about a third larger than the
                        file.
                    </p>
                )}
                {target === 'gif' && (
                    <p className="text-sm text-muted-foreground">
                        Exports a single still frame — animation is not preserved.
                    </p>
                )}
                {sourceFormat === 'gif' && target !== 'gif' && (
                    <p className="text-sm text-muted-foreground">
                        If this GIF is animated, only its first frame is converted.
                    </p>
                )}
                {target === 'tiff' && (
                    <p className="text-sm text-muted-foreground">
                        A lossless format for print and archival. Files are large and most browsers
                        can&apos;t preview them.
                    </p>
                )}
                {errors.format && (
                    <p className="text-sm text-destructive">{errors.format.message}</p>
                )}
            </div>

            {target !== 'ico' && target !== 'base64' && (
                <MetadataSwitch
                    checked={removeMetadata}
                    onCheckedChange={setRemoveMetadata}
                    disabled={!image || isPending}
                />
            )}

            {target === 'base64' && dataUri && (
                <div className="space-y-2">
                    <Label htmlFor="data-uri">
                        Data URI ({formatFileSize(dataUri.value.length)})
                    </Label>
                    <textarea
                        id="data-uri"
                        readOnly
                        rows={6}
                        className="w-full resize-none rounded-md border bg-muted/30 p-3 font-mono text-xs break-all"
                        value={
                            dataUri.value.length > DATA_URI_PREVIEW_LIMIT
                                ? `${dataUri.value.slice(0, DATA_URI_PREVIEW_LIMIT)}…`
                                : dataUri.value
                        }
                    />
                    {dataUri.value.length > DATA_URI_PREVIEW_LIMIT && (
                        <p className="text-sm text-muted-foreground">
                            Preview truncated — Copy and Download include the full string.
                        </p>
                    )}
                    <div className="flex gap-2">
                        <Button type="button" onClick={() => copyDataUri(dataUri.value)}>
                            Copy
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                downloadFile(
                                    new TextEncoder().encode(dataUri.value),
                                    dataUri.filename,
                                    IMAGE_FORMATS.base64.mimeType
                                )
                            }
                        >
                            Download .txt
                        </Button>
                    </div>
                </div>
            )}

            <Button type="submit" className="w-full" disabled={!image || !isValid || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> Converting…
                    </>
                ) : target === 'base64' ? (
                    'Generate data URI'
                ) : (
                    'Convert & download'
                )}
            </Button>
        </form>
    );
}
