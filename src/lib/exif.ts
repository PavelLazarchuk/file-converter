import type { Metadata } from 'sharp';

import { formatFileSize } from './image';
import type { MetadataGroup, MetadataReport, MetadataRow } from './metadata';

type Tiff = { buffer: Buffer; little: boolean; start: number };

type Entry = { tag: number; type: number; count: number; at: number };

const TYPE_SIZES: Record<number, number> = {
    1: 1, // BYTE
    2: 1, // ASCII
    3: 2, // SHORT
    4: 4, // LONG
    5: 8, // RATIONAL
    6: 1, // SBYTE
    7: 1, // UNDEFINED
    8: 2, // SSHORT
    9: 4, // SLONG
    10: 8, // SRATIONAL
    11: 4, // FLOAT
    12: 8, // DOUBLE
};

const EXIF_HEADER = 'Exif\0\0';
const MAX_ENTRIES = 256;
const MAX_VALUES = 32;

const EXIF_IFD_TAG = 0x8769;
const GPS_IFD_TAG = 0x8825;

function u16(tiff: Tiff, at: number): number {
    return tiff.little ? tiff.buffer.readUInt16LE(at) : tiff.buffer.readUInt16BE(at);
}

function u32(tiff: Tiff, at: number): number {
    return tiff.little ? tiff.buffer.readUInt32LE(at) : tiff.buffer.readUInt32BE(at);
}

function i32(tiff: Tiff, at: number): number {
    return tiff.little ? tiff.buffer.readInt32LE(at) : tiff.buffer.readInt32BE(at);
}

function openTiff(exif: Buffer): Tiff | null {
    const start = exif.subarray(0, EXIF_HEADER.length).toString('latin1') === EXIF_HEADER ? 6 : 0;

    if (exif.length < start + 8) return null;

    const order = exif.subarray(start, start + 2).toString('latin1');

    if (order !== 'II' && order !== 'MM') return null;

    return { buffer: exif, little: order === 'II', start };
}

function readIfd(tiff: Tiff, offset: number): Entry[] {
    const at = tiff.start + offset;

    if (offset <= 0 || at + 2 > tiff.buffer.length) return [];

    const count = Math.min(u16(tiff, at), MAX_ENTRIES);
    const entries: Entry[] = [];

    for (let index = 0; index < count; index += 1) {
        const entryAt = at + 2 + index * 12;

        if (entryAt + 12 > tiff.buffer.length) break;

        const type = u16(tiff, entryAt + 2);
        const size = TYPE_SIZES[type];

        if (!size) continue;

        const length = u32(tiff, entryAt + 4);
        const bytes = size * length;
        const valueAt = bytes <= 4 ? entryAt + 8 : tiff.start + u32(tiff, entryAt + 8);

        if (bytes === 0 || valueAt < 0 || valueAt + bytes > tiff.buffer.length) continue;

        entries.push({ tag: u16(tiff, entryAt), type, count: length, at: valueAt });
    }

    return entries;
}

function text(tiff: Tiff, entry: Entry): string {
    const raw = tiff.buffer.subarray(entry.at, entry.at + entry.count).toString('latin1');

    return raw.split('\0')[0].trim();
}

function numbers(tiff: Tiff, entry: Entry): number[] {
    const size = TYPE_SIZES[entry.type];
    const values: number[] = [];

    for (let index = 0; index < Math.min(entry.count, MAX_VALUES); index += 1) {
        const at = entry.at + index * size;

        switch (entry.type) {
            case 1:
            case 7:
                values.push(tiff.buffer.readUInt8(at));
                break;
            case 3:
                values.push(u16(tiff, at));
                break;
            case 4:
                values.push(u32(tiff, at));
                break;
            case 9:
                values.push(i32(tiff, at));
                break;
            case 5: {
                const denominator = u32(tiff, at + 4);

                values.push(denominator ? u32(tiff, at) / denominator : 0);
                break;
            }
            case 10: {
                const denominator = i32(tiff, at + 4);

                values.push(denominator ? i32(tiff, at) / denominator : 0);
                break;
            }
            default:
                break;
        }
    }

    return values;
}

function trim(value: number, places = 1): string {
    return Number(value.toFixed(places)).toString();
}

type Read = (tiff: Tiff, entry: Entry) => string;

const asText: Read = (tiff, entry) => text(tiff, entry);

const asNumber: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    return value === undefined ? '' : trim(value, 2);
};

