const HEADER_BYTES = 6;
const DIRECTORY_ENTRY_BYTES = 16;

export function encodeIco(entries: { size: number; data: Buffer }[]): Buffer {
    const header = Buffer.alloc(HEADER_BYTES);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(entries.length, 4);

    const directory: Buffer[] = [];
    let offset = HEADER_BYTES + DIRECTORY_ENTRY_BYTES * entries.length;
    for (const { size, data } of entries) {
        const entry = Buffer.alloc(DIRECTORY_ENTRY_BYTES);

        entry.writeUInt8(size >= 256 ? 0 : size, 0);
        entry.writeUInt8(size >= 256 ? 0 : size, 1);
        entry.writeUInt16LE(1, 4);
        entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(data.length, 8);
        entry.writeUInt32LE(offset, 12);
        directory.push(entry);
        offset += data.length;
    }

    return Buffer.concat([header, ...directory, ...entries.map(entry => entry.data)]);
}
