import { describe, expect, it } from 'vitest';

import { encodeIco } from './ico';

const HEADER_BYTES = 6;
const DIRECTORY_ENTRY_BYTES = 16;

function png(size: number, fill: number): Buffer {
    return Buffer.alloc(size, fill);
}

describe('encodeIco', () => {
    it('writes the ICO header', () => {
        const ico = encodeIco([{ size: 16, data: png(10, 1) }]);

        expect(ico.readUInt16LE(0)).toBe(0); // reserved
        expect(ico.readUInt16LE(2)).toBe(1); // type: icon
        expect(ico.readUInt16LE(4)).toBe(1); // entry count
    });

    it('points each directory entry at its own payload', () => {
        const entries = [
            { size: 16, data: png(10, 1) },
            { size: 32, data: png(20, 2) },
            { size: 48, data: png(30, 3) },
        ];
        const ico = encodeIco(entries);
        let expectedOffset = HEADER_BYTES + DIRECTORY_ENTRY_BYTES * entries.length;

        entries.forEach((entry, index) => {
            const at = HEADER_BYTES + DIRECTORY_ENTRY_BYTES * index;

            expect(ico.readUInt8(at)).toBe(entry.size);
            expect(ico.readUInt8(at + 1)).toBe(entry.size);
            expect(ico.readUInt16LE(at + 4)).toBe(1); // colour planes
            expect(ico.readUInt16LE(at + 6)).toBe(32); // bits per pixel
            expect(ico.readUInt32LE(at + 8)).toBe(entry.data.length);
            expect(ico.readUInt32LE(at + 12)).toBe(expectedOffset);
            expect(
                ico.subarray(expectedOffset, expectedOffset + entry.data.length).equals(entry.data)
            ).toBe(true);

            expectedOffset += entry.data.length;
        });

        expect(ico).toHaveLength(expectedOffset);
    });

    it('encodes 256px as 0, the format’s escape for "not 8-bit"', () => {
        const ico = encodeIco([{ size: 256, data: png(4, 9) }]);

        expect(ico.readUInt8(HEADER_BYTES)).toBe(0);
        expect(ico.readUInt8(HEADER_BYTES + 1)).toBe(0);
    });
});
