import { describeMetadata } from '../exif';
import { IMAGE_FORMATS, STRIP_QUALITY, type ImageFormat } from '../image';
import { METADATA_MIME_TYPE } from '../metadata';
import { decode, fail, hasStrippableMetadata, type PipelineOutput, type SourceImage } from './core';

export async function inspectPipeline(source: SourceImage<ImageFormat>): Promise<PipelineOutput> {
    const report = describeMetadata(
        {
            filename: source.name,
            size: source.size,
            format: IMAGE_FORMATS[source.format].label,
        },
        source.metadata
    );

    return {
        data: Buffer.from(JSON.stringify(report), 'utf8'),
        filename: `${source.baseName}-metadata.json`,
        mimeType: METADATA_MIME_TYPE,
    };
}

export async function stripPipeline(source: SourceImage<ImageFormat>): Promise<PipelineOutput> {
    if (!hasStrippableMetadata(source.metadata)) throw fail({ code: 'no_metadata' });

    const data = await decode(source.buffer)
        .toFormat(source.format, { quality: STRIP_QUALITY[source.format] })
        .toBuffer();
    const { extension, mimeType } = IMAGE_FORMATS[source.format];

    return { data, filename: `${source.baseName}-clean.${extension}`, mimeType };
}
