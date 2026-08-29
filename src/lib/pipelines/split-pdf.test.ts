import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { MAX_PDF_PAGES, MAX_PDF_PARTS } from '../image';
import { ProcessingError } from './core';
import { loadPdf, type PdfSource } from './pdf';
import { splitPdfPipeline, type SplitPdfParams } from './split-pdf';

async function source(pages: number, name = 'report.pdf'): Promise<PdfSource> {
    const document = await PDFDocument.create();

    for (let page = 0; page < pages; page += 1) document.addPage([100 + page, 200]);

    document.setTitle('Quarterly report');
    document.setAuthor('Someone');

    const buffer = Buffer.from(await document.save());
    const loaded = await loadPdf(buffer);

    return {
        document: loaded,
        buffer,
        name,
        baseName: name.replace(/\.pdf$/, ''),
        size: buffer.length,
        pageCount: loaded.getPageCount(),
    };
}

async function widthsOf(data: Uint8Array | Buffer): Promise<number[]> {
    const document = await PDFDocument.load(data);

    return document.getPages().map(page => Math.round(page.getWidth()));
}

function params(overrides: Partial<SplitPdfParams> = {}): SplitPdfParams {
    return { mode: 'separate', pages: [], ...overrides };
}

async function codeOf(run: Promise<unknown>): Promise<string> {
    return run.then(
        () => 'no error',
        (error: unknown) =>
            error instanceof ProcessingError ? error.code : 'not a ProcessingError'
    );
}

describe('splitting into separate files', () => {
    it('turns every page into its own single-page document', async () => {
        const produced = await splitPdfPipeline(await source(3), params());

        expect(produced).toHaveLength(3);
        expect(produced.map(output => output.filename)).toEqual([
            'report-page-1.pdf',
            'report-page-2.pdf',
            'report-page-3.pdf',
        ]);
        expect(await widthsOf(produced[0].data)).toEqual([100]);
        expect(await widthsOf(produced[2].data)).toEqual([102]);
    });

    it('only splits out the pages the range names', async () => {
        const produced = await splitPdfPipeline(
            await source(6),
            params({
                pages: [
                    { from: 2, to: 3 },
                    { from: 6, to: 6 },
                ],
            })
        );

        expect(produced.map(output => output.filename)).toEqual([
            'report-page-2.pdf',
            'report-page-3.pdf',
            'report-page-6.pdf',
        ]);
    });

    it('refuses to make more files than the result card can hand back', async () => {
        expect(await codeOf(splitPdfPipeline(await source(MAX_PDF_PARTS + 1), params()))).toBe(
            'too_many_parts'
        );
    });
});

describe('extracting into one file', () => {
    it('keeps the named pages, in the order they were named', async () => {
        const [output] = await splitPdfPipeline(
            await source(5),
            params({
                mode: 'merged',
                pages: [
                    { from: 4, to: 4 },
                    { from: 1, to: 2 },
                ],
            })
        );

        expect(output.filename).toBe('report-pages.pdf');
        expect(await widthsOf(output.data)).toEqual([103, 100, 101]);
    });

    it('leaves the original title and author behind', async () => {
        const [output] = await splitPdfPipeline(
            await source(3),
            params({ mode: 'merged', pages: [{ from: 1, to: 2 }] })
        );
        const rebuilt = await PDFDocument.load(output.data);

        expect(rebuilt.getTitle()).toBeUndefined();
        expect(rebuilt.getAuthor()).toBeUndefined();
    });

    it('caps the rebuilt document the way a merge is capped', async () => {
        const pages = MAX_PDF_PAGES + 1;

        expect(
            await codeOf(
                splitPdfPipeline(
                    await source(pages),
                    params({ mode: 'merged', pages: [{ from: 1, to: pages }] })
                )
            )
        ).toBe('too_many_pages');
    });

    it('rejects an empty selection, which would just hand back the upload', async () => {
        expect(await codeOf(splitPdfPipeline(await source(3), params({ mode: 'merged' })))).toBe(
            'no_pages_selected'
        );
    });
});

describe('a range the document cannot satisfy', () => {
    it('fails with the page count instead of silently clamping', async () => {
        expect(
            await codeOf(splitPdfPipeline(await source(3), params({ pages: [{ from: 2, to: 9 }] })))
        ).toBe('page_out_of_range');
    });

    it('takes the last page as the boundary, not the last range typed', async () => {
        expect(
            await codeOf(
                splitPdfPipeline(
                    await source(3),
                    params({
                        pages: [
                            { from: 9, to: 9 },
                            { from: 1, to: 1 },
                        ],
                    })
                )
            )
        ).toBe('page_out_of_range');
    });
});
