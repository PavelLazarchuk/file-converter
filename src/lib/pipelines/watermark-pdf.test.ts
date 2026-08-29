import {
    PDFArray,
    PDFDict,
    PDFDocument,
    PDFName,
    PDFRawStream,
    StandardFonts,
    decodePDFRawStream,
} from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { pdfSource } from '@/test/pdfs';
import { MAX_PDF_WATERMARK_TILES, type Size } from '../image';
import { ProcessingError } from './core';
import { watermarkPdfPipeline, type WatermarkPdfParams } from './watermark-pdf';

function params(overrides: Partial<WatermarkPdfParams> = {}): WatermarkPdfParams {
    return {
        text: 'CONFIDENTIAL',
        color: '#ff0000',
        position: 'center',
        opacity: 50,
        scale: 40,
        margin: 24,
        layout: 'single',
        angle: 0,
        ...overrides,
    };
}

async function textRuns(data: Uint8Array | Buffer, text = 'CONFIDENTIAL'): Promise<number> {
    const document = await PDFDocument.load(data);
    const hex = Buffer.from(text, 'latin1').toString('hex').toUpperCase();
    const pattern = new RegExp(`<${hex}>\\s*Tj`, 'g');
    let count = 0;

    for (const page of document.getPages()) {
        const { context } = page.node;
        const contents = context.lookup(page.node.get(PDFName.of('Contents')));
        const streams =
            contents instanceof PDFArray
                ? contents.asArray().map(ref => context.lookup(ref))
                : [contents];

        for (const stream of streams) {
            if (!(stream instanceof PDFRawStream)) continue;

            const source = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');

            count += source.match(pattern)?.length ?? 0;
        }
    }

    return count;
}

async function anchors(data: Uint8Array | Buffer): Promise<{ x: number; y: number }[]> {
    const document = await PDFDocument.load(data);
    const found: { x: number; y: number }[] = [];

    for (const page of document.getPages()) {
        const { context } = page.node;
        const contents = context.lookup(page.node.get(PDFName.of('Contents')));
        const streams =
            contents instanceof PDFArray
                ? contents.asArray().map(ref => context.lookup(ref))
                : [contents];

        for (const stream of streams) {
            if (!(stream instanceof PDFRawStream)) continue;

            const source = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');

            for (const match of source.matchAll(/([\d.-]+) ([\d.-]+) Tm/g)) {
                found.push({ x: Number(match[1]), y: Number(match[2]) });
            }
        }
    }

    return found;
}

function onScreen(anchor: { x: number; y: number }, media: Size, rotation: number) {
    switch (rotation) {
        case 90:
            return { x: anchor.y, y: anchor.x };
        case 180:
            return { x: media.width - anchor.x, y: anchor.y };
        case 270:
            return { x: media.height - anchor.y, y: media.width - anchor.x };
        default:
            return { x: anchor.x, y: media.height - anchor.y };
    }
}

async function graphicsStates(data: Uint8Array | Buffer): Promise<number[]> {
    const document = await PDFDocument.load(data);

    return document.getPages().map(page => {
        const resources = page.node.Resources();
        const states = resources?.lookupMaybe(PDFName.of('ExtGState'), PDFDict);

        return states ? states.keys().length : 0;
    });
}

