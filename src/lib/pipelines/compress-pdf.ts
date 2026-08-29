import { PDFDict, PDFName, PDFRawStream, type PDFDocument, type PDFRef } from 'pdf-lib';
import sharp from 'sharp';

import {
    MAX_INPUT_PIXELS,
    MIN_RECOMPRESSED_IMAGE_BYTES,
    PDF_COMPRESS_LEVELS,
    PDF_MIME_TYPE,
} from '../image';
import { Logger } from '../logger';
import type { CompressPdfValues } from '../schemas';
import type { PipelineOutput } from './core';
import { savePdf, type PdfSource } from './pdf';

export type CompressPdfParams = CompressPdfValues;

type JpegStream = { ref: PDFRef; stream: PDFRawStream; dict: PDFDict };

function nameOf(dict: PDFDict, key: string): string | null {
    const value = dict.lookup(PDFName.of(key));

    return value instanceof PDFName ? value.asString() : null;
}

function jpegStreams(document: PDFDocument): JpegStream[] {
    const found: JpegStream[] = [];

    for (const [ref, object] of document.context.enumerateIndirectObjects()) {
        if (!(object instanceof PDFRawStream)) continue;

        const { dict } = object;

        if (nameOf(dict, 'Subtype') !== '/Image') continue;
        if (nameOf(dict, 'Filter') !== '/DCTDecode') continue;
        if (dict.has(PDFName.of('DecodeParms'))) continue;
        if (dict.has(PDFName.of('Decode'))) continue;
        if (object.contents.length < MIN_RECOMPRESSED_IMAGE_BYTES) continue;

        found.push({ ref, stream: object, dict });
    }

    return found;
}

async function recompress(
    bytes: Uint8Array,
    { quality, maxWidth }: { quality: number; maxWidth: number | null }
): Promise<{ data: Buffer; width: number; height: number; channels: number } | null> {
    const source = sharp(Buffer.from(bytes), { limitInputPixels: MAX_INPUT_PIXELS });
    const metadata = await source.metadata();

    if (metadata.space === 'cmyk' || !metadata.width || !metadata.height) return null;

    const shrink = maxWidth !== null && metadata.width > maxWidth;
    const pipeline = shrink ? source.resize({ width: maxWidth }) : source;
    const { data, info } = await pipeline
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

    if (info.channels !== 1 && info.channels !== 3) return null;

    if (data.length >= bytes.length) return null;

    return { data, width: info.width, height: info.height, channels: info.channels };
}

async function shrinkImages(document: PDFDocument, params: CompressPdfParams): Promise<number> {
    const level = PDF_COMPRESS_LEVELS[params.level];
    let replaced = 0;

    for (const { ref, stream, dict } of jpegStreams(document)) {
        const smaller = await recompress(stream.contents, level).catch(() => null);

        if (!smaller) continue;

        dict.set(PDFName.of('Width'), document.context.obj(smaller.width));
        dict.set(PDFName.of('Height'), document.context.obj(smaller.height));
        dict.set(PDFName.of('BitsPerComponent'), document.context.obj(8));
        dict.set(
            PDFName.of('ColorSpace'),
            PDFName.of(smaller.channels === 1 ? 'DeviceGray' : 'DeviceRGB')
        );
        dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        dict.set(PDFName.of('Length'), document.context.obj(smaller.data.length));
        document.context.assign(ref, PDFRawStream.of(dict, new Uint8Array(smaller.data)));
        replaced += 1;
    }

    return replaced;
}

export async function compressPdfPipeline(
    source: PdfSource,
    params: CompressPdfParams
): Promise<PipelineOutput> {
    const replaced = await shrinkImages(source.document, params);
    const data = await savePdf(source.document);
    const filename = `${source.baseName}-compressed.pdf`;

    Logger.info('pdf.compressed', {
        tool: 'compress-pdf',
        level: params.level,
        pages: source.pageCount,
        images: replaced,
        bytes: data.length,
        originalBytes: source.size,
    });

    if (data.length >= source.size) {
        return {
            data: source.buffer,
            filename,
            mimeType: PDF_MIME_TYPE,
            warning: { code: 'pdf_not_smaller' },
        };
    }

    return { data, filename, mimeType: PDF_MIME_TYPE };
}
