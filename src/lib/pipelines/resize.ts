import { IMAGE_FORMATS, fitPads, type ImageFormat } from '../image';
import type { ResizeValues } from '../schemas';
import { decode, type PipelineOutput, type SourceImage } from './core';

export type ResizeParams = ResizeValues & {
    withoutEnlargement: boolean;
    keepMetadata: boolean;
};

export async function resizePipeline(
    source: SourceImage<ImageFormat>,
    { width, height, rotate, fit, withoutEnlargement, keepMetadata }: ResizeParams
): Promise<PipelineOutput> {
    const background =
        source.format === 'jpeg' ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0, alpha: 0 };
    let pipeline = decode(source.buffer);

    if (rotate !== '0') pipeline = pipeline.rotate(Number(rotate));

    pipeline = pipeline
        .resize(width, height, {
            fit,
            withoutEnlargement,
            ...(fitPads(fit) && { background }),
        })
        .toFormat(source.format);

    if (keepMetadata) pipeline = pipeline.keepMetadata();

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    const { extension, mimeType } = IMAGE_FORMATS[source.format];

    return {
        data,
        filename: `${source.baseName}-${info.width}x${info.height}.${extension}`,
        mimeType,
    };
}
