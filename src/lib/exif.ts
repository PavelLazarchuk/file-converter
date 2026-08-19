import type { Metadata } from 'sharp';

import type {
    MetadataGroup,
    MetadataGroupKey,
    MetadataReport,
    MetadataRow,
    MetadataRowKey,
    MetadataValue,
    MetadataValueKey,
} from './metadata';

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

type Read = (tiff: Tiff, entry: Entry) => MetadataValue | null;

function textValue(value: string): MetadataValue | null {
    return value ? { text: value } : null;
}

const asText: Read = (tiff, entry) => textValue(text(tiff, entry));

const asNumber: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    return value === undefined ? null : { text: trim(value, 2) };
};

/** EXIF dates are `2024:01:02 03:04:05`; only the date half uses colons as separators. */
const asDate: Read = (tiff, entry) => {
    const value = text(tiff, entry);

    return textValue(
        /^\d{4}:\d{2}:\d{2}/.test(value)
            ? `${value.slice(0, 10).replaceAll(':', '-')}${value.slice(10)}`
            : value
    );
};

const asExposure: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    if (!value) return null;

    return { text: value >= 1 ? `${trim(value)} s` : `1/${Math.round(1 / value)} s` };
};

const asAperture: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    return value ? { text: `f/${trim(value)}` } : null;
};

const asFocalLength: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    return value ? { text: `${trim(value)} mm` } : null;
};

const asFlash: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    return value === undefined ? null : { message: value & 1 ? 'flashFired' : 'flashOff' };
};

const asBias: Read = (tiff, entry) => {
    const [value] = numbers(tiff, entry);

    return value === undefined ? null : { text: `${value > 0 ? '+' : ''}${trim(value)} EV` };
};

const IFD0_TAGS: Record<number, { key: MetadataRowKey; read: Read }> = {
    0x010f: { key: 'cameraMake', read: asText },
    0x0110: { key: 'cameraModel', read: asText },
    0x0131: { key: 'software', read: asText },
    0x013b: { key: 'artist', read: asText },
    0x8298: { key: 'copyright', read: asText },
    0x0132: { key: 'modified', read: asDate },
};

const EXIF_TAGS: Record<number, { key: MetadataRowKey; read: Read }> = {
    0x9003: { key: 'taken', read: asDate },
    0x829a: { key: 'exposure', read: asExposure },
    0x829d: { key: 'aperture', read: asAperture },
    0x8827: { key: 'iso', read: asNumber },
    0x920a: { key: 'focalLength', read: asFocalLength },
    0xa405: { key: 'focalLength35', read: asFocalLength },
    0x9204: { key: 'exposureBias', read: asBias },
    0x9209: { key: 'flash', read: asFlash },
    0xa434: { key: 'lens', read: asText },
};

function rowsFrom(
    tiff: Tiff,
    entries: Entry[],
    tags: Record<number, { key: MetadataRowKey; read: Read }>
): MetadataRow[] {
    const rows: MetadataRow[] = [];

    for (const entry of entries) {
        const tag = tags[entry.tag];

        if (!tag) continue;

        const value = tag.read(tiff, entry);

        if (value) rows.push({ key: tag.key, value });
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
            rows.push({ key: 'coordinates', value: { text: coordinates } });
        }
    }

    const altitude = read(6);
    const altitudeRef = read(5);

    if (altitude) {
        const [value] = numbers(tiff, altitude);
        const below = altitudeRef ? numbers(tiff, altitudeRef)[0] === 1 : false;

        if (value !== undefined) {
            rows.push({
                key: 'altitude',
                value: { text: `${below ? '−' : ''}${trim(value)} m` },
            });
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

const ORIENTATIONS: Record<number, MetadataValueKey> = {
    1: 'orientations.1',
    2: 'orientations.2',
    3: 'orientations.3',
    4: 'orientations.4',
    5: 'orientations.5',
    6: 'orientations.6',
    7: 'orientations.7',
    8: 'orientations.8',
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

function bitDepth(depth: string | undefined): MetadataValue | null {
    if (!depth) return null;

    const bits = BIT_DEPTHS[depth];

    return bits ? { message: 'bitsPerChannel', params: { bits } } : { text: depth };
}

const COLOR_SPACES: Record<string, string> = {
    srgb: 'sRGB',
    rgb16: 'RGB (16-bit)',
    rgb: 'RGB',
    cmyk: 'CMYK',
    'b-w': 'Greyscale',
    grey16: 'Greyscale (16-bit)',
};

function group(key: MetadataGroupKey, rows: (MetadataRow | null)[]): MetadataGroup | null {
    const kept = rows.filter((row): row is MetadataRow => row !== null);

    return kept.length ? { key, rows: kept } : null;
}

function row(
    key: MetadataRowKey,
    value: MetadataValue | string | number | undefined | null
): MetadataRow | null {
    if (value === undefined || value === null || value === '') return null;

    return {
        key,
        value: typeof value === 'object' ? value : { text: `${value}` },
    };
}

const BLOCK_KEYS = ['exif', 'icc', 'iptc', 'xmp'] as const;

export function describeMetadata(
    source: { filename: string; size: number; format: string },
    metadata: Metadata
): MetadataReport {
    const exif = metadata.exif ? readExif(metadata.exif) : EMPTY_EXIF;
    const swapped = (metadata.orientation ?? 1) >= 5;
    const width = (swapped ? metadata.height : metadata.width) ?? null;
    const height = (swapped ? metadata.width : metadata.height) ?? null;
    const pixels = width && height ? width * height : 0;
    const present = BLOCK_KEYS.filter(key => {
        const value = metadata[key];

        return value instanceof Buffer && value.length > 0;
    });
    const groups = [
        group('file', [
            row('name', source.filename),
            row('format', { format: source.format }),
            row('fileSize', { bytes: source.size }),
            row(
                'dimensions',
                width && height ? { message: 'dimensions', params: { width, height } } : null
            ),
            row(
                'megapixels',
                pixels
                    ? { message: 'megapixels', params: { mp: trim(pixels / 1_000_000, 1) } }
                    : null
            ),
        ]),
        group('image', [
            row(
                'colorSpace',
                metadata.space ? (COLOR_SPACES[metadata.space] ?? metadata.space) : null
            ),
            row('channels', metadata.channels),
            row('bitDepth', bitDepth(metadata.depth)),
            row('alpha', { message: metadata.hasAlpha ? 'yes' : 'no' }),
            row(
                'resolution',
                metadata.density ? { message: 'dpi', params: { dpi: metadata.density } } : null
            ),
            row('chroma', metadata.chromaSubsampling),
            row('progressive', metadata.isProgressive ? { message: 'yes' } : null),
            row(
                'orientationTag',
                metadata.orientation
                    ? {
                          message: ORIENTATIONS[metadata.orientation] ?? 'orientations.unknown',
                          params: { value: metadata.orientation },
                      }
                    : null
            ),
            row('frames', metadata.pages && metadata.pages > 1 ? metadata.pages : null),
        ]),
        group('camera', exif.camera),
        group('location', exif.location),
        group(
            'blocks',
            present.length
                ? present.map(key => row(key, { bytes: (metadata[key] as Buffer).length }))
                : [row('embedded', { message: 'none' })]
        ),
    ].filter((entry): entry is MetadataGroup => entry !== null);

    return {
        filename: source.filename,
        fileSize: source.size,
        format: source.format,
        width,
        height,
        coordinates: exif.coordinates,
        removable: [...present],
        groups,
    };
}
