import { describe, expect, it } from 'vitest';

import { parseMetadataReport } from '../metadata';
import { describeOutput, sourceImage } from '@/test/images';
import { inspectPipeline, stripPipeline } from './inspect';

describe('inspectPipeline', () => {
    it('serializes a parsable report instead of an image', async () => {
        const source = await sourceImage('png', { width: 40, height: 30, name: 'shot.png' });
        const output = await inspectPipeline(source);
        const report = parseMetadataReport(Buffer.from(output.data).toString('utf8'));

        expect(output.filename).toBe('shot-metadata.json');
        expect(output.mimeType).toBe('application/json');
        expect(report).not.toBeNull();
        expect(report?.filename).toBe('shot.png');
        expect([report?.width, report?.height]).toEqual([40, 30]);
    });
});

describe('stripPipeline', () => {
    it('drops the EXIF block and keeps the format', async () => {
        const source = await sourceImage('jpeg', { exif: true });
        const output = await stripPipeline(source);
        const meta = await describeOutput(output.data);

        expect(meta.exif).toBeUndefined();
        expect(meta.format).toBe('jpeg');
        expect(output.filename).toBe('photo-clean.jpg');
    });

    it('refuses an image that carries nothing to strip', async () => {
        const source = await sourceImage('png');

        await expect(stripPipeline(source)).rejects.toMatchObject({ code: 'no_metadata' });
    });
});
