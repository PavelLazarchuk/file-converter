import type { Metadata } from 'sharp';

import { encodeIco } from '../ico';
import {
    FAVICON_PACK,
    IMAGE_FORMATS,
    STRIP_QUALITY,
    ZIP_MIME_TYPE,
    type ConvertSource,
    type ConvertTarget,
} from '../image';
import type { IcoOptionsValues } from '../schemas';
import { createZip, type ZipEntry } from '../zip';
import { decode, fail, hasStrippableMetadata, type PipelineOutput, type SourceImage } from './core';

export type ConvertParams = {
    target: ConvertTarget;
    keepMetadata: boolean;
    ico: IcoOptionsValues | null;
};

async function base64Bytes(
    buffer: Buffer,
    source: ConvertSource,
    metadata: Metadata,
    keepMetadata: boolean
): Promise<Buffer> {
    if (keepMetadata || source === 'gif' || source === 'svg') return buffer;
    if (!hasStrippableMetadata(metadata)) return buffer;

    return decode(buffer).toFormat(source, { quality: STRIP_QUALITY[source] }).toBuffer();
}

function iconPng(buffer: Buffer, size: number, background?: string): Promise<Buffer> {
    const pipeline = decode(buffer).resize(size, size, {
        fit: 'contain',
        background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    });

    return (background ? pipeline.flatten({ background }) : pipeline).png().toBuffer();
}

async function buildIco(buffer: Buffer, sizes: number[]): Promise<Buffer> {
    const pngs = await Promise.all(sizes.map(size => iconPng(buffer, size)));

    return encodeIco(sizes.map((size, index) => ({ size, data: pngs[index] })));
}

async function buildFaviconPackAssets(
    buffer: Buffer,
    baseName: string
): Promise<{ appleTouch: Buffer; manifestIcons: Buffer[]; manifest: Buffer; readme: Buffer }> {
    const [appleTouch, ...manifestIcons] = await Promise.all([
        iconPng(buffer, FAVICON_PACK.appleTouch, '#ffffff'),
        ...FAVICON_PACK.manifestSizes.map(size => iconPng(buffer, size)),
    ]);
    const manifest = {
        name: baseName,
        short_name: baseName,
        icons: FAVICON_PACK.manifestSizes.map(size => ({
            src: `/icon-${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
        })),
        display: 'standalone',
    };
    const readme = [
        'Copy these files to the root of your site, then add to <head>:',
        '',
        '<link rel="icon" href="/favicon.ico" sizes="any">',
        `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
        '<link rel="manifest" href="/site.webmanifest">',
        '',
    ].join('\n');

    return {
        appleTouch,
        manifestIcons,
        manifest: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
        readme: Buffer.from(readme, 'utf8'),
    };
}

function faviconPackEntries(
    icon: Buffer,
    assets: Awaited<ReturnType<typeof buildFaviconPackAssets>>
): ZipEntry[] {
    return [
        { name: 'favicon.ico', data: icon },
        { name: 'apple-touch-icon.png', data: assets.appleTouch },
        ...assets.manifestIcons.map((data, index) => ({
            name: `icon-${FAVICON_PACK.manifestSizes[index]}.png`,
            data,
        })),
        { name: 'site.webmanifest', data: assets.manifest },
        { name: 'README.txt', data: assets.readme },
    ];
}

export async function convertPipeline(
    source: SourceImage<ConvertSource>,
    { target, keepMetadata, ico }: ConvertParams
): Promise<PipelineOutput> {
    const { buffer, baseName, format: from, metadata } = source;

    if (target === from) throw fail({ code: 'same_format' });

    if (target === 'base64') {
        const bytes = await base64Bytes(buffer, from, metadata, keepMetadata);
        const dataUri = `data:${IMAGE_FORMATS[from].mimeType};base64,${bytes.toString('base64')}`;
        const { extension, mimeType } = IMAGE_FORMATS.base64;

        return {
            data: Buffer.from(dataUri, 'utf8'),
            filename: `${baseName}-base64.${extension}`,
            mimeType,
        };
    }

    if (target === 'svg') {
        let pipeline = decode(buffer).png();

        if (keepMetadata) pipeline = pipeline.keepMetadata();

        const { data: png, info } = await pipeline.toBuffer({ resolveWithObject: true });
        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
            `width="${info.width}" height="${info.height}" viewBox="0 0 ${info.width} ${info.height}">` +
            `<image width="${info.width}" height="${info.height}" ` +
            `xlink:href="data:image/png;base64,${png.toString('base64')}"/>` +
            `</svg>`;
        const { extension, mimeType } = IMAGE_FORMATS.svg;

        return {
            data: Buffer.from(svg, 'utf8'),
            filename: `${baseName}.${extension}`,
            mimeType,
        };
    }

    if (target === 'ico') {
        if (!ico) throw fail({ code: 'invalid_settings' });

        if (ico.pack === 'false') {
            const icon = await buildIco(buffer, ico.sizes);
            const { extension, mimeType } = IMAGE_FORMATS.ico;

            return { data: icon, filename: `${baseName}.${extension}`, mimeType };
        }

        const [icon, assets] = await Promise.all([
            buildIco(buffer, ico.sizes),
            buildFaviconPackAssets(buffer, baseName),
        ]);

        return {
            data: createZip(faviconPackEntries(icon, assets)),
            filename: `${baseName}-favicons.zip`,
            mimeType: ZIP_MIME_TYPE,
        };
    }

    let pipeline = decode(buffer);

    if (target === 'jpeg') pipeline = pipeline.flatten({ background: '#ffffff' });

    pipeline = pipeline.toFormat(target);

    if (keepMetadata) pipeline = pipeline.keepMetadata();

    const data = await pipeline.toBuffer();
    const { extension, mimeType } = IMAGE_FORMATS[target];

    return { data, filename: `${baseName}.${extension}`, mimeType };
}
