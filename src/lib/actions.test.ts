import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
    compressImage,
    convertImage,
    cropImage,
    generatePlaceholder,
    imageToPdf,
    inspectImage,
    resizeImage,
    rotateImage,
    stripImageMetadata,
    watermarkImage,
    type ActionFile,
    type ActionResult,
} from './actions';
import type { ActionErrorCode } from './errors';
import { MAX_BATCH_BYTES, MAX_BATCH_FILES, MAX_FILE_SIZE } from './image';

type Fixture = { buffer: Buffer; file: File };

const MIME: Record<string, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
};

async function image(
    format: 'jpeg' | 'png' | 'webp' | 'gif',
    { name, width = 40, height = 30, exif = false } = {} as {
        name?: string;
        width?: number;
        height?: number;
        exif?: boolean;
    }
): Promise<Fixture> {
    let pipeline = sharp({
        create: { width, height, channels: 3, background: { r: 220, g: 40, b: 40 } },
    });

    if (exif) pipeline = pipeline.withExif({ IFD0: { Copyright: 'test-suite' } });

    const buffer = await pipeline.toFormat(format).toBuffer();
    const filename = name ?? `photo.${format === 'jpeg' ? 'jpg' : format}`;

    return { buffer, file: new File([new Uint8Array(buffer)], filename, { type: MIME[format] }) };
}

function form(files: File[], fields: Record<string, string> = {}): FormData {
    const data = new FormData();

    for (const file of files) data.append('file', file);
    for (const [key, value] of Object.entries(fields)) data.append(key, value);

    return data;
}

function expectSuccess(result: ActionResult): Extract<ActionResult, { success: true }> {
    if (!result.success) throw new Error(`expected success, got: ${result.error}`);

    return result;
}

function expectFailure(result: ActionResult): { code: ActionErrorCode; error: string } {
    if (result.success) throw new Error('expected a failure');

    return { code: result.code, error: result.error };
}

function meta(file: ActionFile) {
    return sharp(Buffer.from(file.data)).metadata();
}

const junk = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], 'broken.png', {
    type: 'image/png',
});

