import { PDFDocument } from 'pdf-lib';

import {
    MAX_PDF_PAGES,
    MAX_PDF_PARTS,
    PDF_MIME_TYPE,
    lastPageRequested,
    pagesInRanges,
    type PageRange,
    type PdfSplitMode,
} from '../image';
import { fail, type PipelineOutput } from './core';
import { savePdf, type PdfSource } from './pdf';

export type SplitPdfParams = {
    mode: PdfSplitMode;
    pages: readonly PageRange[];
};

async function extract(source: PdfSource, pages: readonly number[]): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const copied = await document.copyPages(
        source.document,
        pages.map(page => page - 1)
    );

    for (const page of copied) document.addPage(page);

    return savePdf(document);
}

export async function splitPdfPipeline(
    source: PdfSource,
    { mode, pages: ranges }: SplitPdfParams
): Promise<PipelineOutput[]> {
    if (lastPageRequested(ranges) > source.pageCount) {
        throw fail({ code: 'page_out_of_range', pages: source.pageCount });
    }

    const pages = pagesInRanges(ranges, source.pageCount);

    if (!pages.length) throw fail({ code: 'no_pages_selected' });

    if (mode === 'merged') {
        if (!ranges.length) throw fail({ code: 'no_pages_selected' });

        if (pages.length > MAX_PDF_PAGES) {
            throw fail({ code: 'too_many_pages', pages: pages.length });
        }

        return [
            {
                data: await extract(source, pages),
                filename: `${source.baseName}-pages.pdf`,
                mimeType: PDF_MIME_TYPE,
            },
        ];
    }

    if (pages.length > MAX_PDF_PARTS) {
        throw fail({ code: 'too_many_parts', parts: pages.length });
    }

    const outputs: PipelineOutput[] = [];

    for (const page of pages) {
        outputs.push({
            data: await extract(source, [page]),
            filename: `${source.baseName}-page-${page}.pdf`,
            mimeType: PDF_MIME_TYPE,
        });
    }

    return outputs;
}
