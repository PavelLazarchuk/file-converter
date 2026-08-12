const LOCAL_HEADER_BYTES = 30;
const CENTRAL_ENTRY_BYTES = 46;
const END_RECORD_BYTES = 22;
const VERSION = 20;
const UTF8_FLAG = 0x0800;

const crcTable = Int32Array.from({ length: 256 }, (_, index) => {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    return value;
});

function crc32(data: Uint8Array): number {
    let crc = -1;

    for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);

    return (crc ^ -1) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
    return {
        time:
            (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date:
            (Math.max(0, date.getFullYear() - 1980) << 9) |
            ((date.getMonth() + 1) << 5) |
            date.getDate(),
    };
}

export type ZipEntry = { name: string; data: Uint8Array };

export function createZip(entries: ZipEntry[], now = new Date()): Uint8Array {
    const { time, date } = dosDateTime(now);
    const encoder = new TextEncoder();
    const names = entries.map(entry => encoder.encode(entry.name));
    const checksums = entries.map(entry => crc32(entry.data));
    const localBytes = entries.reduce(
        (sum, entry, index) => sum + LOCAL_HEADER_BYTES + names[index].length + entry.data.length,
        0
    );
    const centralBytes = names.reduce((sum, name) => sum + CENTRAL_ENTRY_BYTES + name.length, 0);
    const output = new Uint8Array(localBytes + centralBytes + END_RECORD_BYTES);
    const view = new DataView(output.buffer);
    const offsets: number[] = [];
    let cursor = 0;

    entries.forEach((entry, index) => {
        const name = names[index];

        offsets.push(cursor);
        view.setUint32(cursor, 0x04034b50, true);
        view.setUint16(cursor + 4, VERSION, true);
        view.setUint16(cursor + 6, UTF8_FLAG, true);
        view.setUint16(cursor + 10, time, true);
        view.setUint16(cursor + 12, date, true);
        view.setUint32(cursor + 14, checksums[index], true);
        view.setUint32(cursor + 18, entry.data.length, true);
        view.setUint32(cursor + 22, entry.data.length, true);
        view.setUint16(cursor + 26, name.length, true);
        output.set(name, cursor + LOCAL_HEADER_BYTES);
        output.set(entry.data, cursor + LOCAL_HEADER_BYTES + name.length);
        cursor += LOCAL_HEADER_BYTES + name.length + entry.data.length;
    });

    const centralStart = cursor;

    entries.forEach((entry, index) => {
        const name = names[index];

        view.setUint32(cursor, 0x02014b50, true);
        view.setUint16(cursor + 4, VERSION, true);
        view.setUint16(cursor + 6, VERSION, true);
        view.setUint16(cursor + 8, UTF8_FLAG, true);
        view.setUint16(cursor + 12, time, true);
        view.setUint16(cursor + 14, date, true);
        view.setUint32(cursor + 16, checksums[index], true);
        view.setUint32(cursor + 20, entry.data.length, true);
        view.setUint32(cursor + 24, entry.data.length, true);
        view.setUint16(cursor + 28, name.length, true);
        view.setUint32(cursor + 42, offsets[index], true);
        output.set(name, cursor + CENTRAL_ENTRY_BYTES);
        cursor += CENTRAL_ENTRY_BYTES + name.length;
    });

    view.setUint32(cursor, 0x06054b50, true);
    view.setUint16(cursor + 8, entries.length, true);
    view.setUint16(cursor + 10, entries.length, true);
    view.setUint32(cursor + 12, centralBytes, true);
    view.setUint32(cursor + 16, centralStart, true);

    return output;
}
