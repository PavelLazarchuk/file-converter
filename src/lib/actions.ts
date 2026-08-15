'use server';

import type { Metadata } from 'sharp';

import type { ActionErrorCode, ActionErrorDetail } from './errors';
import { actionErrorMessage } from './errors';
import {
    COMPARE_FORMAT_KEYS,
    CONVERT_SOURCE_KEYS,
    DEFAULT_ICO_SIZES,
    DEFAULT_QUALITY,
    DEFAULT_TARGET_KB,
    FORMAT_KEYS,
    IMAGE_FORMATS,
    MAX_BATCH_BYTES,
    MAX_BATCH_FILES,
    MAX_FILE_SIZE,
    MAX_PDF_PAGES,
    PDF_MIME_TYPE,
    WATERMARK_DEFAULTS,
    acceptedFormatsLabel,
    convertSourceFromSharpFormat,
    stripExtension,
    uniqueFilenames,
    type ConvertSource,
} from './image';
import { Logger, type LogContext } from './logger';
import {
    addPdfPage,
    createPdfDocument,
    loadPdf,
    mergePdfs,
    savePdf,
    type PdfSource,
} from './pipelines/pdf';
import { comparePipeline } from './pipelines/compare';
import { compressPipeline } from './pipelines/compress';
import { convertPipeline } from './pipelines/convert';
import {
    ProcessingError,
    decode,
    fail,
    invalid,
    sourceSize,
    type PipelineOutput,
    type SourceImage,
} from './pipelines/core';
import { cropPipeline } from './pipelines/crop';
import { inspectPipeline, stripPipeline } from './pipelines/inspect';
import { placeholderPipeline } from './pipelines/placeholder';
import { resizePipeline } from './pipelines/resize';
import { rotatePipeline } from './pipelines/rotate';
import { watermarkPipeline, type WatermarkLogo } from './pipelines/watermark';
import { RATE_LIMIT, checkRateLimit } from './rate-limit';
import { inspectSvg } from './svg-safety';
import {
    compareSchema,
    compressSchema,
    convertSchema,
    cropSchema,
    icoOptionsSchema,
    imageToPdfSchema,
    outputSizeSchema,
    placeholderSchema,
    resizeSchema,
    rotateSchema,
    watermarkSchema,
} from './schemas';

export type ActionFile = {
    data: Uint8Array;
    filename: string;
    mimeType: string;
    originalSize: number;
    warning?: string;
};

export type ActionFailure = { filename: string; code: ActionErrorCode; error: string };

export type ActionResult =
    | { success: true; files: ActionFile[]; failures?: ActionFailure[] }
    | { success: false; code: ActionErrorCode; error: string };

type ToolName =
    | 'resize'
    | 'crop'
    | 'compress'
    | 'compare'
    | 'convert'
    | 'pdf'
    | 'merge-pdf'
    | 'placeholder'
    | 'rotate'
    | 'watermark'
    | 'inspect'
    | 'strip';

async function inspectMetadata(buffer: Buffer): Promise<Metadata | null> {
    try {
        return await decode(buffer).metadata();
    } catch (error) {
        if (error instanceof Error && error.message.includes('pixel limit')) throw error;

        return null;
    }
}

async function readSource<Format extends ConvertSource>(
    file: File,
    formats: readonly Format[]
): Promise<SourceImage<Format>> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const threat = inspectSvg(buffer);

    if (threat) throw fail({ code: 'unsafe_svg', threat });

    const metadata = await inspectMetadata(buffer);
    const accepted = acceptedFormatsLabel(formats);

    if (!metadata) throw fail({ code: 'unreadable_image', formats: accepted });

    const detected = convertSourceFromSharpFormat(metadata.format);
    const format = formats.find(key => key === detected);

    if (!format) {
        throw fail({
            code: 'unsupported_format',
            formats: accepted,
            detected: detected ? IMAGE_FORMATS[detected].label : null,
        });
    }

    return {
        buffer,
        format,
        name: file.name,
        baseName: stripExtension(file.name) || 'image',
        size: file.size,
        metadata,
    };
}

type SourceBatch<Format extends ConvertSource> = {
    tool: ToolName;
    sources: SourceImage<Format>[];
    failures: ActionFailure[];
};

