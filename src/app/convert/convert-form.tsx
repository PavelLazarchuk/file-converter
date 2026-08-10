'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { ImageDropzone, useLoadedImage } from '@/components/image-dropzone';
import { MetadataSwitch } from '@/components/metadata-switch';
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
import { Switch } from '@/components/ui/switch';
import { useImageAction } from '@/hooks/use-image-action';
import { convertImage } from '@/lib/actions';
import { downloadFile } from '@/lib/download';
import {
    BASE64_OUTPUTS,
    BASE64_OUTPUT_KEYS,
    CONVERT_SOURCE_KEYS,
    DEFAULT_ICO_SIZES,
    FAVICON_PACK,
    ICO_SIZE_OPTIONS,
    IMAGE_FORMATS,
    conversionTargets,
    convertSourceFromMimeType,
    formatBase64Output,
    formatFileSize,
    stripExtension,
    type Base64Output,
} from '@/lib/image';
import { convertSchema, type ConvertInput, type ConvertValues } from '@/lib/schemas';
import { cn } from '@/lib/utils';

const DATA_URI_PREVIEW_LIMIT = 2000;

type DataUriResult = { value: string; filename: string; alt: string };

function withExtension(filename: string, extension: string): string {
    return `${stripExtension(filename)}.${extension}`;
}

