import sharp, { type Sharp } from 'sharp';
import { describe, expect, it } from 'vitest';

import { describeMetadata, readExif } from './exif';
import type { MetadataRow } from './metadata';

type Field = { tag: number; type: number; values: number[] | string };

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 9: 4, 10: 8 };

const EXIF_IFD_TAG = 0x8769;
const GPS_IFD_TAG = 0x8825;

function writerFor(buffer: Buffer, little: boolean) {
    return (size: number, value: number, at: number, signed = false): number => {
        if (size === 1) return buffer.writeUInt8(value, at);
        if (size === 2) {
            return little ? buffer.writeUInt16LE(value, at) : buffer.writeUInt16BE(value, at);
        }
        if (signed) return little ? buffer.writeInt32LE(value, at) : buffer.writeInt32BE(value, at);

        return little ? buffer.writeUInt32LE(value, at) : buffer.writeUInt32BE(value, at);
    };
}

function encode(field: Field, little: boolean): { count: number; data: Buffer } {
    if (typeof field.values === 'string') {
        const data = Buffer.from(`${field.values}\0`, 'latin1');

        return { count: data.length, data };
    }

    const rational = field.type === 5 || field.type === 10;
    const signed = field.type === 9 || field.type === 10;
    const count = rational ? field.values.length / 2 : field.values.length;
    const size = rational ? 4 : TYPE_SIZES[field.type];
    const data = Buffer.alloc(field.values.length * size);
    const write = writerFor(data, little);

    field.values.forEach((value, index) => write(size, value, index * size, signed));

    return { count, data };
}

function ifdSize(entries: number): number {
    return 2 + entries * 12 + 4;
}

function buildExif({
    ifd0 = [] as Field[],
    exif = [] as Field[],
    gps = [] as Field[],
    little = true,
} = {}): Buffer {
    const ifd0Start = 8;
    const exifStart =
        ifd0Start + ifdSize(ifd0.length + (exif.length ? 1 : 0) + (gps.length ? 1 : 0));
    const gpsStart = exifStart + (exif.length ? ifdSize(exif.length) : 0);
    const dataStart = gpsStart + (gps.length ? ifdSize(gps.length) : 0);
    const entries = [
        ...ifd0,
        ...(exif.length ? [{ tag: EXIF_IFD_TAG, type: 4, values: [exifStart] }] : []),
        ...(gps.length ? [{ tag: GPS_IFD_TAG, type: 4, values: [gpsStart] }] : []),
    ].sort((left, right) => left.tag - right.tag);
    const overflow: Buffer[] = [];
    let dataAt = dataStart;

    function writeIfd(fields: Field[]): Buffer {
        const block = Buffer.alloc(ifdSize(fields.length));
        const write = writerFor(block, little);

        write(2, fields.length, 0);

        fields.forEach((field, index) => {
            const at = 2 + index * 12;
            const { count, data } = encode(field, little);

            write(2, field.tag, at);
            write(2, field.type, at + 2);
            write(4, count, at + 4);

            if (data.length <= 4) {
                data.copy(block, at + 8);
            } else {
                write(4, dataAt, at + 8);
                overflow.push(data);
                dataAt += data.length;
            }
        });

        return block;
    }

    const blocks = [
        writeIfd(entries),
        ...(exif.length ? [writeIfd(exif)] : []),
        ...(gps.length ? [writeIfd(gps)] : []),
    ];
    const header = Buffer.alloc(8);
    const writeHeader = writerFor(header, little);

    header.write(little ? 'II' : 'MM', 0, 'latin1');
    writeHeader(2, 42, 2);
    writeHeader(4, ifd0Start, 4);

    return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), header, ...blocks, ...overflow]);
}

const CAMERA_FIELDS: Field[] = [
    { tag: 0x9003, type: 2, values: '2024:01:02 03:04:05' },
    { tag: 0x829a, type: 5, values: [1, 125] },
    { tag: 0x829d, type: 5, values: [28, 10] },
    { tag: 0x8827, type: 3, values: [400] },
    { tag: 0x920a, type: 5, values: [35, 1] },
    { tag: 0x9204, type: 10, values: [-1, 3] },
    { tag: 0x9209, type: 3, values: [1] },
    { tag: 0xa434, type: 2, values: '35mm f/2' },
];

const SYDNEY_GPS: Field[] = [
    { tag: 1, type: 2, values: 'S' },
    { tag: 2, type: 5, values: [33, 1, 51, 1, 54, 1] },
    { tag: 3, type: 2, values: 'E' },
    { tag: 4, type: 5, values: [151, 1, 12, 1, 36, 1] },
    { tag: 6, type: 5, values: [58, 1] },
];

async function photo(exif?: Parameters<Sharp['withExif']>[0]) {
    const base = sharp({
        create: { width: 24, height: 16, channels: 3, background: { r: 90, g: 90, b: 90 } },
    });
    const buffer = await (exif ? base.withExif(exif) : base).jpeg().toBuffer();

    return sharp(buffer).metadata();
}

function value(rows: MetadataRow[], key: string) {
    const found = rows.find(row => row.key === key)?.value;

    if (!found) return undefined;
    if ('text' in found) return found.text;
    if ('bytes' in found) return String(found.bytes);
    if ('format' in found) return found.format;

    return found.message;
}

