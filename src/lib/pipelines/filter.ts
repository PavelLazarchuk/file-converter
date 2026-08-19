import type { Matrix3x3 } from 'sharp';

import { IMAGE_FORMATS, filterSuffix, type FilterOptions, type ImageFormat } from '../image';
import { decode, type PipelineOutput, type SourceImage } from './core';

export type FilterParams = FilterOptions & { keepMetadata: boolean };

const SEPIA_MATRIX: Matrix3x3 = [
    [0.393, 0.769, 0.189],
    [0.349, 0.686, 0.168],
    [0.272, 0.534, 0.131],
];

export async function filterPipeline(
    source: SourceImage<ImageFormat>,
    { effect, brightness, saturation, hue, blur, sharpen, keepMetadata }: FilterParams
): Promise<PipelineOutput> {
    let pipeline = decode(source.buffer);

    if (effect === 'grayscale') pipeline = pipeline.grayscale();
    if (effect === 'sepia') pipeline = pipeline.recomb(SEPIA_MATRIX);
    if (effect === 'invert') pipeline = pipeline.negate({ alpha: false });

    if (brightness !== 100 || saturation !== 100 || hue !== 0) {
        pipeline = pipeline.modulate({
            brightness: brightness / 100,
            saturation: saturation / 100,
            hue,
        });
    }

    if (blur > 0) pipeline = pipeline.blur(blur);
    if (sharpen) pipeline = pipeline.sharpen();

    pipeline = pipeline.toFormat(source.format);

    if (keepMetadata) pipeline = pipeline.keepMetadata();

    const data = await pipeline.toBuffer();
    const { extension, mimeType } = IMAGE_FORMATS[source.format];
    const suffix = filterSuffix({ effect, brightness, saturation, hue, blur, sharpen });

    return { data, filename: `${source.baseName}-${suffix}.${extension}`, mimeType };
}