/** EXIF dates are `2024:01:02 03:04:05`; only the date half uses colons as separators. */
const asDate: Read = (tiff, entry) => {
    const value = text(tiff, entry);

    return /^\d{4}:\d{2}:\d{2}/.test(value)
        ? `${value.slice(0, 10).replaceAll(':', '-')}${value.slice(10)}`
        : value;
};

const asExposure: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    if (!value) return '';

    return value >= 1 ? `${trim(value)} s` : `1/${Math.round(1 / value)} s`;
};

const asAperture: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    return value ? `f/${trim(value)}` : '';
};

const asFocalLength: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    return value ? `${trim(value)} mm` : '';
};

const asFlash: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    return value === undefined ? '' : value & 1 ? 'Fired' : 'Did not fire';
};

const asBias: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    return value === undefined ? '' : `${value > 0 ? '+' : ''}${trim(value)} EV`;
};

const IFD0_TAGS: Record<number, { label: string; read: Read }> = {
    0x010f: { label: 'Camera make', read: asText },
    0x0110: { label: 'Camera model', read: asText },
    0x0131: { label: 'Software', read: asText },
    0x013b: { label: 'Artist', read: asText },
    0x8298: { label: 'Copyright', read: asText },
    0x0132: { label: 'Modified', read: asDate },
};

const EXIF_TAGS: Record<number, { label: string; read: Read }> = {
    0x9003: { label: 'Taken', read: asDate },
    0x829a: { label: 'Exposure', read: asExposure },
    0x829d: { label: 'Aperture', read: asAperture },
    0x8827: { label: 'ISO', read: asNumber },
    0x920a: { label: 'Focal length', read: asFocalLength },
    0xa405: { label: 'Focal length (35mm)', read: asFocalLength },
    0x9204: { label: 'Exposure bias', read: asBias },
    0x9209: { label: 'Flash', read: asFlash },
    0xa434: { label: 'Lens', read: asText },
};

function rowsFrom(
    tiff: Tiff,
    entries: Entry[],
    tags: Record<number, { label: string; read: Read }>
): MetadataRow[] {
    const rows: MetadataRow[] = [];

    for (const entry of entries) {
        const tag = tags[entry.tag];

        if (!tag) continue;

        const value = tag.read(tiff, entry);

        if (value) rows.push({ label: tag.label, value });
    }

    return rows;
}

function subIfd(tiff: Tiff, entries: Entry[], tag: number): Entry[] {
    const pointer = entries.find(entry => entry.tag === tag);

    return pointer ? readIfd(tiff, numbers(tiff, pointer)[0] ?? 0) : [];
}

function coordinate(parts: number[], ref: string): number | null {
    if (parts.length < 3) return null;

    const [degrees, minutes, seconds] = parts;
    const value = degrees + minutes / 60 + seconds / 3600;

    if (!Number.isFinite(value)) return null;

    return ref === 'S' || ref === 'W' ? -value : value;
}

function gpsRows(
    tiff: Tiff,
    entries: Entry[]
): { rows: MetadataRow[]; coordinates: string | null } {
    const byTag = new Map(entries.map(entry => [entry.tag, entry]));
    const read = (tag: number) => byTag.get(tag);
    const latitude = read(2);
    const longitude = read(4);
    const latitudeRef = read(1);
    const longitudeRef = read(3);
    const rows: MetadataRow[] = [];
    let coordinates: string | null = null;

    if (latitude && longitude && latitudeRef && longitudeRef) {
        const lat = coordinate(numbers(tiff, latitude), text(tiff, latitudeRef));
        const lon = coordinate(numbers(tiff, longitude), text(tiff, longitudeRef));

        if (lat !== null && lon !== null) {
            coordinates = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
            rows.push({ label: 'Coordinates', value: coordinates });
        }
    }

    const altitude = read(6);
    const altitudeRef = read(5);

    if (altitude) {
        const [value] = numbers(tiff, altitude);
        const below = altitudeRef ? numbers(tiff, altitudeRef)[0] === 1 : false;

        if (value !== undefined) {
            rows.push({ label: 'Altitude', value: `${below ? '−' : ''}${trim(value)} m` });
        }
    }

    return { rows, coordinates };
}

export type ExifData = {
    camera: MetadataRow[];
    location: MetadataRow[];
    coordinates: string | null;
};

const EMPTY_EXIF: ExifData = { camera: [], location: [], coordinates: null };