describe('resizeImage', () => {
    it('resizes one image and names the output after its size', async () => {
        const source = await image('jpeg', { name: 'holiday.jpg', width: 200, height: 100 });
        const { files } = expectSuccess(
            await resizeImage(form([source.file], { width: '100', height: '50', fit: 'fill' }))
        );

        expect(files).toHaveLength(1);
        expect(files[0].filename).toBe('holiday-100x50.jpg');
        expect(files[0].mimeType).toBe('image/jpeg');
        expect(files[0].originalSize).toBe(source.file.size);
        await expect(meta(files[0])).resolves.toMatchObject({
            width: 100,
            height: 50,
            format: 'jpeg',
        });
    });

    it('applies the same box to a whole batch', async () => {
        const sources = await Promise.all([
            image('jpeg', { name: 'a.jpg' }),
            image('png', { name: 'b.png' }),
            image('webp', { name: 'c.webp' }),
        ]);
        const { files, failures } = expectSuccess(
            await resizeImage(
                form(
                    sources.map(source => source.file),
                    { width: '20', height: '20', fit: 'fill' }
                )
            )
        );

        expect(failures).toBeUndefined();
        expect(files.map(file => file.filename)).toEqual([
            'a-20x20.jpg',
            'b-20x20.png',
            'c-20x20.webp',
        ]);
        await expect(meta(files[1])).resolves.toMatchObject({ format: 'png' });
    });

    it('deduplicates output names so a zip cannot collide', async () => {
        const first = await image('jpeg', { name: 'photo.jpg' });
        const second = await image('jpeg', { name: 'photo.jpg' });
        const { files } = expectSuccess(
            await resizeImage(
                form([first.file, second.file], { width: '10', height: '10', fit: 'fill' })
            )
        );

        expect(files.map(file => file.filename)).toEqual(['photo-10x10.jpg', 'photo-10x10-2.jpg']);
    });

    it('keeps going when one file in the batch is unreadable', async () => {
        const good = await image('png', { name: 'good.png' });
        const result = expectSuccess(
            await resizeImage(form([junk, good.file], { width: '10', height: '10', fit: 'fill' }))
        );

        expect(result.files.map(file => file.filename)).toEqual(['good-10x10.png']);
        expect(result.failures).toEqual([
            {
                filename: 'broken.png',
                code: 'unreadable_image',
                error: expect.stringContaining("isn't a readable image"),
            },
        ]);
    });

    it('fails the request when every file is unreadable', async () => {
        expect(
            await resizeImage(form([junk], { width: '10', height: '10', fit: 'fill' }))
        ).toMatchObject({ success: false });
    });

    it('rejects formats the tool does not edit', async () => {
        const gif = await image('gif', { name: 'loop.gif' });

        expect(
            expectFailure(await resizeImage(form([gif.file], { width: '10', height: '10' })))
        ).toMatchObject({
            code: 'unsupported_format',
            error: expect.stringContaining('GIF files are not supported'),
        });
    });

    it('validates the dimensions before touching the file', async () => {
        const source = await image('png');

        expect(
            expectFailure(await resizeImage(form([source.file], { width: '0', height: '10' })))
        ).toMatchObject({
            code: 'invalid_settings',
            error: expect.stringContaining('Width must be between'),
        });
    });

    it('honours "do not enlarge"', async () => {
        const source = await image('png', { width: 20, height: 20 });
        const { files } = expectSuccess(
            await resizeImage(
                form([source.file], {
                    width: '400',
                    height: '400',
                    fit: 'inside',
                    noEnlarge: 'true',
                })
            )
        );

        await expect(meta(files[0])).resolves.toMatchObject({ width: 20, height: 20 });
    });

    it('strips metadata unless asked to keep it', async () => {
        const source = await image('jpeg', { exif: true });
        const stripped = expectSuccess(
            await resizeImage(form([source.file], { width: '10', height: '10', fit: 'fill' }))
        );
        const kept = expectSuccess(
            await resizeImage(
                form([source.file], {
                    width: '10',
                    height: '10',
                    fit: 'fill',
                    keepMetadata: 'true',
                })
            )
        );

        expect((await meta(stripped.files[0])).exif).toBeUndefined();
        expect((await meta(kept.files[0])).exif).toBeDefined();
    });
});

describe('cropImage', () => {
    const box = { left: '5', top: '5', width: '20', height: '10' };

    it('extracts the requested box', async () => {
        const source = await image('png', { name: 'wide.png', width: 100, height: 60 });
        const { files } = expectSuccess(
            await cropImage(form([source.file], { ratio: 'free', shape: 'rectangle', ...box }))
        );

        expect(files[0].filename).toBe('wide-20x10.png');
        await expect(meta(files[0])).resolves.toMatchObject({ width: 20, height: 10 });
    });

    it('names fixed-ratio crops after the ratio', async () => {
        const source = await image('png', { name: 'wide.png', width: 100, height: 60 });
        const { files } = expectSuccess(
            await cropImage(
                form([source.file], {
                    ratio: '16:9',
                    shape: 'rectangle',
                    left: '0',
                    top: '0',
                    width: '32',
                    height: '18',
                })
            )
        );

        expect(files[0].filename).toBe('wide-16x9.png');
    });

    it('clamps a box that runs off the image', async () => {
        const source = await image('png', { width: 40, height: 30 });
        const { files } = expectSuccess(
            await cropImage(
                form([source.file], {
                    ratio: 'free',
                    shape: 'rectangle',
                    left: '35',
                    top: '25',
                    width: '9000',
                    height: '9000',
                })
            )
        );

        await expect(meta(files[0])).resolves.toMatchObject({ width: 40, height: 30 });
    });

    it('scales the frame to a preset size and names the file after it', async () => {
        const source = await image('png', { name: 'shot.png', width: 400, height: 400 });
        const { files } = expectSuccess(
            await cropImage(
                form([source.file], {
                    ratio: '1:1',
                    shape: 'rectangle',
                    left: '0',
                    top: '0',
                    width: '200',
                    height: '200',
                    resizeTo: '1080x1080',
                })
            )
        );

        expect(files[0].filename).toBe('shot-1080x1080.png');
        await expect(meta(files[0])).resolves.toMatchObject({ width: 1080, height: 1080 });
    });

    it('rejects a malformed preset size', async () => {
        const source = await image('png');

        expect(
            expectFailure(
                await cropImage(
                    form([source.file], {
                        ratio: 'free',
                        shape: 'rectangle',
                        ...box,
                        resizeTo: '1080',
                    })
                )
            )
        ).toMatchObject({
            code: 'invalid_settings',
            error: expect.stringContaining('Output size'),
        });
    });

    it('exports a circular JPEG crop as a transparent PNG', async () => {
        const source = await image('jpeg', { name: 'avatar.jpg', width: 100, height: 100 });
        const { files } = expectSuccess(
            await cropImage(
                form([source.file], {
                    ratio: '1:1',
                    shape: 'circle',
                    left: '0',
                    top: '0',
                    width: '50',
                    height: '50',
                })
            )
        );

        expect(files[0].filename).toBe('avatar-1x1-circle.png');
        await expect(meta(files[0])).resolves.toMatchObject({ format: 'png', hasAlpha: true });
    });
});

