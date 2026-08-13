'use client';

import { Download, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { downloadFile } from '@/lib/download';
import { METADATA_MIME_TYPE, type MetadataReport } from '@/lib/metadata';
import { stripExtension } from '@/lib/image';

type MetadataReportCardProps = {
    report: MetadataReport;
    json: string;
    filename: string;
};

export function MetadataReportCard({ report, json, filename }: MetadataReportCardProps) {
    return (
        <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{report.filename}</p>
                <p className="text-sm text-muted-foreground">
                    {report.removable.length
                        ? `Carries ${report.removable.join(', ')}`
                        : 'No embedded metadata'}
                </p>
            </div>

            {report.coordinates && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0">
                        <p className="font-medium">This photo knows where it was taken</p>
                        <p className="mt-0.5 break-words">
                            GPS coordinates {report.coordinates} travel inside the file. Anyone you
                            send it to can read them.
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {report.groups.map(group => (
                    <div key={group.title} className="space-y-1.5">
                        <p className="text-sm font-medium">{group.title}</p>
                        <dl className="divide-y rounded-lg border text-sm">
                            {group.rows.map(row => (
                                <div
                                    key={`${group.title}-${row.label}`}
                                    className="flex gap-4 px-3 py-1.5"
                                >
                                    <dt className="w-40 shrink-0 text-muted-foreground">
                                        {row.label}
                                    </dt>
                                    <dd className="min-w-0 flex-1 break-words">{row.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                ))}
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                    downloadFile(
                        new TextEncoder().encode(json),
                        `${stripExtension(filename)}.json`,
                        METADATA_MIME_TYPE
                    )
                }
            >
                <Download />
                Download report (.json)
            </Button>
        </div>
    );
}
