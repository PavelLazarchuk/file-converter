'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { ImageDropzone, useLoadedImages } from '@/components/image-dropzone';
import { ResultCard } from '@/components/result-card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { pendingLabel, useFileAction } from '@/hooks/use-file-action';
import { inspectImage, stripImageMetadata } from '@/lib/actions';
import { MAX_BATCH_FILES, countLabel } from '@/lib/image';
import { parseMetadataReport, type MetadataReport } from '@/lib/metadata';
import { MetadataReportCard } from './metadata-report';

type Inspected = { report: MetadataReport; json: string; filename: string };

export function MetadataForm() {
    const { images, addImages, removeImage, clearImages } = useLoadedImages(MAX_BATCH_FILES);
    const [reports, setReports] = useState<Inspected[] | null>(null);
    const inspect = useFileAction(inspectImage);
    const strip = useFileAction(stripImageMetadata, 'clean-images.zip');

    const hasImages = images.length > 0;
    const isPending = inspect.isPending || strip.isPending;
    const removable = reports?.filter(entry => entry.report.removable.length > 0) ?? [];

    function reset() {
        setReports(null);
        inspect.clearResult();
        strip.clearResult();
    }

    function onSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (!hasImages) return;

        inspect.run(
            images,
            {},
            {
                onResult: files => {
                    const decoder = new TextDecoder();
                    const parsed = files.flatMap(file => {
                        const json = decoder.decode(file.data);
                        const report = parseMetadataReport(json);

                        return report ? [{ report, json, filename: file.filename }] : [];
                    });

                    setReports(parsed);

                    if (parsed.length) {
                        toast.success(
                            parsed.length === 1
                                ? 'Metadata read'
                                : `Metadata read for ${countLabel(parsed.length, 'file')}`
                        );
                    } else {
                        toast.error('Could not read the metadata report.');
                    }

                    return 'handled';
                },
            }
        );
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <ImageDropzone
                images={images}
                max={MAX_BATCH_FILES}
                disabled={isPending}
                onAdd={loaded => {
                    addImages(loaded);
                    reset();
                }}
                onRemove={index => {
                    removeImage(index);
                    reset();
                }}
                onClear={() => {
                    clearImages();
                    reset();
                }}
            />

            <p className="text-sm text-muted-foreground">
                Nothing is uploaded until you press the button, and the file is read in memory and
                dropped — the report is built on the server and sent straight back.
            </p>

            <Button type="submit" className="w-full" disabled={!hasImages || isPending}>
                {inspect.isPending ? (
                    <>
                        <Spinner /> {pendingLabel('Reading…', inspect.progress)}
                    </>
                ) : (
                    'Read metadata'
                )}
            </Button>

            {reports?.map(entry => (
                <MetadataReportCard
                    key={entry.filename}
                    report={entry.report}
                    json={entry.json}
                    filename={entry.filename}
                />
            ))}

            {removable.length > 0 && (
                <div className="space-y-2 rounded-xl border bg-card p-4">
                    <p className="text-sm font-medium">
                        {removable.length === reports?.length
                            ? countLabel(removable.length, 'file')
                            : `${removable.length} of ${countLabel(reports?.length ?? 0, 'file')}`}{' '}
                        {removable.length === 1 ? 'carries' : 'carry'} removable metadata
                    </p>
                    <p className="text-sm text-muted-foreground">
                        A clean copy is re-encoded without EXIF, GPS, ICC or XMP. The orientation is
                        baked into the pixels first, so the photo cannot come out sideways. Files
                        that carry nothing are reported back instead of copied.
                    </p>
                    <Button
                        type="button"
                        disabled={isPending}
                        onClick={() => strip.run(images, {})}
                    >
                        {strip.isPending ? (
                            <>
                                <Spinner /> {pendingLabel('Cleaning…', strip.progress)}
                            </>
                        ) : strip.autoDownload ? (
                            'Remove metadata & download'
                        ) : (
                            'Remove metadata'
                        )}
                    </Button>
                </div>
            )}

            {strip.outcome && (
                <ResultCard
                    outcome={strip.outcome}
                    leaving={strip.isLeaving}
                    onDismiss={strip.clearResult}
                    onDownloadAll={strip.downloadAll}
                />
            )}
        </form>
    );
}
