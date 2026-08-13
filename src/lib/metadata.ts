import { z } from 'zod';

export const METADATA_MIME_TYPE = 'application/json';

const metadataRowSchema = z.object({ label: z.string(), value: z.string() });

const metadataGroupSchema = z.object({
    title: z.string(),
    rows: z.array(metadataRowSchema),
});

export const metadataReportSchema = z.object({
    filename: z.string(),
    fileSize: z.number(),
    format: z.string(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    coordinates: z.string().nullable(),
    removable: z.array(z.string()),
    groups: z.array(metadataGroupSchema),
});

export type MetadataRow = z.infer<typeof metadataRowSchema>;
export type MetadataGroup = z.infer<typeof metadataGroupSchema>;
export type MetadataReport = z.infer<typeof metadataReportSchema>;

export function parseMetadataReport(json: string): MetadataReport | null {
    try {
        const parsed = metadataReportSchema.safeParse(JSON.parse(json));

        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}
