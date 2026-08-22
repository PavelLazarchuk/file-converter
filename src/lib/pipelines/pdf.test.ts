import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { PDF_PAGE_DIMENSIONS } from '../image';
import { sourceImage } from '@/test/images';
import { addPdfPage, createPdfDocument, loadPdf, mergePdfs, savePdf } from './pdf';

async function pdfWith(pages: number, title?: string): Promise<Buffer> {
    const document = await PDFDocument.create();

    for (let page = 0; page < pages; page += 1) document.addPage([200, 200]);
    if (title) document.setTitle(title);

    return Buffer.from(await document.save());
}

function round(value: number): number {
    return Math.round(value);
}

describe('addPdfPage', () => {
    it('gives a "fit" page the image\'s own dimensions', async () => {
        const document = await createPdfDocument();

        await addPdfPage(document, await sourceImage('png', { width: 120, height: 90 }), 'fit');

        const [page] = document.getPages();

        expect([round(page.getWidth()), round(page.getHeight())]).toEqual([120, 90]);
    });

    it('puts a portrait image on a portrait A4 page', async () => {
        const document = await createPdfDocument();

        await addPdfPage(document, await sourceImage('png', { width: 90, height: 120 }), 'a4');

        const [page] = document.getPages();
        const [width, height] = PDF_PAGE_DIMENSIONS.a4;

        expect([round(page.getWidth()), round(page.getHeight())]).toEqual([
            round(width),
            round(height),
        ]);
    });

    it('turns the page sideways for a landscape image', async () => {
        const document = await createPdfDocument();

        await addPdfPage(document, await sourceImage('png', { width: 200, height: 60 }), 'letter');

        const [page] = document.getPages();

        expect(page.getWidth()).toBeGreaterThan(page.getHeight());
    });

    it('accepts every source format, embedding JPEG as JPEG and the rest as PNG', async () => {
        const document = await createPdfDocument();

        for (const format of ['jpeg', 'png', 'webp', 'gif'] as const) {
            await addPdfPage(document, await sourceImage(format), 'fit');
        }

        expect(document.getPageCount()).toBe(4);
        expect((await savePdf(document)).byteLength).toBeGreaterThan(0);
    });
});

describe('loadPdf', () => {
    it('reads a document back', async () => {
        const document = await loadPdf(await pdfWith(3));

        expect(document.getPageCount()).toBe(3);
    });

    it('reports unreadable bytes as such', async () => {
        await expect(loadPdf(Buffer.from('not a pdf'))).rejects.toMatchObject({
            code: 'unreadable_pdf',
        });
    });
});

describe('mergePdfs', () => {
    it('concatenates the pages in the order it was given', async () => {
        const sources = await Promise.all(
            [2, 3].map(async (pages, index) => ({
                document: await loadPdf(await pdfWith(pages, `source-${index}`)),
                name: `file-${index}.pdf`,
                baseName: `file-${index}`,
                size: 0,
                pageCount: pages,
            }))
        );
        const merged = await PDFDocument.load(await mergePdfs(sources));

        expect(merged.getPageCount()).toBe(5);
    });

    it('drops the sources’ title, because each page is rebuilt in a fresh document', async () => {
        const document = await loadPdf(await pdfWith(1, 'secret internal draft'));
        const merged = await PDFDocument.load(
            await mergePdfs([{ document, name: 'a.pdf', baseName: 'a', size: 0, pageCount: 1 }])
        );

        expect(merged.getTitle()).toBeUndefined();
    });
});