describe('watermarkPdfPipeline', () => {
    it('stamps every page and keeps the document title', async () => {
        const source = await pdfSource({ pages: 3, title: 'Quarterly report' });
        const output = await watermarkPdfPipeline(source, params());
        const document = await PDFDocument.load(output.data);

        expect(document.getPageCount()).toBe(3);
        expect(document.getTitle()).toBe('Quarterly report');
        expect(output.filename).toBe('report-watermarked.pdf');
        expect(output.mimeType).toBe('application/pdf');
    });

    it('draws the text once per page for a single stamp', async () => {
        const source = await pdfSource({ pages: 2 });
        const output = await watermarkPdfPipeline(source, params());

        expect(await textRuns(output.data)).toBe(2);
    });

    it('repeats the stamp across the page when tiling', async () => {
        const source = await pdfSource({ pages: 1, size: [600, 800] });
        const output = await watermarkPdfPipeline(source, params({ layout: 'tile' }));

        expect(await textRuns(output.data)).toBeGreaterThan(1);
    });

    it('caps how many tiles a single page can carry', async () => {
        const source = await pdfSource({ pages: 1, size: [600, 800] });
        const output = await watermarkPdfPipeline(
            source,
            params({ layout: 'tile', scale: 1, margin: 0 })
        );

        expect(await textRuns(output.data)).toBeLessThanOrEqual(MAX_PDF_WATERMARK_TILES);
    });

    it('rejects text the standard fonts cannot draw instead of throwing raw', async () => {
        const source = await pdfSource();
        const failure = await watermarkPdfPipeline(source, params({ text: 'Секретно' })).catch(
            (error: unknown) => error
        );

        expect(failure).toBeInstanceOf(ProcessingError);
        expect((failure as ProcessingError).code).toBe('unsupported_text');
    });

    it('keeps the stamp inside a page that carries a rotation', async () => {
        const source = await pdfSource({ pages: 1, size: [400, 600], rotation: 90 });
        const output = await watermarkPdfPipeline(source, params({ position: 'top-left' }));
        const document = await PDFDocument.load(output.data);
        const [page] = document.getPages();

        expect(page.getRotation().angle).toBe(90);
        expect(await textRuns(output.data)).toBe(1);
    });

    it('sizes the text against the page it is drawn on', async () => {
        const font = await (await PDFDocument.create()).embedFont(StandardFonts.HelveticaBold);
        const narrow = await watermarkPdfPipeline(await pdfSource({ size: [200, 300] }), params());
        const wide = await watermarkPdfPipeline(await pdfSource({ size: [800, 1200] }), params());

        expect(font.widthOfTextAtSize('CONFIDENTIAL', 12)).toBeGreaterThan(0);
        expect(Buffer.from(wide.data).length).toBeGreaterThan(0);
        expect(Buffer.from(narrow.data).length).toBeGreaterThan(0);
    });
    it.each([0, 90, 180, 270])(
        'anchors a top-left stamp at the top-left of a page rotated %i°',
        async rotation => {
            const source = await pdfSource({ size: [400, 600], rotation });
            const output = await watermarkPdfPipeline(
                source,
                params({ position: 'top-left', margin: 0, angle: 0, opacity: 100 })
            );
            const media: Size = { width: 400, height: 600 };
            const [anchor] = await anchors(output.data);
            const screen = onScreen(anchor, media, rotation);
            const visible = rotation % 180 === 0 ? media : { width: 600, height: 400 };

            expect(screen.x).toBeGreaterThan(-2);
            expect(screen.x).toBeLessThan(visible.width / 2);
            expect(screen.y).toBeGreaterThan(-2);
            expect(screen.y).toBeLessThan(visible.height / 2);
        }
    );

    it('shifts the stamp with a media box that does not start at the origin', async () => {
        const source = await pdfSource({ size: [400, 600] });

        source.document.getPage(0).setMediaBox(100, 50, 400, 600);

        const output = await watermarkPdfPipeline(
            source,
            params({ position: 'top-left', margin: 0, angle: 0, opacity: 100 })
        );
        const [anchor] = await anchors(output.data);

        expect(anchor.x).toBeGreaterThanOrEqual(100);
        expect(anchor.y).toBeGreaterThan(50);
    });

    it('sets the opacity once per page instead of once per tile', async () => {
        const source = await pdfSource({ pages: 2, size: [600, 800] });
        const output = await watermarkPdfPipeline(source, params({ layout: 'tile' }));

        expect(await textRuns(output.data)).toBeGreaterThan(2);
        expect(await graphicsStates(output.data)).toEqual([1, 1]);
    });

    it('writes no graphics state at all for a fully opaque stamp', async () => {
        const source = await pdfSource();
        const output = await watermarkPdfPipeline(source, params({ opacity: 100 }));

        expect(await graphicsStates(output.data)).toEqual([0]);
    });
});
