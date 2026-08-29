import { PDFDocument, PDFName, PDFNumber, PDFPageTree } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { ProcessingError } from './core';
import { organizePdfPipeline, type OrganizePdfParams } from './organize-pdf';
import { loadPdf, type PdfSource } from './pdf';

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

async function nestedSource(): Promise<PdfSource> {
    const document = await PDFDocument.create();

    document.addPage([150, 200]);
    document.addPage([150, 200]);
    document.addPage([102, 200]);
    document.addPage([103, 200]);

    const flat = await PDFDocument.load(await document.save());
    const context = flat.context;
    const root = flat.catalog.Pages();
    const kids = root.Kids();
    const [first, second] = [kids.get(0), kids.get(1)];
    const branch = PDFPageTree.withContext(context);
    const branchRef = context.register(branch);

    branch.set(PDFName.of('Parent'), flat.catalog.get(PDFName.of('Pages'))!);
    branch.set(PDFName.of('Kids'), context.obj([first, second]));
    branch.set(PDFName.of('Count'), PDFNumber.of(2));
    branch.set(PDFName.of('MediaBox'), context.obj([0, 0, 150, 200]));

    for (const ref of [first, second]) {
        const leaf = context.lookup(ref) as ReturnType<typeof context.lookup> & {
            delete: (name: PDFName) => void;
            set: (name: PDFName, value: unknown) => void;
        };

        leaf.delete(PDFName.of('MediaBox'));
        leaf.set(PDFName.of('Parent'), branchRef);
    }

    kids.remove(1);
    kids.remove(0);
    kids.insert(0, branchRef);

    const buffer = Buffer.from(await flat.save());
    const loaded = await loadPdf(buffer);

    return {
        document: loaded,
        buffer,
        name: 'nested.pdf',
        baseName: 'nested',
        size: buffer.length,
        pageCount: loaded.getPageCount(),
    };
}

function params(overrides: Partial<OrganizePdfParams> = {}): OrganizePdfParams {
    return { mode: 'remove', pages: [], ...overrides };
}

async function codeOf(run: Promise<unknown>): Promise<string> {
    return run.then(
        () => 'no error',
        (error: unknown) =>
            error instanceof ProcessingError ? error.code : 'not a ProcessingError'
    );
}

describe('deleting pages', () => {
    it('drops the named pages and leaves the rest in order', async () => {
        const output = await organizePdfPipeline(
            await source(5),
            params({
                pages: [
                    { from: 2, to: 3 },
                    { from: 5, to: 5 },
                ],
            })
        );

        expect(output.filename).toBe('report-trimmed.pdf');
        expect(await widthsOf(output.data)).toEqual([100, 103]);
    });

    it('leaves an inherited page size alone on the pages that survive', async () => {
        const output = await organizePdfPipeline(
            await nestedSource(),
            params({ pages: [{ from: 2, to: 2 }] })
        );

        expect(await widthsOf(output.data)).toEqual([150, 102, 103]);
    });

    it('refuses to empty the document', async () => {
        expect(
            await codeOf(
                organizePdfPipeline(await source(3), params({ pages: [{ from: 1, to: 3 }] }))
            )
        ).toBe('no_pages_left');
    });
});

describe('reordering pages', () => {
    it('brings the named pages to the front and keeps the rest behind them', async () => {
        const output = await organizePdfPipeline(
            await source(5),
            params({
                mode: 'reorder',
                pages: [
                    { from: 4, to: 4 },
                    { from: 1, to: 1 },
                ],
            })
        );

        expect(output.filename).toBe('report-reordered.pdf');
        expect(await widthsOf(output.data)).toEqual([103, 100, 101, 102, 104]);
    });

    it('keeps a page that only inherited its size, which pruning the tree would strip', async () => {
        const output = await organizePdfPipeline(
            await nestedSource(),
            params({ mode: 'reorder', pages: [{ from: 4, to: 4 }] })
        );

        expect(await widthsOf(output.data)).toEqual([103, 150, 150, 102]);
    });

    it('keeps every page when the selection covers the whole document', async () => {
        const output = await organizePdfPipeline(
            await source(3),
            params({ mode: 'reorder', pages: [{ from: 3, to: 3 }] })
        );

        expect(await widthsOf(output.data)).toEqual([102, 100, 101]);
    });
});

describe('the document that comes back', () => {
    it('keeps the title and author, unlike a split', async () => {
        const output = await organizePdfPipeline(
            await source(4),
            params({ mode: 'reorder', pages: [{ from: 2, to: 2 }] })
        );
        const edited = await PDFDocument.load(output.data);

        expect(edited.getTitle()).toBe('Quarterly report');
        expect(edited.getAuthor()).toBe('Someone');
    });
});

describe('a selection the document cannot satisfy', () => {
    it('fails with the page count instead of silently clamping', async () => {
        expect(
            await codeOf(
                organizePdfPipeline(await source(3), params({ pages: [{ from: 2, to: 9 }] }))
            )
        ).toBe('page_out_of_range');
    });

    it('rejects an empty selection in both modes', async () => {
        expect(await codeOf(organizePdfPipeline(await source(3), params()))).toBe(
            'no_pages_selected'
        );
        expect(
            await codeOf(organizePdfPipeline(await source(3), params({ mode: 'reorder' })))
        ).toBe('no_pages_selected');
    });
});