async function readImageFiles<Format extends ConvertSource>(
    tool: ToolName,
    formData: FormData,
    formats: readonly Format[]
): Promise<SourceBatch<Format>> {
    const files = formData
        .getAll('file')
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!files.length) throw fail({ code: 'no_file' });

    if (files.length > MAX_BATCH_FILES) throw fail({ code: 'too_many_files' });

    const sources: SourceImage<Format>[] = [];
    const failures: ActionFailure[] = [];
    const usable = files.filter(file => {
        if (file.size <= MAX_FILE_SIZE) return true;

        failures.push({
            filename: file.name,
            code: 'file_too_large',
            error: actionErrorMessage({ code: 'file_too_large' }),
        });

        return false;
    });
    const totalBytes = usable.reduce((sum, file) => sum + file.size, 0);

    if (totalBytes > MAX_BATCH_BYTES) throw fail({ code: 'batch_too_large', totalBytes });

    for (const file of usable) {
        try {
            sources.push(await readSource(file, formats));
        } catch (error) {
            failures.push(describeFailure(file.name, error, { tool, stage: 'read' }));
        }
    }

    if (!sources.length) {
        const first = failures[0];

        throw first ? new ProcessingError(first.code, first.error) : fail({ code: 'no_file' });
    }

    return { tool, sources, failures };
}

function flag(formData: FormData, name: string): boolean {
    return formData.get(name) === 'true';
}

function keepMetadataRequested(formData: FormData): boolean {
    return flag(formData, 'keepMetadata');
}

function toActionFile(source: { size: number }, produced: PipelineOutput): ActionFile {
    return {
        data: new Uint8Array(produced.data),
        filename: produced.filename,
        mimeType: produced.mimeType,
        originalSize: source.size,
        ...(produced.warning ? { warning: produced.warning } : {}),
    };
}

function imageContext(source: SourceImage): LogContext {
    return {
        format: source.format,
        bytes: source.size,
        width: source.metadata.width,
        height: source.metadata.height,
    };
}

type Triaged = { code: ActionErrorCode; message: string };

const UNKNOWN: ActionErrorDetail = { code: 'unknown' };

function triage(error: unknown): Triaged | null {
    if (error instanceof ProcessingError) return { code: error.code, message: error.message };

    if (error instanceof Error && error.message.includes('pixel limit')) {
        return { code: 'pixel_limit', message: actionErrorMessage({ code: 'pixel_limit' }) };
    }

    return null;
}

function describeFailure(filename: string, error: unknown, context: LogContext): ActionFailure {
    const known = triage(error);

    if (!known) Logger.error('image.failed', { ...context, code: UNKNOWN.code, error });

    const { code, message } = known ?? { code: UNKNOWN.code, message: actionErrorMessage(UNKNOWN) };

    return { filename, code, error: message };
}

function failed(detail: ActionErrorDetail): ActionResult {
    return { success: false, code: detail.code, error: actionErrorMessage(detail) };
}

function collect(files: ActionFile[], failures: ActionFailure[]): ActionResult {
    if (!files.length) {
        const first = failures[0];

        return first ? { success: false, code: first.code, error: first.error } : failed(UNKNOWN);
    }

    const names = uniqueFilenames(files.map(file => file.filename));

    return {
        success: true,
        files: files.map((file, index) => ({ ...file, filename: names[index] })),
        ...(failures.length ? { failures } : {}),
    };
}

async function run(
    tool: ToolName,
    process: () => Promise<ActionResult>,
    cost = 1
): Promise<ActionResult> {
    const limit = await checkRateLimit(cost);

    if (!limit.allowed) {
        Logger.warn('action.rate_limited', {
            tool,
            cost,
            code: 'rate_limited',
            retryAfterSeconds: limit.retryAfterSeconds,
        });

        return failed({
            code: 'rate_limited',
            retryAfterSeconds: limit.retryAfterSeconds,
            limit: RATE_LIMIT.images,
        });
    }

    try {
        return await process();
    } catch (error) {
        const known = triage(error);

        if (!known) {
            Logger.error('action.failed', { tool, cost, code: UNKNOWN.code, error });

            return failed(UNKNOWN);
        }

        return { success: false, code: known.code, error: known.message };
    }
}

