'use client';

import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { FileDropzone, useLoadedFiles, type LoadedFile } from '@/components/file-dropzone';
import { MAX_BATCH_SIZE_LABEL, MAX_FILE_SIZE_LABEL, PDF_MIME_TYPE } from '@/lib/image';

export type LoadedPdf = LoadedFile;

export function useLoadedPdfs(max: number) {
    const { items, addItems, removeItem, moveItem, clearItems } = useLoadedFiles(max);

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
    onClear: () => void;
    onMove?: (from: number, to: number) => void;
    disabled?: boolean;
    max: number;
    receivesHandoff?: boolean;
};

export function PdfDropzone({ documents, max, ...props }: PdfDropzoneProps) {
    const t = useTranslations('Uploads');
    const count = useTranslations('Common');
    const single = max === 1;

    return (
        <FileDropzone
            {...props}
            files={documents}
            max={max}
            accept="application/pdf,.pdf"
            accepts={isPdf}
            icon={FileText}
            copy={{
                count: value => count('pdfs', { count: value }),
                full: limit => t('fullPdfs', { count: count('pdfs', { count: limit }) }),
                notAccepted: name => t('notPdf', { name }),
                idle: single ? t('idlePdfSingle') : t('idlePdf'),
                drag: single ? t('dragPdfSingle') : t('dragPdf'),
                hint: single
                    ? t('hintPdfSingle', { maxFile: MAX_FILE_SIZE_LABEL })
                    : t('hintPdf', { max, maxBatch: MAX_BATCH_SIZE_LABEL }),
            }}
        />
    );
}