describe('readExif', () => {
    it('reads the tags libvips itself writes into IFD0', async () => {
        const metadata = await photo({
            IFD0: { Make: 'ACME', Model: 'X100', Software: 'test-suite', Copyright: 'nobody' },
        });
        const { camera } = readExif(metadata.exif as Buffer);

        expect(value(camera, 'cameraMake')).toBe('ACME');
        expect(value(camera, 'cameraModel')).toBe('X100');
        expect(value(camera, 'software')).toBe('test-suite');
        expect(value(camera, 'copyright')).toBe('nobody');
    });

    it('formats the shooting settings out of the Exif sub-IFD', () => {
        const { camera } = readExif(
            buildExif({ ifd0: [{ tag: 0x0110, type: 2, values: 'X100' }], exif: CAMERA_FIELDS })
        );

        expect(value(camera, 'cameraModel')).toBe('X100');
        expect(value(camera, 'taken')).toBe('2024-01-02 03:04:05');
        expect(value(camera, 'exposure')).toBe('1/125 s');
        expect(value(camera, 'aperture')).toBe('f/2.8');
        expect(value(camera, 'iso')).toBe('400');
        expect(value(camera, 'focalLength')).toBe('35 mm');
        expect(value(camera, 'exposureBias')).toBe('-0.3 EV');
        expect(value(camera, 'flash')).toBe('flashFired');
        expect(value(camera, 'lens')).toBe('35mm f/2');
    });

    it('turns GPS degrees, minutes and seconds into signed decimals', () => {
        const { location, coordinates } = readExif(buildExif({ gps: SYDNEY_GPS }));

        expect(coordinates).toBe('-33.865000, 151.210000');
        expect(value(location, 'coordinates')).toBe('-33.865000, 151.210000');
        expect(value(location, 'altitude')).toBe('58 m');
    });

    it('reads a big-endian block the same way', () => {
        const little = readExif(buildExif({ exif: CAMERA_FIELDS, gps: SYDNEY_GPS }));
        const big = readExif(buildExif({ exif: CAMERA_FIELDS, gps: SYDNEY_GPS, little: false }));

        expect(big).toEqual(little);
        expect(big.coordinates).toBe('-33.865000, 151.210000');
    });

    it('returns nothing for a block it cannot make sense of', () => {
        const empty = { camera: [], location: [], coordinates: null };

        expect(readExif(Buffer.from('not an exif block'))).toEqual(empty);
        expect(readExif(Buffer.alloc(0))).toEqual(empty);
        expect(readExif(Buffer.from('Exif\0\0XX', 'latin1'))).toEqual(empty);
    });

    it('survives a truncated block instead of throwing', () => {
        const full = buildExif({ exif: CAMERA_FIELDS, gps: SYDNEY_GPS });

        for (const length of [10, 20, 40, 80]) {
            expect(() => readExif(full.subarray(0, length))).not.toThrow();
        }
    });
});

describe('describeMetadata', () => {
    it('reports the file, the pixels and what can be stripped', async () => {
        const metadata = await photo({ IFD0: { Copyright: 'test-suite' } });
        const report = describeMetadata(
            { filename: 'shot.jpg', size: 2048, format: 'jpeg' },
            metadata
        );
        const keys = report.groups.map(group => group.key);
        const file = report.groups.find(group => group.key === 'file');

        expect(report).toMatchObject({ filename: 'shot.jpg', width: 24, height: 16 });
        expect(report.removable).toContain('exif');
        expect(keys).toEqual(expect.arrayContaining(['file', 'image', 'camera']));
        expect(value(file?.rows ?? [], 'format')).toBe('jpeg');
        expect(file?.rows.find(row => row.key === 'dimensions')?.value).toEqual({
            message: 'dimensions',
            params: { width: 24, height: 16 },
        });
        expect(file?.rows.find(row => row.key === 'fileSize')?.value).toEqual({ bytes: 2048 });
    });

    it('reports the bit depth in bits, not as sharp’s storage type', async () => {
        const metadata = await photo();
        const report = describeMetadata({ filename: 'a.jpg', size: 10, format: 'jpeg' }, metadata);
        const rows = report.groups.find(group => group.key === 'image')?.rows ?? [];

        expect(metadata.depth).toBe('uchar');
        expect(rows.find(row => row.key === 'bitDepth')?.value).toEqual({
            message: 'bitsPerChannel',
            params: { bits: 8 },
        });
        expect(value(rows, 'colorSpace')).toBe('sRGB');
    });

    it('surfaces the coordinates separately so the form can warn about them', async () => {
        const metadata = await photo();
        const report = describeMetadata(
            { filename: 'a.jpg', size: 10, format: 'jpeg' },
            {
                ...metadata,
                exif: buildExif({ gps: SYDNEY_GPS }),
            }
        );

        expect(report.coordinates).toBe('-33.865000, 151.210000');
        expect(report.groups.map(group => group.key)).toContain('location');
    });

    it('reports the displayed dimensions for a sideways orientation tag', async () => {
        const metadata = await photo();
        const report = describeMetadata(
            { filename: 'a.jpg', size: 10, format: 'jpeg' },
            {
                ...metadata,
                width: 24,
                height: 16,
                orientation: 6,
            }
        );

        expect([report.width, report.height]).toEqual([16, 24]);
    });

    it('says so when there is nothing embedded', async () => {
        const metadata = await photo();
        const report = describeMetadata(
            { filename: 'bare.jpg', size: 10, format: 'jpeg' },
            metadata
        );
        const blocks = report.groups.find(group => group.key === 'blocks');

        expect(report.removable).toEqual([]);
        expect(report.coordinates).toBeNull();
        expect(value(blocks?.rows ?? [], 'embedded')).toBe('none');
    });
});