function uploadCount(formData: FormData): number {
    return Math.min(MAX_BATCH_FILES, Math.max(1, formData.getAll('file').length));
}

async function runFiles<Format extends ConvertSource>(
    tool: ToolName,
    formData: FormData,
    formats: readonly Format[],
    handle: (batch: SourceBatch<Format>) => Promise<ActionResult>,
    cost = uploadCount(formData)
): Promise<ActionResult> {
    return run(tool, async () => handle(await readImageFiles(tool, formData, formats)), cost);
}

async function eachFile<Format extends ConvertSource>(
    { tool, sources, failures }: SourceBatch<Format>,
    process: (source: SourceImage<Format>) => Promise<PipelineOutput>
): Promise<ActionResult> {
    const produced: ActionFile[] = [];
    const problems = [...failures];

    for (const source of sources) {
        try {
            produced.push(toActionFile(source, await process(source)));
        } catch (error) {
            problems.push(describeFailure(source.name, error, { tool, ...imageContext(source) }));
        }
    }

    return collect(produced, problems);
}

export async function resizeImage(formData: FormData): Promise<ActionResult> {
    return runFiles('resize', formData, FORMAT_KEYS, async batch => {
        const parsed = resizeSchema.safeParse({
            width: formData.get('width'),
            height: formData.get('height'),
            rotate: formData.get('rotate') || '0',
            fit: formData.get('fit') || 'contain',
        });

        if (!parsed.success) throw invalid(parsed.error, 'Invalid dimensions.');

        const params = {
            ...parsed.data,
            withoutEnlargement: flag(formData, 'noEnlarge'),
            keepMetadata: keepMetadataRequested(formData),
        };

        return eachFile(batch, source => resizePipeline(source, params));
    });
}

export async function cropImage(formData: FormData): Promise<ActionResult> {
    return runFiles('crop', formData, FORMAT_KEYS, async batch => {
        const parsed = cropSchema.safeParse({
            ratio: formData.get('ratio'),
            shape: formData.get('shape'),
            left: formData.get('left'),
            top: formData.get('top'),
            width: formData.get('width'),
            height: formData.get('height'),
        });

        if (!parsed.success) throw invalid(parsed.error, 'Invalid crop settings.');

        const requestedSize = formData.get('resizeTo');
        const outputSize = requestedSize ? outputSizeSchema.safeParse(requestedSize) : null;

        if (outputSize && !outputSize.success)
            throw invalid(outputSize.error, 'Invalid output size.');

        const params = {
            ...parsed.data,
            target: outputSize?.success ? outputSize.data : null,
            keepMetadata: keepMetadataRequested(formData),
        };

        return eachFile(batch, source => cropPipeline(source, params));
    });
}

export async function compressImage(formData: FormData): Promise<ActionResult> {
    return runFiles('compress', formData, FORMAT_KEYS, async batch => {
        const parsed = compressSchema.safeParse({
            mode: formData.get('mode') || 'quality',
            quality: formData.get('quality') || String(DEFAULT_QUALITY),
            targetKb: formData.get('targetKb') || String(DEFAULT_TARGET_KB),
        });

        if (!parsed.success) throw invalid(parsed.error, 'Invalid settings.');

        return eachFile(batch, source => compressPipeline(source, parsed.data));
    });
}

export async function compareFormats(formData: FormData): Promise<ActionResult> {
    return runFiles(
        'compare',
        formData,
        FORMAT_KEYS,
        async ({ tool, sources, failures }) => {
            const parsed = compareSchema.safeParse({
                quality: formData.get('quality') || String(DEFAULT_QUALITY),
            });

            if (!parsed.success) throw invalid(parsed.error, 'Invalid quality.');

            const [source] = sources;
            const produced = await comparePipeline(source, COMPARE_FORMAT_KEYS, parsed.data);

            Logger.info('compare.encoded', {
                tool,
                ...imageContext(source),
                quality: parsed.data.quality,
                formats: COMPARE_FORMAT_KEYS.length,
            });

            return collect(
                produced.map(output => toActionFile(source, output)),
                failures
            );
        },
        COMPARE_FORMAT_KEYS.length
    );
}

