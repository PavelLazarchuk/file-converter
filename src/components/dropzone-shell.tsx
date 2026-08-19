'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, UploadCloud, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EDITABLE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

function isField(element: HTMLElement): boolean {
    return EDITABLE_TAGS.includes(element.tagName);
}

export function usePasteFiles(
    onFiles: (files: File[]) => void,
    { disabled, filter }: { disabled?: boolean; filter: (file: File) => boolean }
): void {
    const onFilesRef = useRef(onFiles);
    const filterRef = useRef(filter);

    useEffect(() => {
        onFilesRef.current = onFiles;
        filterRef.current = filter;
    });

    useEffect(() => {
        if (disabled) return;

        function handlePaste(event: ClipboardEvent) {
            const target = event.target;

            if (target instanceof HTMLElement && (target.isContentEditable || isField(target))) {
                return;
            }

            const files = [...(event.clipboardData?.files ?? [])].filter(file =>
                filterRef.current(file)
            );

            if (!files.length) return;

            event.preventDefault();
            onFilesRef.current(files);
        }

        window.addEventListener('paste', handlePaste);

        return () => window.removeEventListener('paste', handlePaste);
    }, [disabled]);
}

export type DropzoneShellProps = {
    accept: string;
    multiple: boolean;
    disabled?: boolean;
    onFiles: (files: File[]) => void;
    idleIcon?: React.ReactNode;
    dragIcon?: React.ReactNode;
    idleLabel: React.ReactNode;
    dragLabel: React.ReactNode;
    hint: React.ReactNode;
};

export function DropzoneShell({
    accept,
    multiple,
    disabled,
    onFiles,
    idleIcon,
    dragIcon,
    idleLabel,
    dragLabel,
    hint,
}: DropzoneShellProps) {
    const [isDragging, setIsDragging] = useState(false);

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
            onDrop={event => {
                event.preventDefault();
                setIsDragging(false);

                if (!disabled) onFiles([...event.dataTransfer.files]);
            }}
        >
            <input
                type="file"
                multiple={multiple}
                accept={accept}
                className="sr-only"
                disabled={disabled}
                onChange={event => {
                    onFiles([...(event.target.files ?? [])]);
                    event.target.value = '';
                }}
            />
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                {isDragging
                    ? dragIcon
                    : (idleIcon ?? <UploadCloud className="size-6 text-muted-foreground" />)}
            </div>
            <div>
                <p className="text-sm font-medium">{isDragging ? dragLabel : idleLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
            </div>
        </label>
    );
}

export type ReorderControlsProps = {
    label: string;
    index: number;
    count: number;
    disabled?: boolean;
    onMove: (from: number, to: number) => void;
};

export function ReorderControls({ label, index, count, disabled, onMove }: ReorderControlsProps) {
    const t = useTranslations('Uploads');

    return (
        <div className="flex shrink-0 flex-col">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t('moveUp', { name: label })}
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
                aria-label={t('moveDown', { name: label })}
                disabled={disabled || index === count - 1}
                onClick={() => onMove(index, index + 1)}
            >
                <ArrowDown className="size-3.5" />
            </Button>
        </div>
    );
}

export type RemoveButtonProps = {
    label: string;
    disabled?: boolean;
    onClick: () => void;
};

export function RemoveButton({ label, disabled, onClick }: RemoveButtonProps) {
    const t = useTranslations('Uploads');

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('remove', { name: label })}
            disabled={disabled}
            onClick={onClick}
        >
            <X />
        </Button>
    );
}
