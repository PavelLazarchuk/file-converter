'use client';

import { Download, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useFileSize } from '@/hooks/use-messages';
import { downloadFile } from '@/lib/download';
import { looseTranslator } from '@/lib/messages';
import { METADATA_MIME_TYPE, type MetadataReport, type MetadataValue } from '@/lib/metadata';
import { stripExtension } from '@/lib/image';

type MetadataReportCardProps = {
    report: MetadataReport;
    json: string;
    filename: string;
};

export function MetadataReportCard({ report, json, filename }: MetadataReportCardProps) {
    const t = useTranslations('Metadata');
    const dynamic = looseTranslator(t);
    const labels = looseTranslator(useTranslations('Labels'));
    const fileSize = useFileSize();

    function renderValue(value: MetadataValue): string {
        if ('text' in value) return value.text;
        if ('bytes' in value) return fileSize(value.bytes);
        if ('format' in value) return labels(`formats.${value.format}`);

        return dynamic(`values.${value.message}`, value.params);
    }

    return (
        <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{report.filename}</p>
                <p className="text-sm text-muted-foreground">
                    {report.removable.length
                        ? t('carries', {
                              blocks: report.removable
                                  .map(block => dynamic(`rows.${block}`))
                                  .join(', '),
                          })
                        : t('noMetadata')}
                </p>
            </div>

            {report.coordinates && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0">
                        <p className="font-medium">{t('gpsTitle')}</p>
                        <p className="mt-0.5 break-words">
                            {t('gpsBody', { coordinates: report.coordinates })}
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {report.groups.map(group => (
                    <div key={group.key} className="space-y-1.5">
                        <p className="text-sm font-medium">{dynamic(`groups.${group.key}`)}</p>
                        <dl className="divide-y rounded-lg border text-sm">
                            {group.rows.map(row => (
                                <div
                                    key={`${group.key}-${row.key}`}
                                    className="flex gap-4 px-3 py-1.5"
                                >
                                    <dt className="w-40 shrink-0 text-muted-foreground">
                                        {dynamic(`rows.${row.key}`)}
                                    </dt>
                                    <dd className="min-w-0 flex-1 break-words">
                                        {renderValue(row.value)}
                                    </dd>
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
                {t('downloadReport')}
            </Button>
        </div>
    );
}
