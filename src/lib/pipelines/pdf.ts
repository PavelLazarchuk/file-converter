import { EncryptedPDFError, PDFDocument, type PDFImage } from 'pdf-lib';

import { PDF_PAGE_DIMENSIONS, PDF_PAGE_MARGIN, type PdfPageSize } from '../image';
import { decode, fail, type SourceImage } from './core';

export function createPdfDocument(): Promise<PDFDocument> {
    return PDFDocument.create();
}

async function embedPdfImage(pdfDoc: PDFDocument, source: SourceImage): Promise<PDFImage> {
    const isJpeg = source.format === 'jpeg';
    const imageBytes = await decode(source.buffer)
        .toFormat(isJpeg ? 'jpeg' : 'png', isJpeg ? { quality: 90 } : undefined)
        .toBuffer();

    return isJpeg ? pdfDoc.embedJpg(imageBytes) : pdfDoc.embedPng(imageBytes);
}

function drawPdfPage(pdfDoc: PDFDocument, embedded: PDFImage, pageSize: PdfPageSize): void {
    const { width: imgWidth, height: imgHeight } = embedded;

    if (pageSize === 'fit') {
        const page = pdfDoc.addPage([imgWidth, imgHeight]);

        page.drawImage(embedded, { x: 0, y: 0, width: imgWidth, height: imgHeight });

        return;
    }

    const [portraitWidth, portraitHeight] = PDF_PAGE_DIMENSIONS[pageSize];
    const landscape = imgWidth > imgHeight;
    const pageWidth = landscape ? portraitHeight : portraitWidth;
    const pageHeight = landscape ? portraitWidth : portraitHeight;
    const scale = Math.min(
        (pageWidth - PDF_PAGE_MARGIN * 2) / imgWidth,
        (pageHeight - PDF_PAGE_MARGIN * 2) / imgHeight
    );
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    page.drawImage(embedded, {
        x: (pageWidth - drawWidth) / 2,
        y: (pageHeight - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight,
    });
}

export async function addPdfPage(
    pdfDoc: PDFDocument,
    source: SourceImage,
    pageSize: PdfPageSize
): Promise<void> {
    drawPdfPage(pdfDoc, await embedPdfImage(pdfDoc, source), pageSize);
}

export function savePdf(pdfDoc: PDFDocument): Promise<Uint8Array> {
    return pdfDoc.save();
}

export type PdfSource = {
    document: PDFDocument;
    name: string;
    baseName: string;
    size: number;
    pageCount: number;
};

export async function loadPdf(buffer: Buffer): Promise<PDFDocument> {
    try {
        return await PDFDocument.load(buffer);
    } catch (error) {
        throw error instanceof EncryptedPDFError
            ? fail({ code: 'encrypted_pdf' })
            : fail({ code: 'unreadable_pdf' });
    }
}

export async function mergePdfs(sources: readonly PdfSource[]): Promise<Uint8Array> {
    const merged = await PDFDocument.create();

    for (const source of sources) {
        const pages = await merged.copyPages(source.document, source.document.getPageIndices());

        for (const page of pages) merged.addPage(page);
    }

    return savePdf(merged);
}
