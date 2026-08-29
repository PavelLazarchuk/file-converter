import { PDFDocument, degrees } from 'pdf-lib';

import { loadPdf, type PdfSource } from '@/lib/pipelines/pdf';

export type PdfFixture = {
    name?: string;
    pages?: number;
    size?: [number, number];
    rotation?: number;
    title?: string;
};

export async function pdfBuffer({
    pages = 1,
    size = [200, 300],
    rotation = 0,
    title,
}: PdfFixture = {}): Promise<Buffer> {
    const document = await PDFDocument.create();

    for (let index = 0; index < pages; index += 1) {
        const page = document.addPage([size[0], size[1]]);

        if (rotation) page.setRotation(degrees(rotation));
    }

    if (title) document.setTitle(title);

    return Buffer.from(await document.save());
}

export async function pdfSource(options: PdfFixture = {}): Promise<PdfSource> {
    const name = options.name ?? 'report.pdf';
    const buffer = await pdfBuffer(options);
    const document = await loadPdf(buffer);

    return {
        document,
        buffer,
        name,
        baseName: name.replace(/\.pdf$/, ''),
        size: buffer.length,
        pageCount: document.getPageCount(),
    };
}
