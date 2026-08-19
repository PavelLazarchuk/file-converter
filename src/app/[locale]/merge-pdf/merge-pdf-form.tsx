'use client';

import { useTranslations } from 'next-intl';

import { ResultCard } from '@/components/result-card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useFileAction } from '@/hooks/use-file-action';
import { mergePdf } from '@/lib/actions';
import { MAX_BATCH_FILES, MAX_PDF_PAGES } from '@/lib/image';

import { PdfDropzone, useLoadedPdfs } from './pdf-dropzone';

export function MergePdfForm() {
    const t = useTranslations('MergePdf');
    const count = useTranslations('Common');
    const { documents, addPdfs, removePdf, movePdf, clearPdfs } = useLoadedPdfs(MAX_BATCH_FILES);
    const { isPending, outcome, isLeaving, run, clearResult, downloadAll, autoDownload } =
        useFileAction(mergePdf, undefined, { chunkSize: null });

    const ready = documents.length >= 2;

    return (
        <form
            onSubmit={event => {
                event.preventDefault();
                if (ready) run(documents, {});
            }}
            className="space-y-6"
            noValidate
        >
            <PdfDropzone
                documents={documents}
                max={MAX_BATCH_FILES}
                disabled={isPending}
                onAdd={added => {
                    addPdfs(added);
                    clearResult();
                }}
                onRemove={index => {
                    removePdf(index);
                    clearResult();
                }}
                onMove={(from, to) => {
                    movePdf(from, to);
                    clearResult();
                }}
                onClear={() => {
                    clearPdfs();
                    clearResult();
                }}
            />

            {documents.length === 1 && (
                <p className="text-sm text-muted-foreground">{t('needTwo')}</p>
            )}

            {ready && (
                <p className="text-sm text-muted-foreground">
                    {t('batchNote', {
                        pdfs: count('pdfs', { count: documents.length }),
                        maxPages: MAX_PDF_PAGES,
                    })}
                </p>
            )}

            {outcome && (
                <ResultCard
                    outcome={outcome}
                    leaving={isLeaving}
                    onDismiss={clearResult}
                    onDownloadAll={downloadAll}
                />
            )}

            <Button type="submit" className="w-full" disabled={!ready || isPending}>
                {isPending ? (
                    <>
                        <Spinner /> {t('pending')}
                    </>
                ) : autoDownload ? (
                    t('submitDownload')
                ) : (
                    t('submit')
                )}
            </Button>
        </form>
    );
}