export function ConvertForm() {
    const { image, setImage } = useLoadedImage();
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const [dataUri, setDataUri] = useState<DataUriResult | null>(null);
    const [base64Output, setBase64Output] = useState<Base64Output>('uri');
    const [icoSizes, setIcoSizes] = useState<number[]>([...DEFAULT_ICO_SIZES]);
    const [icoPack, setIcoPack] = useState(false);
    const { isPending, outcome, run, clearResult, autoDownload } = useImageAction(convertImage);

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

    function toggleIcoSize(size: number) {
        setIcoSizes(current =>
            current.includes(size)
                ? current.length > 1
                    ? current.filter(value => value !== size)
                    : current
                : [...current, size].sort((a, b) => a - b)
        );
    }

    const onSubmit = handleSubmit(values => {
        if (!image) return;

        const keepMetadata = String(!removeMetadata);

        if (values.format === 'base64') {
            run(
                image,
                { format: values.format, keepMetadata },
                {
                    onResult: result => {
                        setDataUri({
                            value: new TextDecoder().decode(result.data),
                            filename: result.filename,
                            alt: image.file.name.replaceAll('"', ''),
                        });
                        toast.success('Base64 data URI ready');

                        return 'handled';
                    },
                }
            );

            return;
        }

        if (values.format === 'ico') {
            run(image, {
                format: values.format,
                icoSizes: icoSizes.join(','),
                icoPack: String(icoPack),
            });

            return;
        }

        run(image, { format: values.format, keepMetadata });
    });

    async function copyText(value: string) {
        try {
            await navigator.clipboard.writeText(value);
            toast.success('Copied to clipboard');
        } catch {
            toast.error('Could not access the clipboard.');
        }
    }

    const snippet = dataUri && formatBase64Output(base64Output, dataUri.value, dataUri.alt);

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                image={image}
                formats={CONVERT_SOURCE_KEYS}
                disabled={isPending}
                onImage={loaded => {
                    setImage(loaded);
                    setDataUri(null);
                    clearResult();
                    reset({ format: conversionTargets(loaded.file.type)[0] });
                    void trigger();
                }}
                onClear={() => {
                    setImage(null);
                    setDataUri(null);
                    clearResult();
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
                                clearResult();
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
                {target === 'base64' && (
                    <p className="text-sm text-muted-foreground">
                        Encodes the image as a data: URI for embedding in CSS or HTML. Best for
                        small images — the text is about a third larger than the file.
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

            {target === 'ico' && (
                <div className="space-y-4 rounded-xl border bg-card p-4">
                    <div className="space-y-2">
                        <Label>Icon sizes</Label>
                        <div className="flex flex-wrap gap-2">
                            {ICO_SIZE_OPTIONS.map(size => {
                                const selected = icoSizes.includes(size);

                                return (
                                    <Button
                                        key={size}
                                        type="button"
                                        size="sm"
                                        variant={selected ? 'default' : 'outline'}
                                        aria-pressed={selected}
                                        disabled={isPending}
                                        onClick={() => toggleIcoSize(size)}
                                        className={cn(!selected && 'text-muted-foreground')}
                                    >
                                        {size}px
                                    </Button>
                                );
                            })}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            The .ico holds every selected size as a PNG, fitted on a transparent
                            background; browsers pick the one they need. 16, 32 and 48px cover tabs,
                            bookmarks and the Windows desktop.
                        </p>
                    </div>

                    <div className="space-y-1.5 border-t pt-4">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="ico-pack"
                                checked={icoPack}
                                disabled={isPending}
                                onCheckedChange={setIcoPack}
                            />
                            <Label htmlFor="ico-pack">Download the full favicon pack (.zip)</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {icoPack
                                ? `Bundles favicon.ico with apple-touch-icon.png (${FAVICON_PACK.appleTouch}px, flattened on white), icon-192.png, icon-512.png, a site.webmanifest and the <link> tags to paste into <head>.`
                                : 'Just the .ico file on its own.'}
                        </p>
                    </div>
                </div>
            )}

            {target !== 'ico' && (
                <div className="space-y-1.5">
                    <MetadataSwitch
                        checked={removeMetadata}
                        onCheckedChange={checked => {
                            setRemoveMetadata(checked);
                            setDataUri(null);
                        }}
                        disabled={!image || isPending}
                    />
                    {target === 'base64' &&
                        sourceFormat !== 'gif' &&
                        sourceFormat !== 'svg' &&
                        removeMetadata && (
                            <p className="text-sm text-muted-foreground">
                                If the image carries metadata, removing it re-encodes the pixels, so
                                the embedded bytes differ from the original file. Turn it off to
                                always embed the upload byte-for-byte.
                            </p>
                        )}
                </div>
            )}

            {target === 'base64' && snippet && dataUri && (
                <div className="space-y-2">
                    <Label htmlFor="base64-output">Output</Label>
                    <Select
                        value={base64Output}
                        onValueChange={value => setBase64Output(value as Base64Output)}
                    >
                        <SelectTrigger id="base64-output" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {BASE64_OUTPUT_KEYS.map(key => (
                                <SelectItem key={key} value={key}>
                                    {BASE64_OUTPUTS[key].label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <textarea
                        aria-label="Generated snippet"
                        readOnly
                        rows={6}
                        className="w-full resize-none rounded-md border bg-muted/30 p-3 font-mono text-xs break-all"
                        value={
                            snippet.length > DATA_URI_PREVIEW_LIMIT
                                ? `${snippet.slice(0, DATA_URI_PREVIEW_LIMIT)}…`
                                : snippet
                        }
                    />
                    <p className="text-sm text-muted-foreground">
                        {formatFileSize(snippet.length)}
                        {snippet.length > DATA_URI_PREVIEW_LIMIT &&
                            ' — preview truncated, Copy and Download include the full string.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={() => copyText(snippet)}>
                            Copy
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                downloadFile(
                                    new TextEncoder().encode(snippet),
                                    withExtension(
                                        dataUri.filename,
                                        BASE64_OUTPUTS[base64Output].extension
                                    ),
                                    IMAGE_FORMATS.base64.mimeType
                                )
                            }
                        >
                            Download .{BASE64_OUTPUTS[base64Output].extension}
                        </Button>
                    </div>
                </div>
            )}

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
                        <Spinner /> Converting…
                    </>
                ) : target === 'base64' ? (
                    'Generate data URI'
                ) : target === 'ico' && icoPack ? (
                    autoDownload ? (
                        'Build favicon pack & download'
                    ) : (
                        'Build favicon pack'
                    )
                ) : autoDownload ? (
                    'Convert & download'
                ) : (
                    'Convert'
                )}
            </Button>
        </form>
    );
}
