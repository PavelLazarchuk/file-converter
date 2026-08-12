'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ArrowDown, ArrowUp, ImageIcon, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    FORMAT_KEYS,
    IMAGE_FORMATS,
    MAX_BATCH_BYTES,
    MAX_BATCH_SIZE_LABEL,
    MAX_FILE_SIZE,
    MAX_FILE_SIZE_LABEL,
    acceptedFormatsLabel,
    countLabel,
    formatFileSize,
    type ConvertSource,
} from '@/lib/image';
import { cn } from '@/lib/utils';

const EDITABLE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

function isField(element: HTMLElement): boolean {
    return EDITABLE_TAGS.includes(element.tagName);
}

export type LoadedImage = {
    file: File;
    previewUrl: string;
    width: number;
    height: number;
};

function totalBytes(images: readonly LoadedImage[]): number {
    return images.reduce((sum, image) => sum + image.file.size, 0);
}

export function useLoadedImages(max = 1) {
    const [images, setImagesState] = useState<LoadedImage[]>([]);
    const currentRef = useRef<LoadedImage[]>([]);

    const commit = useCallback((next: LoadedImage[]) => {
        for (const image of currentRef.current) {
            if (!next.includes(image)) URL.revokeObjectURL(image.previewUrl);
        }

        currentRef.current = next;
        setImagesState(next);
    }, []);

    const addImages = useCallback(
        (added: LoadedImage[]) =>
            commit(max === 1 ? added.slice(0, 1) : [...currentRef.current, ...added].slice(0, max)),
        [commit, max]
    );

    const removeImage = useCallback(
        (index: number) => commit(currentRef.current.filter((_, at) => at !== index)),
        [commit]
    );

    const moveImage = useCallback(
        (from: number, to: number) => {
            const next = [...currentRef.current];

            if (from < 0 || from >= next.length || to < 0 || to >= next.length) return;

            const [moved] = next.splice(from, 1);

            next.splice(to, 0, moved);
            commit(next);
        },
        [commit]
    );

    const clearImages = useCallback(() => commit([]), [commit]);

    useEffect(
        () => () => {
            for (const image of currentRef.current) URL.revokeObjectURL(image.previewUrl);
        },
        []
    );

    return { images, addImages, removeImage, moveImage, clearImages };
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
}: ImageDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const loadTokenRef = useRef(0);
    const [isDragging, setIsDragging] = useState(false);
    const single = max === 1;

    async function loadFiles(incoming: File[]) {
        if (disabled || !incoming.length) return;

        const room = single ? 1 : max - images.length;

        if (room <= 0) {
            toast.error(`You can process up to ${countLabel(max, 'image')} at a time.`);

            return;
        }

        const accepted: File[] = [];
        const problems: string[] = [];
        let budget = (single ? MAX_FILE_SIZE : MAX_BATCH_BYTES) - (single ? 0 : totalBytes(images));

        for (const file of incoming) {
            if (accepted.length >= room) {
                problems.push(
                    `There is room for ${countLabel(room, 'more image')} — skipped the rest.`
                );

                break;
            }
            if (!formats.some(format => IMAGE_FORMATS[format].mimeType === file.type)) {
                problems.push(`${file.name}: unsupported file type.`);

                continue;
            }
            if (file.size > MAX_FILE_SIZE) {
                problems.push(`${file.name}: larger than ${MAX_FILE_SIZE_LABEL}.`);

                continue;
            }
            if (file.size > budget) {
                problems.push(
                    single
                        ? `${file.name}: larger than ${MAX_FILE_SIZE_LABEL}.`
                        : `${file.name}: the batch has to stay under ${MAX_BATCH_SIZE_LABEL} in total.`
                );

                continue;
            }

            budget -= file.size;
            accepted.push(file);
        }

        if (problems.length) {
            toast.error(
                problems.length === 1
                    ? problems[0]
                    : `${problems[0]} (+${problems.length - 1} more)`
            );
        }
        if (!accepted.length) return;

        const token = ++loadTokenRef.current;
        const loaded = await Promise.all(accepted.map(probeImage));

        if (token !== loadTokenRef.current) {
            for (const image of loaded) if (image) URL.revokeObjectURL(image.previewUrl);

            return;
        }

        const usable = loaded.filter((image): image is LoadedImage => image !== null);

        if (usable.length < accepted.length) {
            toast.error('Could not read some images. The files may be corrupted.');
        }
        if (usable.length) onAdd(usable);
    }

    const loadFilesRef = useRef(loadFiles);

    useEffect(() => {
        loadFilesRef.current = loadFiles;
    });

    useEffect(() => {
        if (disabled) return;

        function handlePaste(event: ClipboardEvent) {
            const target = event.target;

            if (target instanceof HTMLElement && (target.isContentEditable || isField(target))) {
                return;
            }

            const files = [...(event.clipboardData?.files ?? [])].filter(file =>
                file.type.startsWith('image/')
            );

            if (!files.length) return;

            event.preventDefault();
            void loadFilesRef.current(files);
        }

        window.addEventListener('paste', handlePaste);

        return () => window.removeEventListener('paste', handlePaste);
    }, [disabled]);

    function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        setIsDragging(false);

        if (disabled) return;

        void loadFiles([...event.dataTransfer.files]);
    }

    const fileInput = (
        <input
            ref={inputRef}
            type="file"
            multiple={!single}
            accept={formats.map(format => IMAGE_FORMATS[format].mimeType).join(',')}
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
                        {image.width} × {image.height} · {formatFileSize(image.file.size)}
                    </p>
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="mt-1 h-auto p-0"
                        disabled={disabled}
                        onClick={() => inputRef.current?.click()}
                    >
                        Choose a different file
                    </Button>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove file"
                    disabled={disabled}
                    onClick={onClear}
                >
                    <X />
                </Button>
                {fileInput}
            </div>
        );
    }

    if (images.length) {
        return (
            <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                        {countLabel(images.length, 'image')} · {formatFileSize(totalBytes(images))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        up to {max} · {MAX_BATCH_SIZE_LABEL} in total
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
                                    {image.width} × {image.height} ·{' '}
                                    {formatFileSize(image.file.size)}
                                </p>
                            </div>
                            {onMove && (
                                <div className="flex shrink-0 flex-col">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-6"
                                        aria-label={`Move ${image.file.name} up`}
                                        disabled={disabled || index === 0}
                                        onClick={() => onMove(index, index - 1)}
                                    >
                                        <ArrowUp className="size-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-6"
                                        aria-label={`Move ${image.file.name} down`}
                                        disabled={disabled || index === images.length - 1}
                                        onClick={() => onMove(index, index + 1)}
                                    >
                                        <ArrowDown className="size-3.5" />
                                    </Button>
                                </div>
                            )}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${image.file.name}`}
                                disabled={disabled}
                                onClick={() => onRemove(index)}
                            >
                                <X />
                            </Button>
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
                        Add more
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={onClear}
                    >
                        Remove all
                    </Button>
                </div>
                {fileInput}
            </div>
        );
    }

    return (
        <label
            className={cn(
                'flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                'hover:border-primary/40 hover:bg-muted/50 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                isDragging && 'border-primary/60 bg-muted/50',
                disabled && 'pointer-events-none opacity-50'
            )}
            onDragOver={event => {
                event.preventDefault();
                if (!disabled) setIsDragging(true);
            }}
            onDragLeave={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setIsDragging(false);
                }
            }}
            onDrop={handleDrop}
        >
            {fileInput}
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                {isDragging ? (
                    <ImageIcon className="size-6 text-primary" />
                ) : (
                    <UploadCloud className="size-6 text-muted-foreground" />
                )}
            </div>
            <div>
                <p className="text-sm font-medium">
                    {isDragging
                        ? `Drop the ${single ? 'image' : 'images'} here`
                        : `Drag & drop ${single ? 'an image' : 'images'}, click to browse, or paste with Ctrl/⌘ + V`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {acceptedFormatsLabel(formats)} ·{' '}
                    {single
                        ? `up to ${MAX_FILE_SIZE_LABEL}`
                        : `up to ${max} at a time, ${MAX_BATCH_SIZE_LABEL} in total`}
                </p>
            </div>
        </label>
    );
}
