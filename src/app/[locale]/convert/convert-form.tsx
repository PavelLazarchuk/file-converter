'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { FieldError } from '@/components/field-error';
import { ImageDropzone, useLoadedImages } from '@/components/image-dropzone';
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
import { usePendingLabel, useFileAction } from '@/hooks/use-file-action';
import { useFileSize } from '@/hooks/use-messages';
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
    MAX_BATCH_FILES,
    conversionTargets,
    convertSourceFromMimeType,
    formatBase64Output,
    stripExtension,
    type Base64Output,
    type ConvertSource,
    type ConvertTarget,
} from '@/lib/image';
import { convertSchema, type ConvertInput, type ConvertValues } from '@/lib/schemas';
import { cn } from '@/lib/utils';

const DATA_URI_PREVIEW_LIMIT = 2000;

type DataUriResult = { value: string; filename: string; alt: string };

function withExtension(filename: string, extension: string): string {
    return `${stripExtension(filename)}.${extension}`;
}

export function ConvertForm() {
    const t = useTranslations('Convert');
    const labels = useTranslations('Labels');
    const form = useTranslations('Form');
    const pendingLabel = usePendingLabel();
    const fileSize = useFileSize();
    const { images, addImages, removeImage, clearImages } = useLoadedImages(MAX_BATCH_FILES);
    const [removeMetadata, setRemoveMetadata] = useState(true);
    const [dataUris, setDataUris] = useState<DataUriResult[] | null>(null);
    const [base64Output, setBase64Output] = useState<Base64Output>('uri');
    const [icoSizes, setIcoSizes] = useState<number[]>([...DEFAULT_ICO_SIZES]);
    const [icoPack, setIcoPack] = useState(false);
    const { isPending, outcome, isLeaving, progress, run, clearResult, downloadAll, autoDownload } =
        useFileAction(convertImage, 'converted-images.zip');

    const {
        control,
        handleSubmit,
        reset,
        getValues,
        trigger,
        formState: { errors, isValid },
    } = useForm<ConvertInput, unknown, ConvertValues>({
        resolver: zodResolver(convertSchema),
        mode: 'onChange',
    });

    const hasImages = images.length > 0;
    const sourceFormats = [
        ...new Set(
            images
                .map(image => convertSourceFromMimeType(image.file.type))
                .filter((format): format is ConvertSource => format !== null)
        ),
    ];
    const targets = conversionTargets(images.map(image => image.file.type));
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
        if (!hasImages) return;

        const keepMetadata = !removeMetadata;

        if (values.format === 'base64') {
            run(
                images,
                { format: values.format, keepMetadata },
                {
                    onResult: files => {
                        setDataUris(
                            files.map(file => ({
                                value: new TextDecoder().decode(file.data),
                                filename: file.filename,
                                alt: stripExtension(file.filename)
                                    .replace(/-base64$/, '')
                                    .replaceAll('"', ''),
                            }))
                        );
                        toast.success(t('base64Ready', { count: files.length }));

                        return 'handled';
                    },
                }
            );

            return;
        }

        if (values.format === 'ico') {
            run(images, {
                format: values.format,
                icoSizes: icoSizes.join(','),
                icoPack,
            });

            return;
        }

        run(images, { format: values.format, keepMetadata });
    });

    async function copyText(value: string) {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(t('copied'));
        } catch {
            toast.error(t('copyFailed'));
        }
    }

    const snippets = dataUris?.map(entry => ({
        ...entry,
        snippet: formatBase64Output(base64Output, entry.value, entry.alt),
    }));

    function keepTargetValid(next: ConvertTarget[]) {
        const current = getValues('format');

        if (!current || !next.includes(current)) reset({ format: next[0] });
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                images={images}
                max={MAX_BATCH_FILES}
                formats={CONVERT_SOURCE_KEYS}
                disabled={isPending}
                onAdd={loaded => {
                    addImages(loaded);
                    setDataUris(null);
                    clearResult();
                    keepTargetValid(
                        conversionTargets(
                            [...images, ...loaded]
                                .slice(0, MAX_BATCH_FILES)
                                .map(image => image.file.type)
                        )
                    );
                    void trigger();
                }}
                onRemove={index => {
                    removeImage(index);
                    setDataUris(null);
                    clearResult();
                    keepTargetValid(
                        conversionTargets(
                            images.filter((_, at) => at !== index).map(image => image.file.type)
                        )
                    );
                    void trigger();
                }}
                onClear={() => {
                    clearImages();
                    setDataUris(null);
                    clearResult();
                    reset({ format: undefined });
                }}
            />

            <div className="space-y-2">
                <Label htmlFor="format">{t('convertTo')}</Label>
                <Controller
                    control={control}
                    name="format"
                    render={({ field }) => (
                        <Select
                            value={field.value ?? ''}
                            onValueChange={value => {
                                setDataUris(null);
                                clearResult();
                                field.onChange(value);
                            }}
                            disabled={!hasImages || isPending}
                        >
                            <SelectTrigger
                                id="format"
                                className="w-full"
                                aria-invalid={!!errors.format}
                            >
                                <SelectValue placeholder={form('chooseTargetFormat')} />
                            </SelectTrigger>
                            <SelectContent>
                                {targets.map(format => (
                                    <SelectItem key={format} value={format}>
                                        {labels(`formats.${format}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {sourceFormats.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {t('detected', {
                            count: sourceFormats.length,
                            formats: sourceFormats
                                .map(format => labels(`formats.${format}`))
                                .join(', '),
                        })}
                    </p>
                )}
                {images.length > 1 && (
                    <p className="text-sm text-muted-foreground">{t('batchNote')}</p>
                )}
                {target === 'svg' && (
                    <p className="text-sm text-muted-foreground">{t('svgNote')}</p>
                )}
                {target === 'base64' && (
                    <p className="text-sm text-muted-foreground">{t('base64Note')}</p>
                )}
                {target === 'gif' && (
                    <p className="text-sm text-muted-foreground">{t('gifNote')}</p>
                )}
                {sourceFormats.includes('gif') && target !== 'gif' && (
                    <p className="text-sm text-muted-foreground">{t('animatedGifNote')}</p>
                )}
                {target === 'tiff' && (
                    <p className="text-sm text-muted-foreground">{t('tiffNote')}</p>
                )}
                <FieldError error={errors.format} />
            </div>

            {target === 'ico' && (
                <div className="space-y-4 rounded-xl border bg-card p-4">
                    <div className="space-y-2">
                        <Label>{t('icoSizes')}</Label>
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
                        <p className="text-sm text-muted-foreground">{t('icoSizesHint')}</p>
                    </div>

                    <div className="space-y-1.5 border-t pt-4">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="ico-pack"
                                checked={icoPack}
                                disabled={isPending}
                                onCheckedChange={setIcoPack}
                            />
                            <Label htmlFor="ico-pack">{t('icoPack')}</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {icoPack
                                ? t('icoPackOn', { size: FAVICON_PACK.appleTouch })
                                : t('icoPackOff')}
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
                            setDataUris(null);
                        }}
                        disabled={!hasImages || isPending}
                    />
                    {target === 'base64' &&
                        sourceFormats.some(format => format !== 'gif' && format !== 'svg') &&
                        removeMetadata && (
                            <p className="text-sm text-muted-foreground">{t('base64Metadata')}</p>
                        )}
                </div>
            )}

            {target === 'base64' && snippets && snippets.length > 0 && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="base64-output">{t('output')}</Label>
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
                                        {labels(`base64.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {snippets.map(({ snippet, filename, alt }) => (
                        <div key={filename} className="space-y-2">
                            {snippets.length > 1 && (
                                <p className="truncate text-sm font-medium">{alt}</p>
                            )}
                            <textarea
                                aria-label={t('snippetLabel', { name: alt })}
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
                                {fileSize(snippet.length)}
                                {snippet.length > DATA_URI_PREVIEW_LIMIT && ` ${t('truncated')}`}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" onClick={() => copyText(snippet)}>
                                    {t('copy')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        downloadFile(
                                            new TextEncoder().encode(snippet),
                                            withExtension(
                                                filename,
                                                BASE64_OUTPUTS[base64Output].extension
                                            ),
                                            IMAGE_FORMATS.base64.mimeType
                                        )
                                    }
                                >
                                    {t('downloadExtension', {
                                        extension: BASE64_OUTPUTS[base64Output].extension,
                                    })}
                                </Button>
                            </div>
                        </div>
                    ))}
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

            <Button type="submit" className="w-full" disabled={!hasImages || !isValid || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> {pendingLabel(t('pending'), progress)}
                    </>
                ) : target === 'base64' ? (
                    t('generateDataUri', { count: images.length })
                ) : target === 'ico' && icoPack ? (
                    autoDownload ? (
                        t('buildPackDownload')
                    ) : (
                        t('buildPack')
                    )
                ) : autoDownload ? (
                    t('submitDownload')
                ) : (
                    t('submit')
                )}
            </Button>
        </form>
    );
}
