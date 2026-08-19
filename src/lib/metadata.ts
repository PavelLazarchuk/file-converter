import { z } from 'zod';

export const METADATA_MIME_TYPE = 'application/json';

export const METADATA_ROW_KEYS = [
    'name',
    'format',
    'fileSize',
    'dimensions',
    'megapixels',
    'colorSpace',
    'channels',
    'bitDepth',
    'alpha',
    'resolution',
    'chroma',
    'progressive',
    'orientationTag',
    'frames',
    'embedded',
    'cameraMake',
    'cameraModel',
    'software',
    'artist',
    'copyright',
    'modified',
    'taken',
    'exposure',
    'aperture',
    'iso',
    'focalLength',
    'focalLength35',
    'exposureBias',
    'flash',
    'lens',
    'coordinates',
    'altitude',
    'exif',
    'icc',
    'iptc',
    'xmp',
] as const;

export const METADATA_GROUP_KEYS = ['file', 'image', 'camera', 'location', 'blocks'] as const;

export const METADATA_VALUE_KEYS = [
    'yes',
    'no',
    'none',
    'bitsPerChannel',
    'dimensions',
    'megapixels',
    'dpi',
    'orientations.1',
    'orientations.2',
    'orientations.3',
    'orientations.4',
    'orientations.5',
    'orientations.6',
    'orientations.7',
    'orientations.8',
    'orientations.unknown',
    'flashFired',
    'flashOff',
] as const;

export type MetadataRowKey = (typeof METADATA_ROW_KEYS)[number];
export type MetadataGroupKey = (typeof METADATA_GROUP_KEYS)[number];
export type MetadataValueKey = (typeof METADATA_VALUE_KEYS)[number];

const metadataValueSchema = z.union([
    z.object({ text: z.string() }),
    z.object({
        message: z.enum(METADATA_VALUE_KEYS),
        params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    }),
    z.object({ bytes: z.number() }),
    z.object({ format: z.string() }),
]);

const metadataRowSchema = z.object({
    key: z.enum(METADATA_ROW_KEYS),
    value: metadataValueSchema,
});

const metadataGroupSchema = z.object({
    key: z.enum(METADATA_GROUP_KEYS),
    rows: z.array(metadataRowSchema),
});

export const metadataReportSchema = z.object({
    filename: z.string(),
    fileSize: z.number(),
    format: z.string(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    coordinates: z.string().nullable(),
    removable: z.array(z.enum(METADATA_ROW_KEYS)),
    groups: z.array(metadataGroupSchema),
});

export type MetadataValue = z.infer<typeof metadataValueSchema>;
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
