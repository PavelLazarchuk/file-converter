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

function crc32(data: Buffer): number {
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

export type ZipEntry = { name: string; data: Buffer };

export function createZip(entries: ZipEntry[], now = new Date()): Buffer {
    const { time, date } = dosDateTime(now);
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const checksum = crc32(entry.data);
        const local = Buffer.alloc(LOCAL_HEADER_BYTES);

        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(VERSION, 4);
        local.writeUInt16LE(UTF8_FLAG, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(entry.data.length, 18);
        local.writeUInt32LE(entry.data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);

        const central = Buffer.alloc(CENTRAL_ENTRY_BYTES);

        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(VERSION, 4);
        central.writeUInt16LE(VERSION, 6);
        central.writeUInt16LE(UTF8_FLAG, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(time, 12);
        central.writeUInt16LE(date, 14);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(entry.data.length, 20);
        central.writeUInt32LE(entry.data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);

        locals.push(local, name, entry.data);
        centrals.push(central, name);
        offset += LOCAL_HEADER_BYTES + name.length + entry.data.length;
    }

    const centralDirectory = Buffer.concat(centrals);
    const end = Buffer.alloc(END_RECORD_BYTES);

    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...locals, centralDirectory, end]);
}
