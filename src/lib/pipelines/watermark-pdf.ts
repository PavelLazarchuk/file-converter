import {
    StandardFonts,
    degrees,
    popGraphicsState,
    pushGraphicsState,
    rgb,
    setGraphicsState,
    type PDFFont,
    type PDFPage,
} from 'pdf-lib';

import {
    MAX_PDF_WATERMARK_TILES,
    PDF_MIME_TYPE,
    hexToRgb,
    rotatedBounds,
    watermarkOffset,
    watermarkTextLayout,
    type Size,
    type WatermarkPosition,
} from '../image';
import type { WatermarkPdfValues } from '../schemas';
import { fail, type PipelineOutput } from './core';
import { savePdf, type PdfSource } from './pdf';

export type WatermarkPdfParams = WatermarkPdfValues;

type Point = { x: number; y: number };

function screenSize(media: Size, rotation: number): Size {
    return rotation % 180 === 0 ? media : { width: media.height, height: media.width };
}

function toPageSpace(media: Size, rotation: number, screen: Point): Point {
    switch (rotation) {
        case 90:
            return { x: screen.y, y: screen.x };
        case 180:
            return { x: media.width - screen.x, y: screen.y };
        case 270:
            return { x: media.width - screen.y, y: media.height - screen.x };
        default:
            return { x: screen.x, y: media.height - screen.y };
    }
}

function tileCenters(page: Size, cell: Size, gap: number): Point[] {
    let stepX = Math.max(1, cell.width + gap);
    let stepY = Math.max(1, cell.height + gap);
    let columns = Math.ceil(page.width / stepX);
    let rows = Math.ceil(page.height / stepY);

    while (columns * rows > MAX_PDF_WATERMARK_TILES) {
        const factor = Math.sqrt((columns * rows) / MAX_PDF_WATERMARK_TILES);

        stepX *= factor;
        stepY *= factor;
        columns = Math.ceil(page.width / stepX);
        rows = Math.ceil(page.height / stepY);
    }

    const centers: Point[] = [];

    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            centers.push({ x: (column + 0.5) * stepX, y: (row + 0.5) * stepY });
        }
    }

    return centers;
}

function singleCenter(
    page: Size,
    bounds: Size,
    position: WatermarkPosition,
    margin: number
): Point {
    const { left, top } = watermarkOffset(position, page, bounds, margin);

    return { x: left + bounds.width / 2, y: top + bounds.height / 2 };
}

function measure(font: PDFFont, text: string, fontSize: number): Size {
    return {
        width: font.widthOfTextAtSize(text, fontSize),
        height: font.heightAtSize(fontSize, { descender: false }),
    };
}

function fadeOnce(page: PDFPage, opacity: number): boolean {
    if (opacity >= 100) return false;

    const state = page.doc.context.obj({ Type: 'ExtGState', ca: opacity / 100 });

    page.pushOperators(pushGraphicsState(), setGraphicsState(page.node.newExtGState('GS', state)));

    return true;
}

function stampPage(page: PDFPage, font: PDFFont, params: WatermarkPdfParams): void {
    const { text, color, position, opacity, scale, margin, angle, layout } = params;
    const mediaBox = page.getMediaBox();
    const media = { width: mediaBox.width, height: mediaBox.height };
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const screen = screenSize(media, rotation);
    const { fontSize } = watermarkTextLayout(screen, scale, text);
    const box = measure(font, text, fontSize);
    const bounds = rotatedBounds(box, angle);
    const centers =
        layout === 'tile'
            ? tileCenters(screen, bounds, margin)
            : [singleCenter(screen, bounds, position, margin)];
    const drawn = degrees(rotation - angle);
    const radians = ((rotation - angle) * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const offsetX = -box.width / 2;
    const offsetY = -box.height / 2;
    const { r, g, b } = hexToRgb(color);
    const faded = fadeOnce(page, opacity);

    for (const center of centers) {
        const anchor = toPageSpace(media, rotation, center);

        page.drawText(text, {
            x: mediaBox.x + anchor.x + offsetX * cos - offsetY * sin,
            y: mediaBox.y + anchor.y + offsetX * sin + offsetY * cos,
            size: fontSize,
            font,
            color: rgb(r / 255, g / 255, b / 255),
            rotate: drawn,
        });
    }

    if (faded) page.pushOperators(popGraphicsState());
}

export async function watermarkPdfPipeline(
    source: PdfSource,
    params: WatermarkPdfParams
): Promise<PipelineOutput> {
    const font = await source.document.embedFont(StandardFonts.HelveticaBold);

    try {
        font.widthOfTextAtSize(params.text, 12);
    } catch {
        throw fail({ code: 'unsupported_text' });
    }

    for (const page of source.document.getPages()) stampPage(page, font, params);

    return {
        data: await savePdf(source.document),
        filename: `${source.baseName}-watermarked.pdf`,
        mimeType: PDF_MIME_TYPE,
    };
}
