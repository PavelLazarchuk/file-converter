import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { loadPdf, type PdfSource } from './pdf';
import { compressPdfPipeline, type CompressPdfParams } from './compress-pdf';

async function photo(width: number, height: number, quality = 100): Promise<Buffer> {
    const channels = 3;
    const data = Buffer.alloc(width * height * channels);

    for (let index = 0; index < width * height; index += 1) {
        const offset = index * channels;
        const jitter = (index * 2654435761) % 256;

        data[offset] = jitter;
        data[offset + 1] = (jitter * 3) % 256;
        data[offset + 2] = (jitter * 7) % 256;
    }

    return sharp(data, { raw: { width, height, channels } }).jpeg({ quality }).toBuffer();
}

async function scan(
    options: { width?: number; height?: number; pages?: number; name?: string } = {}
): Promise<PdfSource> {
    const { width = 900, height = 600, pages = 1, name = 'scan.pdf' } = options;
    const document = await PDFDocument.create();
    const embedded = await document.embedJpg(await photo(width, height));

    document.setTitle('Signed contract');

    for (let index = 0; index < pages; index += 1) {
        const page = document.addPage([width, height]);

        page.drawImage(embedded, { x: 0, y: 0, width, height });
    }

    const buffer = Buffer.from(await document.save());

    return {
        document: await loadPdf(buffer),
        buffer,
        name,
        baseName: name.replace(/\.pdf$/, ''),
        size: buffer.length,
        pageCount: pages,
    };
}

function params(overrides: Partial<CompressPdfParams> = {}): CompressPdfParams {
    return { level: 'balanced', ...overrides };
}

async function imageSizes(data: Uint8Array | Buffer): Promise<{ width: number; height: number }[]> {
    const document = await PDFDocument.load(data);
    const sizes: { width: number; height: number }[] = [];

    for (const [, object] of document.context.enumerateIndirectObjects()) {
        if (!(object instanceof PDFRawStream)) continue;

        const subtype = object.dict.lookup(PDFName.of('Subtype'));

        if (!(subtype instanceof PDFName) || subtype.asString() !== '/Image') continue;

        sizes.push({
            width: Number(object.dict.get(PDFName.of('Width'))?.toString()),
            height: Number(object.dict.get(PDFName.of('Height'))?.toString()),
        });
    }

    return sizes;
}

describe('compressPdfPipeline', () => {
    it('shrinks a scan and keeps its page count and title', async () => {
        const source = await scan({ pages: 2 });
        const output = await compressPdfPipeline(source, params());
        const document = await PDFDocument.load(output.data);

        expect(Buffer.from(output.data).length).toBeLessThan(source.size);
        expect(document.getPageCount()).toBe(2);
        expect(document.getTitle()).toBe('Signed contract');
        expect(output.filename).toBe('scan-compressed.pdf');
        expect(output.warning).toBeUndefined();
    });

    it('squeezes harder at the stronger level', async () => {
        const light = await compressPdfPipeline(await scan(), params({ level: 'light' }));
        const strong = await compressPdfPipeline(await scan(), params({ level: 'strong' }));

        expect(Buffer.from(strong.data).length).toBeLessThan(Buffer.from(light.data).length);
    });

    it('caps the image width at the level that asks for it', async () => {
        const source = await scan({ width: 3000, height: 2000 });
        const output = await compressPdfPipeline(source, params({ level: 'strong' }));
        const [image] = await imageSizes(output.data);

        expect(image.width).toBe(1200);
        expect(image.height).toBe(800);
    });

    it('hands back the original with a warning when nothing shrinks', async () => {
        const document = await PDFDocument.create();

        document.addPage([200, 200]).drawText('text only');

        const buffer = Buffer.from(await document.save());
        const source: PdfSource = {
            document: await loadPdf(buffer),
            buffer,
            name: 'memo.pdf',
            baseName: 'memo',
            size: buffer.length,
            pageCount: 1,
        };
        const output = await compressPdfPipeline(source, params({ level: 'strong' }));

        expect(output.warning).toEqual({ code: 'pdf_not_smaller' });
        expect(Buffer.from(output.data)).toEqual(buffer);
    });
});