describe('compressImage', () => {
    it('re-encodes at the requested quality', async () => {
        const source = await image('jpeg', { name: 'shot.jpg', width: 300, height: 300 });
        const { files } = expectSuccess(
            await compressImage(form([source.file], { mode: 'quality', quality: '20' }))
        );

        expect(files[0].filename).toBe('shot-compressed.jpg');
        expect(files[0].warning).toBeUndefined();
        expect(files[0].originalSize).toBe(source.file.size);
    });

    it('hits a reachable target size', async () => {
        const source = await sharp({
            create: { width: 600, height: 600, channels: 3, background: { r: 10, g: 90, b: 200 } },
        })
            .jpeg({ quality: 100 })
            .toBuffer();
        const file = new File([new Uint8Array(source)], 'big.jpg', { type: 'image/jpeg' });
        const { files } = expectSuccess(
            await compressImage(form([file], { mode: 'size', targetKb: '10' }))
        );

        expect(files[0].data.byteLength).toBeLessThanOrEqual(10 * 1024);
        expect(files[0].warning).toBeUndefined();
    });

    it('returns the smallest it managed, with a warning, when the target is out of reach', async () => {
        const noise = Buffer.alloc(400 * 400 * 3);

        for (let index = 0; index < noise.length; index += 1) noise[index] = (index * 7919) % 251;

        const source = await sharp(noise, { raw: { width: 400, height: 400, channels: 3 } })
            .png()
            .toBuffer();
        const file = new File([new Uint8Array(source)], 'noise.png', { type: 'image/png' });
        const { files } = expectSuccess(
            await compressImage(form([file], { mode: 'size', targetKb: '1' }))
        );

        expect(files[0].warning).toContain("Couldn't reach");
        expect(files[0].data.byteLength).toBeGreaterThan(1024);
    });

    it('compresses a batch file by file', async () => {
        const sources = await Promise.all([
            image('jpeg', { name: 'a.jpg', width: 120, height: 120 }),
            image('png', { name: 'b.png', width: 120, height: 120 }),
        ]);
        const { files } = expectSuccess(
            await compressImage(
                form(
                    sources.map(source => source.file),
                    { mode: 'quality', quality: '40' }
                )
            )
        );

        expect(files.map(file => file.filename)).toEqual(['a-compressed.jpg', 'b-compressed.png']);
        expect(files.map(file => file.originalSize)).toEqual([
            sources[0].file.size,
            sources[1].file.size,
        ]);
    });
});

