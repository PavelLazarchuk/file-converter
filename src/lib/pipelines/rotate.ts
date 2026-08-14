import { IMAGE_FORMATS, rotateSuffix, type ImageFormat } from '../image';
import type { RotateValues } from '../schemas';
import { decode, type PipelineOutput, type SourceImage } from './core';

export type RotateParams = RotateValues & {
    flipHorizontal: boolean;
    flipVertical: boolean;
    transparent: boolean;
    keepMetadata: boolean;
};

export async function rotatePipeline(
    source: SourceImage<ImageFormat>,
    { angle, background, flipHorizontal, flipVertical, transparent, keepMetadata }: RotateParams
): Promise<PipelineOutput> {
    let pipeline = decode(source.buffer);

    if (angle) {
        const fill =
            transparent && source.format !== 'jpeg' ? { r: 0, g: 0, b: 0, alpha: 0 } : background;

        pipeline = pipeline.rotate(angle, { background: fill });
    }

    if (flipHorizontal) pipeline = pipeline.flop();
    if (flipVertical) pipeline = pipeline.flip();

    pipeline = pipeline.toFormat(source.format);

    if (keepMetadata) pipeline = pipeline.keepMetadata();

    const data = await pipeline.toBuffer();
    const { extension, mimeType } = IMAGE_FORMATS[source.format];
    const suffix = rotateSuffix({ angle, flipHorizontal, flipVertical });

    return { data, filename: `${source.baseName}-${suffix}.${extension}`, mimeType };
}