export function readExif(exif: Buffer): ExifData {
    try {
        const tiff = openTiff(exif);

        if (!tiff) return EMPTY_EXIF;

        const ifd0 = readIfd(tiff, u32(tiff, tiff.start + 4));
        const camera = [
            ...rowsFrom(tiff, ifd0, IFD0_TAGS),
            ...rowsFrom(tiff, subIfd(tiff, ifd0, EXIF_IFD_TAG), EXIF_TAGS),
        ];
        const gps = gpsRows(tiff, subIfd(tiff, ifd0, GPS_IFD_TAG));

        return { camera, location: gps.rows, coordinates: gps.coordinates };
    } catch {
        return EMPTY_EXIF;
    }
}

const ORIENTATIONS: Record<number, string> = {
    1: 'Normal',
    2: 'Mirrored horizontally',
    3: 'Rotated 180°',
    4: 'Mirrored vertically',
    5: 'Mirrored and rotated 90° counter-clockwise',
    6: 'Rotated 90° clockwise',
    7: 'Mirrored and rotated 90° clockwise',
    8: 'Rotated 90° counter-clockwise',
};

const BIT_DEPTHS: Record<string, number> = {
    uchar: 8,
    char: 8,
    ushort: 16,
    short: 16,
    uint: 32,
    int: 32,
    float: 32,
    double: 64,
};

function bitDepth(depth: string | undefined): string | null {
    if (!depth) return null;

    const bits = BIT_DEPTHS[depth];

    return bits ? `${bits} bits per channel` : depth;
}

const COLOR_SPACES: Record<string, string> = {
    srgb: 'sRGB',
    rgb16: 'RGB (16-bit)',
    rgb: 'RGB',
    cmyk: 'CMYK',
    'b-w': 'Greyscale',
    grey16: 'Greyscale (16-bit)',
};

function group(title: string, rows: (MetadataRow | null)[]): MetadataGroup | null {
    const kept = rows.filter((row): row is MetadataRow => row !== null && row.value !== '');

    return kept.length ? { title, rows: kept } : null;
}

function row(label: string, value: string | number | undefined | null): MetadataRow | null {
    return value === undefined || value === null || value === ''
        ? null
        : { label, value: `${value}` };
}

const BLOCKS = [
    { key: 'exif', label: 'EXIF' },
    { key: 'icc', label: 'ICC color profile' },
    { key: 'iptc', label: 'IPTC' },
    { key: 'xmp', label: 'XMP' },
] as const;

export function describeMetadata(
    source: { filename: string; size: number; format: string },
    metadata: Metadata
): MetadataReport {
    const exif = metadata.exif ? readExif(metadata.exif) : EMPTY_EXIF;
    const swapped = (metadata.orientation ?? 1) >= 5;
    const width = (swapped ? metadata.height : metadata.width) ?? null;
    const height = (swapped ? metadata.width : metadata.height) ?? null;
    const pixels = width && height ? width * height : 0;
    const present = BLOCKS.filter(block => {
        const value = metadata[block.key];

        return value instanceof Buffer && value.length > 0;
    });
    const groups = [
        group('File', [
            row('Name', source.filename),
            row('Format', source.format),
            row('File size', formatFileSize(source.size)),
            row('Dimensions', width && height ? `${width} × ${height} px` : null),
            row('Megapixels', pixels ? `${trim(pixels / 1_000_000, 1)} MP` : null),
        ]),
        group('Image', [
            row(
                'Color space',
                metadata.space ? (COLOR_SPACES[metadata.space] ?? metadata.space) : null
            ),
            row('Channels', metadata.channels),
            row('Bit depth', bitDepth(metadata.depth)),
            row('Alpha channel', metadata.hasAlpha ? 'Yes' : 'No'),
            row('Resolution', metadata.density ? `${metadata.density} dpi` : null),
            row('Chroma subsampling', metadata.chromaSubsampling),
            row('Progressive', metadata.isProgressive ? 'Yes' : null),
            row(
                'Orientation tag',
                metadata.orientation
                    ? `${metadata.orientation} — ${ORIENTATIONS[metadata.orientation] ?? 'Unknown'}`
                    : null
            ),
            row('Frames', metadata.pages && metadata.pages > 1 ? metadata.pages : null),
        ]),
        group('Camera', exif.camera),
        group('Location', exif.location),
        group(
            'Embedded blocks',
            present.length
                ? present.map(block =>
                      row(block.label, formatFileSize((metadata[block.key] as Buffer).length))
                  )
                : [row('Embedded metadata', 'None')]
        ),
    ].filter((entry): entry is MetadataGroup => entry !== null);

    return {
        filename: source.filename,
        fileSize: source.size,
        format: source.format,
        width,
        height,
        coordinates: exif.coordinates,
        removable: present.map(block => block.label),
        groups,
    };
}
