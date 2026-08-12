import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createZip } from './zip';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytes(text: string): Uint8Array {
    return encoder.encode(text);
}

type ParsedEntry = {
    name: string;
    crc: number;
    size: number;
    offset: number;
    contents: string;
};

function readZip(zip: Uint8Array): { entries: ParsedEntry[]; total: number } {
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const endOffset = zip.byteLength - 22;

    expect(view.getUint32(endOffset, true)).toBe(0x06054b50);

    const total = view.getUint16(endOffset + 10, true);
    const directorySize = view.getUint32(endOffset + 12, true);
    const directoryOffset = view.getUint32(endOffset + 16, true);

    expect(directoryOffset + directorySize).toBe(endOffset);

    const entries: ParsedEntry[] = [];
    let cursor = directoryOffset;

    for (let index = 0; index < total; index += 1) {
        expect(view.getUint32(cursor, true)).toBe(0x02014b50);

        const crc = view.getUint32(cursor + 16, true);
        const size = view.getUint32(cursor + 24, true);
        const nameLength = view.getUint16(cursor + 28, true);
        const offset = view.getUint32(cursor + 42, true);
        const name = decoder.decode(zip.subarray(cursor + 46, cursor + 46 + nameLength));

        expect(view.getUint32(offset, true)).toBe(0x04034b50);
        expect(view.getUint16(offset + 8, true)).toBe(0);
        expect(view.getUint32(offset + 14, true)).toBe(crc);
        expect(view.getUint32(offset + 22, true)).toBe(size);

        const localNameLength = view.getUint16(offset + 26, true);
        const dataStart = offset + 30 + localNameLength + view.getUint16(offset + 28, true);

        expect(decoder.decode(zip.subarray(offset + 30, offset + 30 + localNameLength))).toBe(name);

        entries.push({
            name,
            crc,
            size,
            offset,
            contents: decoder.decode(zip.subarray(dataStart, dataStart + size)),
        });
        cursor += 46 + nameLength;
    }

    expect(cursor).toBe(endOffset);

    return { entries, total };
}

describe('createZip', () => {
    it('stores every entry with its name, size and contents', () => {
        const zip = createZip([
            { name: 'favicon.ico', data: bytes('icon-bytes') },
            { name: 'README.txt', data: bytes('hello world') },
        ]);
        const { entries, total } = readZip(zip);

        expect(total).toBe(2);
        expect(entries.map(entry => entry.name)).toEqual(['favicon.ico', 'README.txt']);
        expect(entries[1].contents).toBe('hello world');
        expect(entries[0].size).toBe(10);
    });

    it('computes the CRC-32 of the stored bytes', () => {
        const { entries } = readZip(createZip([{ name: 'a.txt', data: bytes('hello') }]));

        expect(entries[0].crc).toBe(0x3610a686);
    });

    it('points each central entry at its own local header', () => {
        const zip = createZip([
            { name: 'one.txt', data: bytes('1') },
            { name: 'two.txt', data: bytes('22') },
            { name: 'three.txt', data: bytes('333') },
        ]);
        const { entries } = readZip(zip);

        expect(entries.map(entry => entry.contents)).toEqual(['1', '22', '333']);
        expect(entries[0].offset).toBe(0);
        expect(entries[1].offset).toBeGreaterThan(entries[0].offset);
        expect(entries[2].offset).toBeGreaterThan(entries[1].offset);
    });

    it('writes UTF-8 names and marks the flag', () => {
        const zip = createZip([{ name: 'ünïcode ✓.txt', data: bytes('x') }]);
        const view = new DataView(zip.buffer);

        expect(view.getUint16(6, true) & 0x0800).toBe(0x0800);
        expect(readZip(zip).entries[0].name).toBe('ünïcode ✓.txt');
    });

    it('writes an empty archive as just the end record', () => {
        const zip = createZip([]);

        expect(zip).toHaveLength(22);
        expect(readZip(zip).total).toBe(0);
    });

    it('produces an archive unzip accepts', () => {
        const zip = createZip([
            { name: 'site.webmanifest', data: bytes('{"name":"test"}') },
            { name: 'nested/icon.png', data: bytes('not really a png') },
        ]);
        const path = join(mkdtempSync(join(tmpdir(), 'zip-test-')), 'pack.zip');

        writeFileSync(path, zip);

        const listing = execFileSync('unzip', ['-l', path], { encoding: 'utf8' });

        expect(execFileSync('unzip', ['-t', path], { encoding: 'utf8' })).toContain('No errors');
        expect(listing).toContain('site.webmanifest');
        expect(listing).toContain('nested/icon.png');
    });
});
