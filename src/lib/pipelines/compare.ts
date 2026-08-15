import { IMAGE_FORMATS, type ImageFormat } from '../image';
import { applyQuality, createDecoder } from './compress';
import type { PipelineOutput, SourceImage } from './core';

export type CompareParams = { quality: number };

export async function comparePipeline(
    source: SourceImage<ImageFormat>,
    formats: readonly ImageFormat[],
    { quality }: CompareParams
): Promise<PipelineOutput[]> {
    const nextPipeline = await createDecoder(source.buffer, source.metadata);
    const outputs: PipelineOutput[] = [];

    for (const format of formats) {
        const { extension, mimeType } = IMAGE_FORMATS[format];
        const data = await applyQuality(nextPipeline(), format, quality).toBuffer();

        outputs.push({ data, filename: `${source.baseName}.${extension}`, mimeType });
    }

    return outputs;
}
