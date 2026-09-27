import type { PDFDocumentProxy } from 'pdfjs-dist';

import type { ActionFile } from './actions';
import { browserTool, yieldToBrowser } from './browser-tool';
import { fail, type ActionWarningDetail } from './errors';
import {
    IMAGE_FORMATS,
    MAX_PDF_PARTS,
    lastPageRequested,
    pageImageName,
    pageRenderSize,
    pagesInRanges,
    stripExtension,
    type BrowserOutput,
} from './image';
import { encodeImage, once } from './local-codec';
import { Logger } from './logger';
import { pdfToImagesSchema } from './schemas';

export const PDFJS_PATH = '/pdfjs';

type PdfJs = typeof import('pdfjs-dist');

async function engine(): Promise<PdfJs> {
    try {
        return await once('pdfjs', async () => {
            const pdfjs = await import('pdfjs-dist');

            pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_PATH}/pdf.worker.min.mjs`;

            return pdfjs;
        });
    } catch (error) {
        Logger.error('pdf_render.engine_failed', { error });

        throw fail({ code: 'engine_failed' });
    }
}

async function openDocument(pdfjs: PdfJs, data: Uint8Array): Promise<PDFDocumentProxy> {
    const task = pdfjs.getDocument({
        data,
        cMapUrl: `${PDFJS_PATH}/cmaps/`,
        standardFontDataUrl: `${PDFJS_PATH}/standard_fonts/`,
        wasmUrl: `${PDFJS_PATH}/wasm/`,
        iccUrl: `${PDFJS_PATH}/iccs/`,
    });

    try {
        return await task.promise;
    } catch (error) {
        await task.destroy();

        if (error instanceof Error && error.name === 'PasswordException') {
            throw fail({ code: 'encrypted_pdf' });
        }

        throw fail({ code: 'unreadable_pdf' });
    }
}

type RenderedPage = { data: Uint8Array; warning?: ActionWarningDetail };

async function renderPage(
    pdf: PDFDocumentProxy,
    pageNumber: number,
    dpi: number,
    format: BrowserOutput,
    quality: number
): Promise<RenderedPage> {
    const page = await pdf.getPage(pageNumber);
    const canvas = document.createElement('canvas');

    try {
        const natural = page.getViewport({ scale: 1 });
        const size = pageRenderSize({ width: natural.width, height: natural.height }, dpi);
        const viewport = page.getViewport({ scale: size.scale });

        canvas.width = size.width;
        canvas.height = size.height;

        await page.render({ canvas, viewport, background: '#ffffff' }).promise;

        const context = canvas.getContext('2d');

        if (!context) throw fail({ code: 'engine_failed' });

        const pixels = context.getImageData(0, 0, size.width, size.height);
        const data = await encodeImage(pixels, format, quality);

        return size.dpi < dpi
            ? { data, warning: { code: 'page_downscaled', requested: dpi, dpi: size.dpi } }
            : { data };
    } finally {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
    }
}

export const pdfToImages = browserTool(
    pdfToImagesSchema,
    async ({ file }, { format, dpi, quality, pages: ranges }, progress) => {
        const pdfjs = await engine();
        const pdf = await openDocument(pdfjs, new Uint8Array(await file.arrayBuffer()));

        try {
            if (lastPageRequested(ranges) > pdf.numPages) {
                throw fail({ code: 'page_out_of_range', pages: pdf.numPages });
            }

            const pages = pagesInRanges(ranges, pdf.numPages);

            if (pages.length > MAX_PDF_PARTS) {
                throw fail({ code: 'too_many_parts', parts: pages.length });
            }

            const baseName = stripExtension(file.name) || 'document';
            const files: ActionFile[] = [];

            progress(0, pages.length);

            for (const [index, pageNumber] of pages.entries()) {
                await yieldToBrowser();

                const { data, warning } = await renderPage(pdf, pageNumber, dpi, format, quality);

                files.push({
                    data,
                    filename: pageImageName(baseName, pageNumber, format),
                    mimeType: IMAGE_FORMATS[format].mimeType,
                    originalSize: file.size,
                    ...(warning ? { warning } : {}),
                });
                progress(index + 1, pages.length);
            }

            return files;
        } finally {
            await pdf.loadingTask.destroy();
        }
    }
);
