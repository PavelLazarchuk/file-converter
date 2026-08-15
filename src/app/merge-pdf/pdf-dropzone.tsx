'use client';

import { useCallback, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileText, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    MAX_BATCH_BYTES,
    MAX_BATCH_SIZE_LABEL,
    MAX_FILE_SIZE,
    MAX_FILE_SIZE_LABEL,
    PDF_MIME_TYPE,
    countLabel,
    formatFileSize,
} from '@/lib/image';
import { cn } from '@/lib/utils';

export type LoadedPdf = { file: File; id: string };

function totalBytes(documents: readonly LoadedPdf[]): number {
    return documents.reduce((sum, entry) => sum + entry.file.size, 0);
}

export function useLoadedPdfs(max: number) {
    const [documents, setDocuments] = useState<LoadedPdf[]>([]);
    const currentRef = useRef<LoadedPdf[]>([]);

    const commit = useCallback((next: LoadedPdf[]) => {
        currentRef.current = next;
        setDocuments(next);
    }, []);

    const addPdfs = useCallback(
        (added: LoadedPdf[]) => commit([...currentRef.current, ...added].slice(0, max)),
        [commit, max]
    );

    const removePdf = useCallback(
        (index: number) => commit(currentRef.current.filter((_, at) => at !== index)),
        [commit]
    );

    const movePdf = useCallback(
        (from: number, to: number) => {
            const next = [...currentRef.current];

            if (from < 0 || from >= next.length || to < 0 || to >= next.length) return;

            const [moved] = next.splice(from, 1);

            next.splice(to, 0, moved);
            commit(next);
        },
        [commit]
    );

    const clearPdfs = useCallback(() => commit([]), [commit]);

    return { documents, addPdfs, removePdf, movePdf, clearPdfs };
}

function isPdf(file: File): boolean {
    return file.type === PDF_MIME_TYPE || /\.pdf$/i.test(file.name);
}

type PdfDropzoneProps = {
    documents: LoadedPdf[];
    onAdd: (documents: LoadedPdf[]) => void;
    onRemove: (index: number) => void;
    onMove: (from: number, to: number) => void;
    onClear: () => void;
    disabled?: boolean;
    max: number;
};

export function PdfDropzone({
    documents,
    onAdd,
    onRemove,
    onMove,
    onClear,
    disabled,
    max,
}: PdfDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const idRef = useRef(0);
    const [isDragging, setIsDragging] = useState(false);

    function loadFiles(incoming: File[]) {
        if (disabled || !incoming.length) return;

        const room = max - documents.length;

        if (room <= 0) {
            toast.error(`You can merge up to ${countLabel(max, 'PDF')} at a time.`);

            return;
        }

        const accepted: LoadedPdf[] = [];
        const problems: string[] = [];
        let budget = MAX_BATCH_BYTES - totalBytes(documents);

        for (const file of incoming) {
            if (accepted.length >= room) {
                problems.push(
                    `There is room for ${countLabel(room, 'more file')} — skipped the rest.`
                );

                break;
            }
            if (!isPdf(file)) {
                problems.push(`${file.name}: not a PDF.`);

                continue;
            }
            if (file.size > MAX_FILE_SIZE) {
                problems.push(`${file.name}: larger than ${MAX_FILE_SIZE_LABEL}.`);

                continue;
            }
            if (file.size > budget) {
                problems.push(`${file.name}: the batch has to stay under ${MAX_BATCH_SIZE_LABEL}.`);

                continue;
            }

            budget -= file.size;
            accepted.push({ file, id: `pdf-${(idRef.current += 1)}` });
        }

        if (problems.length) {
            toast.error(
                problems.length === 1
                    ? problems[0]
                    : `${problems[0]} (+${problems.length - 1} more)`
            );
        }
        if (accepted.length) onAdd(accepted);
    }

    const fileInput = (
        <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={disabled}
            onChange={event => {
                loadFiles([...(event.target.files ?? [])]);
                event.target.value = '';
            }}
        />
    );

    if (documents.length) {
        return (
            <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                        {countLabel(documents.length, 'PDF')} ·{' '}
                        {formatFileSize(totalBytes(documents))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        up to {max} · {MAX_BATCH_SIZE_LABEL} in total
                    </p>
                </div>

                <ol className="divide-y rounded-lg border">
                    {documents.map((entry, index) => (
                        <li key={entry.id} className="flex items-center gap-3 p-2">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded border bg-muted">
                                <FileText className="size-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{entry.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {index + 1} of {documents.length} ·{' '}
                                    {formatFileSize(entry.file.size)}
                                </p>
                            </div>
                            <div className="flex shrink-0 flex-col">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-6"
                                    aria-label={`Move ${entry.file.name} up`}
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
                                    aria-label={`Move ${entry.file.name} down`}
                                    disabled={disabled || index === documents.length - 1}
                                    onClick={() => onMove(index, index + 1)}
                                >
                                    <ArrowDown className="size-3.5" />
                                </Button>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${entry.file.name}`}
                                disabled={disabled}
                                onClick={() => onRemove(index)}
                            >
                                <X />
                            </Button>
                        </li>
                    ))}
                </ol>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || documents.length >= max}
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
            onDrop={event => {
                event.preventDefault();
                setIsDragging(false);
                loadFiles([...event.dataTransfer.files]);
            }}
        >
            {fileInput}
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                {isDragging ? (
                    <FileText className="size-6 text-primary" />
                ) : (
                    <UploadCloud className="size-6 text-muted-foreground" />
                )}
            </div>
            <div>
                <p className="text-sm font-medium">
                    {isDragging ? 'Drop the PDFs here' : 'Drag & drop PDFs, or click to browse'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    PDF · up to {max} at a time, {MAX_BATCH_SIZE_LABEL} in total
                </p>
            </div>
        </label>
    );
}
