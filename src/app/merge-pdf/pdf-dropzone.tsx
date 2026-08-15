'use client';

import { useRef } from 'react';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';

import { DropzoneShell, RemoveButton, ReorderControls } from '@/components/dropzone-shell';
import { Button } from '@/components/ui/button';
import { useUploads } from '@/hooks/use-uploads';
import {
    MAX_BATCH_SIZE_LABEL,
    MAX_FILE_SIZE_LABEL,
    PDF_MIME_TYPE,
    countLabel,
    formatFileSize,
} from '@/lib/image';
import { acceptUploads, totalUploadBytes, uploadProblemSummary } from '@/lib/uploads';

export type LoadedPdf = { file: File; id: string };

export function useLoadedPdfs(max: number) {
    const { items, addItems, removeItem, moveItem, clearItems } = useUploads<LoadedPdf>({ max });

    return {
        documents: items,
        addPdfs: addItems,
        removePdf: removeItem,
        movePdf: moveItem,
        clearPdfs: clearItems,
    };
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

    function loadFiles(incoming: File[]) {
        if (disabled || !incoming.length) return;

        const { accepted, problems } = acceptUploads(incoming, {
            max,
            currentCount: documents.length,
            currentBytes: totalUploadBytes(documents),
            accepts: isPdf,
            copy: {
                full: limit => `You can merge up to ${countLabel(limit, 'PDF')} at a time.`,
                noRoom: room =>
                    `There is room for ${countLabel(room, 'more file')} — skipped the rest.`,
                unsupported: name => `${name}: not a PDF.`,
                tooLarge: name => `${name}: larger than ${MAX_FILE_SIZE_LABEL}.`,
                overBudget: name =>
                    `${name}: the batch has to stay under ${MAX_BATCH_SIZE_LABEL} in total.`,
            },
        });
        const summary = uploadProblemSummary(problems);

        if (summary) toast.error(summary);
        if (!accepted.length) return;

        onAdd(accepted.map(file => ({ file, id: `pdf-${(idRef.current += 1)}` })));
    }

    const hiddenInput = (
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
                        {formatFileSize(totalUploadBytes(documents))}
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
                            <ReorderControls
                                label={entry.file.name}
                                index={index}
                                count={documents.length}
                                disabled={disabled}
                                onMove={onMove}
                            />
                            <RemoveButton
                                label={entry.file.name}
                                disabled={disabled}
                                onClick={() => onRemove(index)}
                            />
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
                {hiddenInput}
            </div>
        );
    }

    return (
        <DropzoneShell
            accept="application/pdf,.pdf"
            multiple
            disabled={disabled}
            onFiles={loadFiles}
            dragIcon={<FileText className="size-6 text-primary" />}
            idleLabel="Drag & drop PDFs, or click to browse"
            dragLabel="Drop the PDFs here"
            hint={`PDF · up to ${max} at a time, ${MAX_BATCH_SIZE_LABEL} in total`}
        />
    );
}
