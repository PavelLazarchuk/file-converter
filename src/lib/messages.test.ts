import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { routing } from '@/i18n/routing';
import { messages as english } from '@/test/messages';

const DIRECTORY = join(process.cwd(), 'messages');

type Tree = { [key: string]: string | Tree };

function load(locale: string): Tree {
    return JSON.parse(readFileSync(join(DIRECTORY, `${locale}.json`), 'utf8')) as Tree;
}

function flatten(tree: Tree, prefix = ''): string[] {
    return Object.entries(tree).flatMap(([key, value]) =>
        typeof value === 'string' ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`)
    );
}

function values(tree: Tree): string[] {
    return Object.values(tree).flatMap(value =>
        typeof value === 'string' ? [value] : values(value)
    );
}

const catalogs = readdirSync(DIRECTORY)
    .filter(name => name.endsWith('.json'))
    .map(name => name.replace(/\.json$/, ''));

describe('the message catalogs', () => {
    it('ships one file per configured locale, and nothing else', () => {
        expect(catalogs.sort()).toEqual([...routing.locales].sort());
    });

    it.each(catalogs)('gives %s exactly the keys English has', locale => {
        const expected = flatten(english as unknown as Tree).sort();
        const actual = flatten(load(locale)).sort();

        expect(actual).toEqual(expected);
    });

    it.each(catalogs)('leaves no empty string in %s', locale => {
        for (const value of values(load(locale))) expect(value.trim().length).toBeGreaterThan(0);
    });
});
