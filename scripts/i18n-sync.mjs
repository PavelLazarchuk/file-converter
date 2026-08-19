#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIRECTORY = join(process.cwd(), 'messages');
const SOURCE = 'en';
const MARKER = process.env.I18N_MARKER ?? 'TODO: ';
const check = process.argv.includes('--check');

const read = locale => JSON.parse(readFileSync(join(DIRECTORY, `${locale}.json`), 'utf8'));

function merge(source, target, path = '') {
    const result = {};
    const added = [];
    const removed = [];

    for (const [key, value] of Object.entries(source)) {
        const at = path ? `${path}.${key}` : key;
        const current = target?.[key];

        if (typeof value === 'string') {
            if (typeof current === 'string') {
                result[key] = current;
            } else {
                result[key] = `${MARKER}${value}`;
                added.push(at);
            }

            continue;
        }

        const nested = merge(value, typeof current === 'object' ? current : {}, at);

        result[key] = nested.result;
        added.push(...nested.added);
        removed.push(...nested.removed);
    }

    for (const key of Object.keys(target ?? {})) {
        if (!(key in source)) removed.push(path ? `${path}.${key}` : key);
    }

    return { result, added, removed };
}

const source = read(SOURCE);
const locales = readdirSync(DIRECTORY)
    .filter(name => name.endsWith('.json') && name !== `${SOURCE}.json`)
    .map(name => name.replace(/\.json$/, ''));

let drift = false;

for (const locale of locales) {
    const { result, added, removed } = merge(source, read(locale));

    if (!added.length && !removed.length) {
        console.log(`${locale}: up to date`);
        continue;
    }

    drift = true;
    console.log(`${locale}: +${added.length} missing, -${removed.length} stray`);
    for (const key of added) console.log(`  + ${key}`);
    for (const key of removed) console.log(`  - ${key}`);

    if (!check)
        writeFileSync(join(DIRECTORY, `${locale}.json`), `${JSON.stringify(result, null, 4)}\n`);
}

if (!locales.length) console.log(`only ${SOURCE}.json exists — nothing to sync`);
if (check && drift) process.exit(1);
