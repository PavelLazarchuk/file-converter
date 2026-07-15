'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ImageIcon, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    FORMAT_KEYS,
    IMAGE_FORMATS,
    MAX_FILE_SIZE,
    MAX_FILE_SIZE_LABEL,
    acceptedFormatsLabel,
    formatFileSize,
    type ConvertSource,
} from '@/lib/image';
import { cn } from '@/lib/utils';

export type LoadedImage = {
    file: File;
    previewUrl: string;
    width: number;
    height: number;
};

export function useLoadedImage() {
    const [image, setImageState] = useState<LoadedImage | null>(null);
    const currentRef = useRef<LoadedImage | null>(null);

    const setImage = useCallback((next: LoadedImage | null) => {
        const previous = currentRef.current;

        if (previous && previous !== next) URL.revokeObjectURL(previous.previewUrl);

        currentRef.current = next;
        setImageState(next);
    }, []);

    useEffect(
        () => () => {
            if (currentRef.current) URL.revokeObjectURL(currentRef.current.previewUrl);
        },
        []
    );

    return { image, setImage };
}

type ImageDropzoneProps = {
    image: LoadedImage | null;
    onImage: (image: LoadedImage) => void;
    onClear: () => void;
    disabled?: boolean;
    formats?: readonly ConvertSource[];
};

export function ImageDropzone({
    image,
    onImage,
    onClear,
    disabled,
    formats = FORMAT_KEYS,
}: ImageDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const loadTokenRef = useRef(0);
    const [isDragging, setIsDragging] = useState(false);

    function loadFile(file: File) {
        if (!formats.some(format => IMAGE_FORMATS[format].mimeType === file.type)) {
            toast.error(`Unsupported file type. Use ${acceptedFormatsLabel(formats)}.`);

            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            toast.error(`File is too large. The maximum size is ${MAX_FILE_SIZE_LABEL}.`);

            return;
        }

        const token = ++loadTokenRef.current;
        const previewUrl = URL.createObjectURL(file);
        const probe = new window.Image();

        probe.onload = () => {
            if (token !== loadTokenRef.current) {
                URL.revokeObjectURL(previewUrl);
                return;
            }

            onImage({ file, previewUrl, width: probe.naturalWidth, height: probe.naturalHeight });
        };
        probe.onerror = () => {
            URL.revokeObjectURL(previewUrl);

            if (token === loadTokenRef.current) {
                toast.error('Could not read this image. The file may be corrupted.');
            }
        };
        probe.src = previewUrl;
    }

    function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        setIsDragging(false);

        if (disabled) return;

        const file = event.dataTransfer.files[0];

        if (file) loadFile(file);
    }

    const fileInput = (
        <input
            ref={inputRef}
            type="file"
            accept={formats.map(format => IMAGE_FORMATS[format].mimeType).join(',')}
            className="sr-only"
            disabled={disabled}
            onChange={event => {
                const file = event.target.files?.[0];
                if (file) loadFile(file);
                event.target.value = '';
            }}
        />
    );

    if (image) {
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
                        ? 'Drop the image here'
                        : 'Drag & drop an image, or click to browse'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {acceptedFormatsLabel(formats)} · up to {MAX_FILE_SIZE_LABEL}
                </p>
            </div>
        </label>
    );
}
