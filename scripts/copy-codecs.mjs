import { copyFile, cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = join(root, 'node_modules');

const TARGETS = [
    {
        dir: join(root, 'public', 'wasm'),
        files: [
            '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm',
            '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm',
            '@jsquash/png/codec/pkg/squoosh_png_bg.wasm',
            '@jsquash/webp/codec/dec/webp_dec.wasm',
            '@jsquash/webp/codec/enc/webp_enc.wasm',
            '@jsquash/webp/codec/enc/webp_enc_simd.wasm',
        ],
        dirs: [],
    },
    {
        dir: join(root, 'public', 'pdfjs'),
        files: ['pdfjs-dist/build/pdf.worker.min.mjs'],
        dirs: [
            'pdfjs-dist/cmaps',
            'pdfjs-dist/standard_fonts',
            'pdfjs-dist/wasm',
            'pdfjs-dist/iccs',
        ],
    },
];

const check = process.argv.includes('--check');

function basename(source) {
    return source.slice(source.lastIndexOf('/') + 1);
}

async function present(dir) {
    try {
        return new Set(await readdir(dir));
    } catch {
        return new Set();
    }
}

if (check) {
    const missing = [];

    for (const { dir, files, dirs } of TARGETS) {
        const found = await present(dir);

        for (const name of [...files, ...dirs].map(basename)) {
            if (!found.has(name)) missing.push(join(dir, name).slice(root.length + 1));
        }
    }

    if (missing.length) {
        console.error(`Missing browser assets: ${missing.join(', ')}`);
        process.exit(1);
    }

    console.log('public/wasm and public/pdfjs carry every browser asset.');
    process.exit(0);
}

let copied = 0;

for (const { dir, files, dirs } of TARGETS) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });

    for (const source of files) {
        await copyFile(join(modules, source), join(dir, basename(source)));
        copied += 1;
    }

    for (const source of dirs) {
        await cp(join(modules, source), join(dir, basename(source)), { recursive: true });
        copied += 1;
    }
}

console.log(`Copied ${copied} browser assets into public/wasm and public/pdfjs.`);
