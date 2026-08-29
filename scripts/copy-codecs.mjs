import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'wasm');

const CODECS = [
    '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm',
    '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm',
    '@jsquash/png/codec/pkg/squoosh_png_bg.wasm',
    '@jsquash/webp/codec/dec/webp_dec.wasm',
    '@jsquash/webp/codec/enc/webp_enc.wasm',
    '@jsquash/webp/codec/enc/webp_enc_simd.wasm',
];

const check = process.argv.includes('--check');

async function present() {
    try {
        return new Set(await readdir(target));
    } catch {
        return new Set();
    }
}

const expected = CODECS.map(source => source.slice(source.lastIndexOf('/') + 1));

if (check) {
    const found = await present();
    const missing = expected.filter(name => !found.has(name));

    if (missing.length) {
        console.error(`Missing codecs in public/wasm: ${missing.join(', ')}`);
        process.exit(1);
    }

    console.log(`public/wasm carries all ${expected.length} codecs.`);
    process.exit(0);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

for (const source of CODECS) {
    const from = join(root, 'node_modules', source);
    const name = source.slice(source.lastIndexOf('/') + 1);

    await copyFile(from, join(target, name));
}

console.log(`Copied ${CODECS.length} codecs into public/wasm.`);
