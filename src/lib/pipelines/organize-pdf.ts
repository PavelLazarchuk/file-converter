import { PDFName, type PDFPage } from 'pdf-lib';

import {
    PDF_MIME_TYPE,
    lastPageRequested,
    pagesInRanges,
    type PageRange,
    type PdfOrganizeMode,
} from '../image';
import { fail, type PipelineOutput } from './core';
import { savePdf, type PdfSource } from './pdf';

export type OrganizePdfParams = {
    mode: PdfOrganizeMode;
    pages: readonly PageRange[];
};

function reordered(selected: readonly number[], pageCount: number): number[] {
    const named = new Set(selected);
    const rest: number[] = [];

    for (let page = 1; page <= pageCount; page += 1) {
        if (!named.has(page)) rest.push(page);
    }

    return [...selected, ...rest];
}

const INHERITED = ['Resources', 'MediaBox', 'CropBox', 'Rotate'].map(name => PDFName.of(name));

function settleInherited(page: PDFPage): void {
    for (const name of INHERITED) {
        const value = page.node.getInheritableAttribute(name);

        if (value) page.node.set(name, value);
    }
}

export async function organizePdfPipeline(
    source: PdfSource,
    { mode, pages: ranges }: OrganizePdfParams
): Promise<PipelineOutput> {
    if (!ranges.length) throw fail({ code: 'no_pages_selected' });

    if (lastPageRequested(ranges) > source.pageCount) {
        throw fail({ code: 'page_out_of_range', pages: source.pageCount });
    }

    const selected = pagesInRanges(ranges, source.pageCount);
    const { document } = source;

    if (mode === 'remove') {
        if (selected.length >= source.pageCount) throw fail({ code: 'no_pages_left' });

        for (const page of [...selected].sort((a, b) => b - a)) document.removePage(page - 1);

        return {
            data: await savePdf(document),
            filename: `${source.baseName}-trimmed.pdf`,
            mimeType: PDF_MIME_TYPE,
        };
    }

    const pages = document.getPages();
    const order = reordered(selected, source.pageCount);

    for (const page of pages) settleInherited(page);

    for (let index = pages.length - 1; index >= 0; index -= 1) document.removePage(index);

    for (const page of order) document.addPage(pages[page - 1]);

    return {
        data: await savePdf(document),
        filename: `${source.baseName}-reordered.pdf`,
        mimeType: PDF_MIME_TYPE,
    };
}
