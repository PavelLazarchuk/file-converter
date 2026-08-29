import type { ActionFile } from './actions';
import { IMAGE_FORMATS, MAX_INPUT_PIXELS, type ConvertTarget } from './image';

export const LOCAL_MAX_FILE_SIZE = 2 * 1024 * 1024;
export const LOCAL_MAX_FILE_SIZE_LABEL = '2MB';

export const LOCAL_CODEC_KEYS = ['jpeg', 'png', 'webp'] as const;

export type LocalCodec = (typeof LOCAL_CODEC_KEYS)[number];

const WASM_PATH = '/wasm';

const SIGNATURES: { codec: LocalCodec; bytes: number[]; at: number }[] = [
    { codec: 'jpeg', bytes: [0xff, 0xd8, 0xff], at: 0 },
    { codec: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], at: 0 },
    { codec: 'webp', bytes: [0x57, 0x45, 0x42, 0x50], at: 8 },
];

export function sniffCodec(bytes: Uint8Array): LocalCodec | null {
    for (const { codec, bytes: signature, at } of SIGNATURES) {
        if (signature.every((byte, index) => bytes[at + index] === byte)) return codec;
    }

    return null;
}

export function isLocalCodec(format: string): format is LocalCodec {
    return (LOCAL_CODEC_KEYS as readonly string[]).includes(format);
}

export function localCodecSupported(): boolean {
    return typeof WebAssembly !== 'undefined' && typeof fetch === 'function';
}

export type LocalSource = { file: File; width?: number; height?: number };

export function fitsLocalBudget({ file, width, height }: LocalSource): boolean {
    if (file.size <= 0 || file.size > LOCAL_MAX_FILE_SIZE) return false;

    return !width || !height || width * height <= MAX_INPUT_PIXELS;
}

const started = new Map<string, Promise<unknown>>();

function once(key: string, start: () => Promise<unknown>): Promise<unknown> {
    const running =
        started.get(key) ??
        start().catch((error: unknown) => {
            started.delete(key);

            throw error;
        });

    started.set(key, running);

    return running;
}

const emscripten = { locateFile: (path: string) => `${WASM_PATH}/${path}` };

async function decoder(codec: LocalCodec) {
    if (codec === 'jpeg') {
        const codecModule = await import('@jsquash/jpeg/decode');

        await once('jpeg.dec', async () => codecModule.init(emscripten));

        return codecModule.default;
    }

    if (codec === 'png') {
        const codecModule = await import('@jsquash/png/decode');

        await once('png.dec', () => codecModule.init(`${WASM_PATH}/squoosh_png_bg.wasm`));

        return codecModule.default;
    }

    const codecModule = await import('@jsquash/webp/decode');

    await once('webp.dec', async () => codecModule.init(emscripten));

    return codecModule.default;
}

async function encoder(codec: LocalCodec) {
    if (codec === 'jpeg') {
        const codecModule = await import('@jsquash/jpeg/encode');

        await once('jpeg.enc', async () => codecModule.init(emscripten));

        return (image: ImageData, quality: number) => codecModule.default(image, { quality });
    }

    if (codec === 'png') {
        const codecModule = await import('@jsquash/png/encode');

        await once('png.enc', () => codecModule.init(`${WASM_PATH}/squoosh_png_bg.wasm`));

        return (image: ImageData) => codecModule.default(image);
    }

    const codecModule = await import('@jsquash/webp/encode');

    await once('webp.enc', async () => codecModule.init(emscripten));

    return (image: ImageData, quality: number) => codecModule.default(image, { quality });
}

async function reencode(
    bytes: Uint8Array,
    target: LocalCodec,
    quality: number
): Promise<Uint8Array> {
    const source = sniffCodec(bytes);

    if (!source) throw new Error('unrecognised codec');

    const decode = await decoder(source);
    const encode = await encoder(target);
    const image = await decode(bytes.buffer as ArrayBuffer);

    return new Uint8Array(await encode(image, quality));
}

function produced(file: File, data: Uint8Array, target: ConvertTarget, name: string): ActionFile {
    return {
        data,
        filename: name,
        mimeType: IMAGE_FORMATS[target].mimeType,
        originalSize: file.size,
    };
}

function baseName(filename: string): string {
    return filename.replace(/\.[^.]+$/, '') || 'image';
}

export function localCompressible(
    source: LocalSource,
    bytes: Uint8Array,
    mode: string
): LocalCodec | null {
    if (mode !== 'quality' || !localCodecSupported() || !fitsLocalBudget(source)) return null;

    const codec = sniffCodec(bytes);

    return codec === 'png' ? null : codec;
}

export function localConvertible(
    source: LocalSource,
    bytes: Uint8Array,
    target: ConvertTarget,
    keepMetadata: boolean
): LocalCodec | null {
    if (keepMetadata || !isLocalCodec(target)) return null;
    if (!localCodecSupported() || !fitsLocalBudget(source)) return null;

    const codec = sniffCodec(bytes);

    return codec && codec !== target ? target : null;
}

export async function compressLocally(
    source: LocalSource,
    quality: number,
    mode: string
): Promise<ActionFile | null> {
    const { file } = source;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const codec = localCompressible(source, bytes, mode);

    if (!codec) return null;

    const data = await reencode(bytes, codec, quality);
    const { extension } = IMAGE_FORMATS[codec];

    return produced(file, data, codec, `${baseName(file.name)}-compressed.${extension}`);
}

export async function convertLocally(
    source: LocalSource,
    target: ConvertTarget,
    quality: number,
    keepMetadata: boolean
): Promise<ActionFile | null> {
    const { file } = source;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const codec = localConvertible(source, bytes, target, keepMetadata);

    if (!codec) return null;

    const data = await reencode(bytes, codec, quality);

    return produced(file, data, codec, `${baseName(file.name)}.${IMAGE_FORMATS[codec].extension}`);
}