export async function convertImage(formData: FormData): Promise<ActionResult> {
    return runFiles('convert', formData, CONVERT_SOURCE_KEYS, async batch => {
        const parsed = convertSchema.safeParse({ format: formData.get('format') });

        if (!parsed.success) throw invalid(parsed.error, 'Invalid target format.');

        const target = parsed.data.format;
        const icoOptions =
            target === 'ico'
                ? icoOptionsSchema.safeParse({
                      sizes: formData.get('icoSizes') || DEFAULT_ICO_SIZES.join(','),
                      pack: formData.get('icoPack') || 'false',
                  })
                : null;

        if (icoOptions && !icoOptions.success) {
            throw invalid(icoOptions.error, 'Invalid favicon settings.');
        }

        const params = {
            target,
            keepMetadata: keepMetadataRequested(formData),
            ico: icoOptions?.success ? icoOptions.data : null,
        };

        return eachFile(batch, source => convertPipeline(source, params));
    });
}

export async function imageToPdf(formData: FormData): Promise<ActionResult> {
    return runFiles('pdf', formData, CONVERT_SOURCE_KEYS, async ({ tool, sources, failures }) => {
        const parsed = imageToPdfSchema.safeParse({ pageSize: formData.get('pageSize') });

        if (!parsed.success) throw invalid(parsed.error, 'Invalid page size.');

        const { pageSize } = parsed.data;
        const pdfDoc = await createPdfDocument();
        const problems = [...failures];
        const used: SourceImage[] = [];

        for (const source of sources) {
            try {
                await addPdfPage(pdfDoc, source, pageSize);
                used.push(source);
            } catch (error) {
                problems.push(
                    describeFailure(source.name, error, { tool, ...imageContext(source) })
                );
            }
        }

        if (!used.length) return collect([], problems);

        const data = await savePdf(pdfDoc);
        const originalSize = used.reduce((sum, source) => sum + source.size, 0);
        const filename =
            used.length === 1
                ? `${used[0].baseName}.pdf`
                : `${used[0].baseName}-${used.length}-pages.pdf`;

        return collect(
            [toActionFile({ size: originalSize }, { data, filename, mimeType: 'application/pdf' })],
            problems
        );
    });
}

async function readPdfFiles(tool: ToolName, formData: FormData): Promise<PdfBatch> {
    const files = formData
        .getAll('file')
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!files.length) throw fail({ code: 'no_file' });

    if (files.length > MAX_BATCH_FILES) throw fail({ code: 'too_many_files' });

    const failures: ActionFailure[] = [];
    const usable = files.filter(file => {
        if (file.size <= MAX_FILE_SIZE) return true;

        failures.push({
            filename: file.name,
            code: 'file_too_large',
            error: actionErrorMessage({ code: 'file_too_large' }),
        });

        return false;
    });
    const totalBytes = usable.reduce((sum, file) => sum + file.size, 0);

    if (totalBytes > MAX_BATCH_BYTES) throw fail({ code: 'batch_too_large', totalBytes });

    const sources: PdfSource[] = [];

    for (const file of usable) {
        try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const document = await loadPdf(buffer);

            sources.push({
                document,
                name: file.name,
                baseName: stripExtension(file.name) || 'document',
                size: file.size,
                pageCount: document.getPageCount(),
            });
        } catch (error) {
            failures.push(describeFailure(file.name, error, { tool, stage: 'read' }));
        }
    }

    if (!sources.length) {
        const first = failures[0];

        throw first ? new ProcessingError(first.code, first.error) : fail({ code: 'no_file' });
    }

    return { sources, failures };
}

type PdfBatch = { sources: PdfSource[]; failures: ActionFailure[] };