describe('convertImage', () => {
    it('converts between raster formats', async () => {
        const source = await image('png', { name: 'logo.png' });
        const { files } = expectSuccess(
            await convertImage(form([source.file], { format: 'webp' }))
        );

        expect(files[0].filename).toBe('logo.webp');
        expect(files[0].mimeType).toBe('image/webp');
        await expect(meta(files[0])).resolves.toMatchObject({ format: 'webp' });
    });

    it('rasterises a GIF into a PNG', async () => {
        const source = await image('gif', { name: 'loop.gif' });
        const { files } = expectSuccess(await convertImage(form([source.file], { format: 'png' })));

        await expect(meta(files[0])).resolves.toMatchObject({ format: 'png' });
    });

    it('refuses a no-op conversion', async () => {
        const source = await image('png');

        expect(expectFailure(await convertImage(form([source.file], { format: 'png' })))).toEqual({
            code: 'same_format',
            error: 'Target format must differ from the source format.',
        });
    });

    it('skips only the no-op file inside a batch', async () => {
        const alreadyPng = await image('png', { name: 'already.png' });
        const jpeg = await image('jpeg', { name: 'photo.jpg' });
        const result = expectSuccess(
            await convertImage(form([alreadyPng.file, jpeg.file], { format: 'png' }))
        );

        expect(result.files.map(file => file.filename)).toEqual(['photo.png']);
        expect(result.failures).toEqual([
            {
                filename: 'already.png',
                code: 'same_format',
                error: 'Target format must differ from the source format.',
            },
        ]);
    });

    it('builds an ICO with one directory entry per size', async () => {
        const source = await image('png', { name: 'brand.png', width: 256, height: 256 });
        const { files } = expectSuccess(
            await convertImage(form([source.file], { format: 'ico', icoSizes: '16,32' }))
        );
        const ico = Buffer.from(files[0].data);

        expect(files[0].filename).toBe('brand.ico');
        expect(files[0].mimeType).toBe('image/x-icon');
        expect(ico.readUInt16LE(2)).toBe(1);
        expect(ico.readUInt16LE(4)).toBe(2);
    });

    it('zips the favicon pack', async () => {
        const source = await image('png', { name: 'brand.png', width: 256, height: 256 });
        const { files } = expectSuccess(
            await convertImage(
                form([source.file], { format: 'ico', icoSizes: '16,32', icoPack: 'true' })
            )
        );
        const zip = Buffer.from(files[0].data);

        expect(files[0].filename).toBe('brand-favicons.zip');
        expect(files[0].mimeType).toBe('application/zip');
        expect(zip.subarray(0, 2).toString()).toBe('PK');
        expect(zip.toString('latin1')).toContain('site.webmanifest');
        expect(zip.toString('latin1')).toContain('apple-touch-icon.png');
    });

    it('wraps the image in an SVG rather than tracing it', async () => {
        const source = await image('png', { name: 'mark.png' });
        const { files } = expectSuccess(await convertImage(form([source.file], { format: 'svg' })));
        const svg = new TextDecoder().decode(files[0].data);

        expect(files[0].filename).toBe('mark.svg');
        expect(svg).toContain('<svg');
        expect(svg).toContain('xlink:href="data:image/png;base64,');
    });

    it('emits a base64 data URI of the source format', async () => {
        const source = await image('png', { name: 'tiny.png' });
        const { files } = expectSuccess(
            await convertImage(form([source.file], { format: 'base64' }))
        );
        const text = new TextDecoder().decode(files[0].data);

        expect(files[0].filename).toBe('tiny-base64.txt');
        expect(files[0].mimeType).toBe('text/plain');
        expect(text.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('produces one data URI per file in a batch', async () => {
        const sources = await Promise.all([
            image('png', { name: 'one.png' }),
            image('png', { name: 'two.png' }),
        ]);
        const { files } = expectSuccess(
            await convertImage(
                form(
                    sources.map(source => source.file),
                    { format: 'base64' }
                )
            )
        );

        expect(files.map(file => file.filename)).toEqual(['one-base64.txt', 'two-base64.txt']);
    });

    it('rejects an unknown target format', async () => {
        const source = await image('png');

        expect(
            expectFailure(await convertImage(form([source.file], { format: 'bmp' })))
        ).toMatchObject({
            code: 'invalid_settings',
            error: expect.stringContaining('target format'),
        });
    });
});

describe('imageToPdf', () => {
    it('wraps a single image in a one-page PDF', async () => {
        const source = await image('jpeg', { name: 'scan.jpg', width: 120, height: 90 });
        const { files } = expectSuccess(await imageToPdf(form([source.file], { pageSize: 'fit' })));
        const pdf = await PDFDocument.load(files[0].data);

        expect(files[0].filename).toBe('scan.pdf');
        expect(files[0].mimeType).toBe('application/pdf');
        expect(pdf.getPageCount()).toBe(1);
        expect(pdf.getPage(0).getSize()).toEqual({ width: 120, height: 90 });
    });

    it('puts every image on its own page, in upload order', async () => {
        const sources = await Promise.all([
            image('jpeg', { name: 'first.jpg', width: 100, height: 40 }),
            image('png', { name: 'second.png', width: 60, height: 80 }),
            image('webp', { name: 'third.webp', width: 20, height: 20 }),
        ]);
        const { files } = expectSuccess(
            await imageToPdf(
                form(
                    sources.map(source => source.file),
                    { pageSize: 'fit' }
                )
            )
        );
        const pdf = await PDFDocument.load(files[0].data);

        expect(files[0].filename).toBe('first-3-pages.pdf');
        expect(pdf.getPageCount()).toBe(3);
        expect(pdf.getPages().map(page => page.getSize())).toEqual([
            { width: 100, height: 40 },
            { width: 60, height: 80 },
            { width: 20, height: 20 },
        ]);
    });

    it('reports the combined size of everything it embedded', async () => {
        const sources = await Promise.all([
            image('png', { name: 'a.png' }),
            image('png', { name: 'b.png' }),
        ]);
        const { files } = expectSuccess(
            await imageToPdf(
                form(
                    sources.map(source => source.file),
                    { pageSize: 'fit' }
                )
            )
        );

        expect(files[0].originalSize).toBe(sources[0].file.size + sources[1].file.size);
    });

    it('centers the image on a standard page', async () => {
        const source = await image('png', { width: 40, height: 30 });
        const { files } = expectSuccess(await imageToPdf(form([source.file], { pageSize: 'a4' })));
        const pdf = await PDFDocument.load(files[0].data);
        const { width, height } = pdf.getPage(0).getSize();

        expect(Math.round(width)).toBe(842);
        expect(Math.round(height)).toBe(595);
    });

    it('builds the PDF from the readable files and reports the rest', async () => {
        const source = await image('png', { name: 'good.png' });
        const result = expectSuccess(
            await imageToPdf(form([junk, source.file], { pageSize: 'fit' }))
        );
        const pdf = await PDFDocument.load(result.files[0].data);

        expect(pdf.getPageCount()).toBe(1);
        expect(result.files[0].filename).toBe('good.pdf');
        expect(result.failures).toHaveLength(1);
    });

    it('validates the page size', async () => {
        const source = await image('png');

        expect(
            expectFailure(await imageToPdf(form([source.file], { pageSize: 'a3' })))
        ).toMatchObject({ code: 'invalid_settings', error: expect.stringContaining('page size') });
    });
});

describe('generatePlaceholder', () => {
    it('renders the requested box with no upload', async () => {
        const { files } = expectSuccess(
            await generatePlaceholder(
                form([], {
                    width: '320',
                    height: '200',
                    bgColor: '#112233',
                    textColor: '#ffffff',
                    text: 'Hello',
                    format: 'png',
                })
            )
        );

        expect(files[0].filename).toBe('placeholder-320x200.png');
        expect(files[0].originalSize).toBe(0);
        await expect(meta(files[0])).resolves.toMatchObject({
            width: 320,
            height: 200,
            format: 'png',
        });
    });

    it('rejects a malformed color', async () => {
        expect(
            expectFailure(
                await generatePlaceholder(
                    form([], {
                        width: '10',
                        height: '10',
                        bgColor: 'blue',
                        textColor: '#ffffff',
                        text: '',
                        format: 'png',
                    })
                )
            )
        ).toMatchObject({
            code: 'invalid_settings',
            error: expect.stringContaining('hex color'),
        });
    });
});

describe('rotateImage', () => {
    it('turns the canvas with a right angle and names the output', async () => {
        const source = await image('png', { name: 'wide.png', width: 60, height: 20 });
        const { files } = expectSuccess(await rotateImage(form([source.file], { angle: '90' })));

        expect(files[0].filename).toBe('wide-90deg.png');
        await expect(meta(files[0])).resolves.toMatchObject({ width: 20, height: 60 });
    });

    it('mirrors and flips without an angle', async () => {
        const source = await image('png', { name: 'a.png' });
        const { files } = expectSuccess(
            await rotateImage(
                form([source.file], {
                    angle: '0',
                    flipHorizontal: 'true',
                    flipVertical: 'true',
                })
            )
        );

        expect(files[0].filename).toBe('a-mirrored-flipped.png');
        await expect(meta(files[0])).resolves.toMatchObject({ width: 40, height: 30 });
    });

    it('refuses a request that would change nothing', async () => {
        const source = await image('png');

        expect(expectFailure(await rotateImage(form([source.file], { angle: '0' })))).toMatchObject(
            {
                code: 'nothing_to_do',
                error: expect.stringContaining('Nothing to do'),
            }
        );
    });

    it('grows the canvas for a free angle and fills the corners', async () => {
        const source = await image('png', { name: 'tilt.png', width: 40, height: 40 });
        const filled = expectSuccess(
            await rotateImage(form([source.file], { angle: '45', background: '#ff0000' }))
        );
        const transparent = expectSuccess(
            await rotateImage(
                form([source.file], { angle: '45', background: '#ff0000', transparent: 'true' })
            )
        );

        expect(filled.files[0].filename).toBe('tilt-45deg.png');
        expect((await meta(filled.files[0])).width).toBeGreaterThan(40);
        expect((await meta(filled.files[0])).hasAlpha).toBe(false);
        expect((await meta(transparent.files[0])).hasAlpha).toBe(true);
    });

    it('keeps a JPEG opaque even when transparent corners are asked for', async () => {
        const source = await image('jpeg', { name: 'photo.jpg' });
        const { files } = expectSuccess(
            await rotateImage(form([source.file], { angle: '30', transparent: 'true' }))
        );

        await expect(meta(files[0])).resolves.toMatchObject({ format: 'jpeg', hasAlpha: false });
    });

    it('rejects an angle outside a single turn', async () => {
        const source = await image('png');

        expect(
            expectFailure(await rotateImage(form([source.file], { angle: '400' })))
        ).toMatchObject({
            code: 'invalid_settings',
            error: expect.stringContaining('Angle must be between'),
        });
    });
});

describe('watermarkImage', () => {
    const text = {
        mode: 'text',
        text: '© Test',
        color: '#ffffff',
        position: 'bottom-right',
        opacity: '60',
        scale: '30',
        margin: '4',
    };

    async function pixel(file: ActionFile, left: number, top: number) {
        const { data, info } = await sharp(Buffer.from(file.data))
            .raw()
            .toBuffer({ resolveWithObject: true });
        const at = (top * info.width + left) * info.channels;

        return [...data.subarray(at, at + 3)];
    }

    async function repainted(
        file: ActionFile,
        box: { left: number; top: number; width: number; height: number },
        background: number[]
    ) {
        const { data, info } = await sharp(Buffer.from(file.data))
            .raw()
            .toBuffer({ resolveWithObject: true });
        let count = 0;

        for (let top = box.top; top < box.top + box.height; top += 1) {
            for (let left = box.left; left < box.left + box.width; left += 1) {
                const at = (top * info.width + left) * info.channels;
                const rgb = [...data.subarray(at, at + 3)];

                if (rgb.some((value, index) => value !== background[index])) {
                    count += 1;
                }
            }
        }

        return count;
    }

    it('stamps text over the image, keeping its format and size', async () => {
        const source = await image('jpeg', { name: 'beach.jpg', width: 200, height: 120 });
        const { files } = expectSuccess(await watermarkImage(form([source.file], text)));

        expect(files[0].filename).toBe('beach-watermarked.jpg');
        expect(files[0].originalSize).toBe(source.file.size);
        await expect(meta(files[0])).resolves.toMatchObject({
            format: 'jpeg',
            width: 200,
            height: 120,
        });
    });

    it('paints in the requested corner and leaves the others alone', async () => {
        const source = await image('png', { width: 200, height: 120 });
        const { files } = expectSuccess(
            await watermarkImage(
                form([source.file], {
                    ...text,
                    text: '@@@@',
                    position: 'top-left',
                    opacity: '100',
                    scale: '50',
                    margin: '0',
                })
            )
        );
        const background = [220, 40, 40];
        const stamped = await repainted(
            files[0],
            { left: 0, top: 0, width: 100, height: 60 },
            background
        );
        const other = await repainted(
            files[0],
            { left: 100, top: 60, width: 100, height: 60 },
            background
        );

        expect(other).toBe(0);
        expect(stamped).toBeGreaterThan(0);
    });

    it('composites a logo scaled to a share of the width', async () => {
        const source = await image('png', { name: 'shot.png', width: 400, height: 300 });
        const logoBytes = await sharp({
            create: { width: 100, height: 50, channels: 3, background: { r: 0, g: 0, b: 255 } },
        })
            .png()
            .toBuffer();
        const data = form([source.file], {
            ...text,
            mode: 'image',
            position: 'center',
            opacity: '100',
            scale: '25',
        });

        data.append(
            'logo',
            new File([new Uint8Array(logoBytes)], 'logo.png', { type: 'image/png' })
        );

        const { files } = expectSuccess(await watermarkImage(data));
        const middle = await pixel(files[0], 200, 150);
        const corner = await pixel(files[0], 5, 5);

        expect(files[0].filename).toBe('shot-watermarked.png');
        expect(middle).toEqual([0, 0, 255]);
        expect(corner).toEqual([220, 40, 40]);
        await expect(meta(files[0])).resolves.toMatchObject({ width: 400, height: 300 });
    });

    it('charges the logo against the same budget as the batch', async () => {
        const source = await image('png', { name: 'shot.png' });
        const data = form([source.file], { ...text, mode: 'image' });

        data.append(
            'logo',
            new File([new Uint8Array(MAX_BATCH_BYTES)], 'huge.png', { type: 'image/png' })
        );

        expect(expectFailure(await watermarkImage(data))).toMatchObject({
            code: 'logo_too_large',
            error: expect.stringContaining('add up to more than'),
        });
    });

    it('asks for the logo when the image mode has none', async () => {
        const source = await image('png');

        expect(
            expectFailure(await watermarkImage(form([source.file], { ...text, mode: 'image' })))
        ).toMatchObject({ code: 'logo_missing' });
    });

    it('requires the text for a text watermark', async () => {
        const source = await image('png');

        expect(
            expectFailure(await watermarkImage(form([source.file], { ...text, text: '  ' })))
        ).toMatchObject({
            code: 'invalid_settings',
            error: expect.stringContaining('Watermark text is required'),
        });
    });

    it('stamps a whole batch with the same settings', async () => {
        const sources = await Promise.all([
            image('png', { name: 'a.png', width: 120, height: 90 }),
            image('jpeg', { name: 'b.jpg', width: 80, height: 60 }),
        ]);
        const { files } = expectSuccess(
            await watermarkImage(
                form(
                    sources.map(source => source.file),
                    text
                )
            )
        );

        expect(files.map(file => file.filename)).toEqual([
            'a-watermarked.png',
            'b-watermarked.jpg',
        ]);
    });
});

describe('inspectImage', () => {
    it('returns a JSON report per file instead of an image', async () => {
        const source = await image('jpeg', { name: 'holiday.jpg', width: 64, height: 48 });
        const { files } = expectSuccess(await inspectImage(form([source.file])));
        const report = JSON.parse(new TextDecoder().decode(files[0].data));

        expect(files[0].filename).toBe('holiday-metadata.json');
        expect(files[0].mimeType).toBe('application/json');
        expect(report).toMatchObject({
            filename: 'holiday.jpg',
            format: 'JPEG',
            width: 64,
            height: 48,
        });
        expect(report.groups.map((group: { title: string }) => group.title)).toContain('File');
    });

    it('lists the metadata a photo carries', async () => {
        const withExif = await image('jpeg', { name: 'exif.jpg', exif: true });
        const bare = await image('png', { name: 'bare.png' });
        const { files } = expectSuccess(await inspectImage(form([withExif.file, bare.file])));
        const [first, second] = files.map(file => JSON.parse(new TextDecoder().decode(file.data)));

        expect(first.removable).toContain('EXIF');
        expect(second.removable).toEqual([]);
    });
});

describe('stripImageMetadata', () => {
    it('re-encodes without the metadata', async () => {
        const source = await image('jpeg', { name: 'holiday.jpg', exif: true });
        const { files } = expectSuccess(await stripImageMetadata(form([source.file])));

        expect(files[0].filename).toBe('holiday-clean.jpg');
        expect((await meta(files[0])).exif).toBeUndefined();
        await expect(meta(files[0])).resolves.toMatchObject({ format: 'jpeg' });
    });

    it('skips a file that has nothing to remove, keeping the rest', async () => {
        const clean = await image('png', { name: 'clean.png' });
        const tagged = await image('jpeg', { name: 'tagged.jpg', exif: true });
        const result = expectSuccess(await stripImageMetadata(form([clean.file, tagged.file])));

        expect(result.files.map(file => file.filename)).toEqual(['tagged-clean.jpg']);
        expect(result.failures).toEqual([
            {
                filename: 'clean.png',
                code: 'no_metadata',
                error: 'This file carries no metadata to remove.',
            },
        ]);
    });
});

describe('upload limits', () => {
    it('requires a file', async () => {
        expect(expectFailure(await convertImage(form([], { format: 'png' })))).toEqual({
            code: 'no_file',
            error: 'No file provided.',
        });
    });

    it('caps the number of files per request', async () => {
        const source = await image('png');
        const files = Array.from(
            { length: MAX_BATCH_FILES + 1 },
            (_, index) =>
                new File([new Uint8Array(source.buffer)], `photo-${index}.png`, {
                    type: 'image/png',
                })
        );

        expect(expectFailure(await convertImage(form(files, { format: 'webp' })))).toMatchObject({
            code: 'too_many_files',
            error: expect.stringContaining(`up to ${MAX_BATCH_FILES} images`),
        });
    });

    it('caps the total upload size', async () => {
        const half = new Uint8Array(Math.round(MAX_FILE_SIZE * 0.6));
        const files = [
            new File([half], 'a.png', { type: 'image/png' }),
            new File([half], 'b.png', { type: 'image/png' }),
        ];

        expect(expectFailure(await convertImage(form(files, { format: 'webp' })))).toMatchObject({
            code: 'batch_too_large',
            error: expect.stringContaining('Keep a batch under'),
        });
    });

    it('rejects an oversized file on its own, keeping the rest of the batch', async () => {
        const source = await image('png', { name: 'small.png' });
        const huge = new File([new Uint8Array(MAX_FILE_SIZE + 1)], 'huge.png', {
            type: 'image/png',
        });
        const result = expectSuccess(
            await convertImage(form([huge, source.file], { format: 'webp' }))
        );

        expect(result.files.map(file => file.filename)).toEqual(['small.webp']);
        expect(result.failures).toEqual([
            {
                filename: 'huge.png',
                code: 'file_too_large',
                error: 'File is too large. The maximum size is 20MB.',
            },
        ]);
    });
});
