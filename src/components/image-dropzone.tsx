'use client';

import { useCallback, useRef } from 'react';
import Image from 'next/image';
import { ImageIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
    DropzoneShell,
    RemoveButton,
    ReorderControls,
    usePasteFiles,
} from '@/components/dropzone-shell';
import { Button } from '@/components/ui/button';
import { useHandoffIntake } from '@/hooks/use-handoff';
import { useFileSize, useFormatsLabel } from '@/hooks/use-messages';
import { useUploads } from '@/hooks/use-uploads';
import {
    FORMAT_KEYS,
    IMAGE_FORMATS,
    MAX_BATCH_SIZE_LABEL,
    MAX_FILE_SIZE_LABEL,
    type ConvertSource,
} from '@/lib/image';
import { acceptUploads, totalUploadBytes, uploadProblemSummary } from '@/lib/uploads';

export type LoadedImage = {
    file: File;
    previewUrl: string;
    width: number;
    height: number;
};

export function useLoadedImages(max = 1) {
    const revoke = useCallback((image: LoadedImage) => URL.revokeObjectURL(image.previewUrl), []);
    const { items, addItems, removeItem, moveItem, clearItems } = useUploads<LoadedImage>({
        max,
        onEvict: revoke,
    });

    return {
        images: items,
        addImages: addItems,
        removeImage: removeItem,
        moveImage: moveItem,
        clearImages: clearItems,
    };
}

function probeImage(file: File): Promise<LoadedImage | null> {
    return new Promise(resolve => {
        const previewUrl = URL.createObjectURL(file);
        const probe = new window.Image();

        probe.onload = () =>
            resolve({ file, previewUrl, width: probe.naturalWidth, height: probe.naturalHeight });
        probe.onerror = () => {
            URL.revokeObjectURL(previewUrl);
            resolve(null);
        };
        probe.src = previewUrl;
    });
}

type ImageDropzoneProps = {
    images: LoadedImage[];
    onAdd: (images: LoadedImage[]) => void;
    onRemove: (index: number) => void;
    onClear: () => void;
    onMove?: (from: number, to: number) => void;
    disabled?: boolean;
    formats?: readonly ConvertSource[];
    max?: number;
    receivesHandoff?: boolean;
};

export function ImageDropzone({
    images,
    onAdd,
    onRemove,
    onClear,
    onMove,
    disabled,
    formats = FORMAT_KEYS,
    max = 1,
    receivesHandoff = true,
}: ImageDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const loadTokenRef = useRef(0);
    const single = max === 1;
    const t = useTranslations('Uploads');
    const count = useTranslations('Common');
    const fileSize = useFileSize();
    const formatsLabel = useFormatsLabel();

    async function loadFiles(incoming: File[]) {
        if (disabled || !incoming.length) return;

        const { accepted, problems } = acceptUploads(incoming, {
            max,
            single,
            currentCount: images.length,
            currentBytes: totalUploadBytes(images),
            accepts: file => formats.some(format => IMAGE_FORMATS[format].mimeType === file.type),
            copy: {
                full: limit => t('fullImages', { count: count('images', { count: limit }) }),
                noRoom: room => t('noRoomImages', { count: count('moreImages', { count: room }) }),
                unsupported: name => t('unsupported', { name }),
                tooLarge: name => t('tooLarge', { name, max: MAX_FILE_SIZE_LABEL }),
                overBudget: name => t('overBudget', { name, max: MAX_BATCH_SIZE_LABEL }),
            },
        });
        const summary = uploadProblemSummary(problems, (first, extra) =>
            t('moreProblems', { first, count: extra })
        );

        if (summary) toast.error(summary);
        if (!accepted.length) return;

        const token = ++loadTokenRef.current;
        const loaded = await Promise.all(accepted.map(probeImage));

        if (token !== loadTokenRef.current) {
            for (const image of loaded) if (image) URL.revokeObjectURL(image.previewUrl);

            return;
        }

        const usable = loaded.filter((image): image is LoadedImage => image !== null);

        if (usable.length < accepted.length) {
            toast.error(t('unreadable'));
        }
        if (usable.length) onAdd(usable);
    }

    usePasteFiles(files => void loadFiles(files), {
        disabled,
        filter: file => file.type.startsWith('image/'),
    });

    useHandoffIntake(files => void loadFiles(files), receivesHandoff);

    const accept = formats.map(format => IMAGE_FORMATS[format].mimeType).join(',');
    const hiddenInput = (
        <input
            ref={inputRef}
            type="file"
            multiple={!single}
            accept={accept}
            className="sr-only"
            disabled={disabled}
            onChange={event => {
                void loadFiles([...(event.target.files ?? [])]);
                event.target.value = '';
            }}
        />
    );

    if (single && images.length) {
        const image = images[0];

        return (
            <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    <Image
                        src={image.previewUrl}
                        alt={image.file.name}
                        fill
                        unoptimized
                        className="object-contain"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{image.file.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {image.width} × {image.height} · {fileSize(image.file.size)}
                    </p>
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="mt-1 h-auto p-0"
                        disabled={disabled}
                        onClick={() => inputRef.current?.click()}
                    >
                        {t('chooseDifferent')}
                    </Button>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('removeFile')}
                    disabled={disabled}
                    onClick={onClear}
                >
                    <X />
                </Button>
                {hiddenInput}
            </div>
        );
    }

    if (images.length) {
        return (
            <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                        {count('images', { count: images.length })} ·{' '}
                        {fileSize(totalUploadBytes(images))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {t('limitLine', { max, maxBatch: MAX_BATCH_SIZE_LABEL })}
                    </p>
                </div>

                <ul className="divide-y rounded-lg border">
                    {images.map((image, index) => (
                        <li key={image.previewUrl} className="flex items-center gap-3 p-2">
                            <div className="relative size-12 shrink-0 overflow-hidden rounded border bg-muted">
                                <Image
                                    src={image.previewUrl}
                                    alt={image.file.name}
                                    fill
                                    unoptimized
                                    className="object-contain"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{image.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {image.width} × {image.height} · {fileSize(image.file.size)}
                                </p>
                            </div>
                            {onMove && (
                                <ReorderControls
                                    label={image.file.name}
                                    index={index}
                                    count={images.length}
                                    disabled={disabled}
                                    onMove={onMove}
                                />
                            )}
                            <RemoveButton
                                label={image.file.name}
                                disabled={disabled}
                                onClick={() => onRemove(index)}
                            />
                        </li>
                    ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || images.length >= max}
                        onClick={() => inputRef.current?.click()}
                    >
                        {t('addMore')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={onClear}
                    >
                        {t('removeAll')}
                    </Button>
                </div>
                {hiddenInput}
            </div>
        );
    }

    return (
        <DropzoneShell
            accept={accept}
            multiple={!single}
            disabled={disabled}
            onFiles={files => void loadFiles(files)}
            dragIcon={<ImageIcon className="size-6 text-primary" />}
            idleLabel={single ? t('idleImage') : t('idleImages')}
            dragLabel={single ? t('dragImage') : t('dragImages')}
            hint={
                single
                    ? t('hintSingle', {
                          formats: formatsLabel(formats),
                          maxFile: MAX_FILE_SIZE_LABEL,
                      })
                    : t('hintBatch', {
                          formats: formatsLabel(formats),
                          max,
                          maxBatch: MAX_BATCH_SIZE_LABEL,
                      })
            }
        />
    );
}