export async function mergePdf(formData: FormData): Promise<ActionResult> {
    return run(
        'merge-pdf',
        async () => {
            const { sources, failures } = await readPdfFiles('merge-pdf', formData);

            if (sources.length < 2) throw fail({ code: 'one_pdf_only' });

            const pages = sources.reduce((sum, source) => sum + source.pageCount, 0);

            if (pages > MAX_PDF_PAGES) throw fail({ code: 'too_many_pages', pages });

            const data = await mergePdfs(sources);
            const originalSize = sources.reduce((sum, source) => sum + source.size, 0);

            Logger.info('pdf.merged', {
                tool: 'merge-pdf',
                files: sources.length,
                pages,
                bytes: data.length,
            });

            return collect(
                [
                    toActionFile(
                        { size: originalSize },
                        {
                            data,
                            filename: `${sources[0].baseName}-merged.pdf`,
                            mimeType: PDF_MIME_TYPE,
                        }
                    ),
                ],
                failures
            );
        },
        uploadCount(formData)
    );
}

export async function generatePlaceholder(formData: FormData): Promise<ActionResult> {
    return run('placeholder', async () => {
        const parsed = placeholderSchema.safeParse({
            width: formData.get('width'),
            height: formData.get('height'),
            bgColor: formData.get('bgColor'),
            textColor: formData.get('textColor'),
            text: formData.get('text') ?? '',
            format: formData.get('format'),
        });

        if (!parsed.success) throw invalid(parsed.error, 'Invalid settings.');

        return collect([toActionFile({ size: 0 }, await placeholderPipeline(parsed.data))], []);
    });
}

export async function rotateImage(formData: FormData): Promise<ActionResult> {
    return runFiles('rotate', formData, FORMAT_KEYS, async batch => {
        const parsed = rotateSchema.safeParse({
            angle: formData.get('angle') || '0',
            background: formData.get('background') || '#ffffff',
        });

        if (!parsed.success) throw invalid(parsed.error, 'Invalid rotation.');

        const params = {
            ...parsed.data,
            flipHorizontal: flag(formData, 'flipHorizontal'),
            flipVertical: flag(formData, 'flipVertical'),
            transparent: flag(formData, 'transparent'),
            keepMetadata: keepMetadataRequested(formData),
        };

        if (!params.angle && !params.flipHorizontal && !params.flipVertical) {
            throw fail({ code: 'nothing_to_do' });
        }

        return eachFile(batch, source => rotatePipeline(source, params));
    });
}

async function readLogo(formData: FormData, budget: number): Promise<WatermarkLogo> {
    const file = formData.get('logo');

    if (!(file instanceof File) || file.size === 0) throw fail({ code: 'logo_missing' });

    if (file.size > budget) throw fail({ code: 'logo_too_large' });

    const source = await readSource(file, CONVERT_SOURCE_KEYS);

    return { buffer: source.buffer, size: sourceSize(source.metadata) };
}

export async function watermarkImage(formData: FormData): Promise<ActionResult> {
    return runFiles('watermark', formData, FORMAT_KEYS, async batch => {
        const parsed = watermarkSchema.safeParse({
            mode: formData.get('mode') || WATERMARK_DEFAULTS.mode,
            text: formData.get('text') ?? '',
            color: formData.get('color') || WATERMARK_DEFAULTS.color,
            position: formData.get('position') || WATERMARK_DEFAULTS.position,
            opacity: formData.get('opacity') || WATERMARK_DEFAULTS.opacity,
            scale: formData.get('scale') || WATERMARK_DEFAULTS.scale,
            margin: formData.get('margin') || WATERMARK_DEFAULTS.margin,
        });

        if (!parsed.success) throw invalid(parsed.error, 'Invalid watermark settings.');

        const uploaded = batch.sources.reduce((sum, source) => sum + source.size, 0);
        const params = {
            ...parsed.data,
            logo:
                parsed.data.mode === 'image'
                    ? await readLogo(formData, MAX_BATCH_BYTES - uploaded)
                    : null,
            keepMetadata: keepMetadataRequested(formData),
        };

        return eachFile(batch, source => watermarkPipeline(source, params));
    });
}

export async function inspectImage(formData: FormData): Promise<ActionResult> {
    return runFiles(
        'inspect',
        formData,
        FORMAT_KEYS,
        async batch => eachFile(batch, inspectPipeline),
        1
    );
}

export async function stripImageMetadata(formData: FormData): Promise<ActionResult> {
    return runFiles('strip', formData, FORMAT_KEYS, async batch => eachFile(batch, stripPipeline));
}
