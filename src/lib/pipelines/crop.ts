import {
    IMAGE_FORMATS,
    circleOutputFormat,
    clampCropBox,
    type ImageFormat,
    type Size,
} from '../image';
import type { CropValues } from '../schemas';
import { decode, sourceSize, type PipelineOutput, type SourceImage } from './core';

export type CropParams = CropValues & {
    target: Size | null;
    keepMetadata: boolean;
};

export async function cropPipeline(
    source: SourceImage<ImageFormat>,
    { target, keepMetadata, ...box }: CropParams
): Promise<PipelineOutput> {
    const { width: srcWidth, height: srcHeight } = sourceSize(source.metadata);
    const area = clampCropBox(box, srcWidth, srcHeight);
    const circle = box.shape === 'circle';
    const outFormat = circle ? circleOutputFormat(source.format) : source.format;
    let pipeline = decode(source.buffer).extract(area);

    if (circle) {
        const mask = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${area.width}" height="${area.height}">
                    <ellipse cx="${area.width / 2}" cy="${area.height / 2}" rx="${area.width / 2}" ry="${area.height / 2}" fill="#fff"/>
                </svg>`
        );

        pipeline = pipeline.ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]);
    }

    if (target) pipeline = pipeline.resize(target.width, target.height, { fit: 'cover' });

    pipeline = pipeline.toFormat(outFormat);

    if (keepMetadata) pipeline = pipeline.keepMetadata();

    const data = await pipeline.toBuffer();
    const { extension, mimeType } = IMAGE_FORMATS[outFormat];
    const ratioLabel = target
        ? `${target.width}x${target.height}`
        : box.ratio === 'free'
          ? `${area.width}x${area.height}`
          : box.ratio.replace(':', 'x');
    const shapeLabel = circle ? '-circle' : '';

    return {
        data,
        filename: `${source.baseName}-${ratioLabel}${shapeLabel}.${extension}`,
        mimeType,
    };
}
