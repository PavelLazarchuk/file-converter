import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { TOOLS } from '@/lib/site';

const SEGMENT = 'src/app/[locale]';

function read(href: string, file: string): string {
    return readFileSync(`${SEGMENT}${href}/${file}`, 'utf8');
}

describe('every tool route', () => {
    it.each(TOOLS.map(tool => tool.href))(
        '%s raises the Server Action timeout above the platform default',
        href => {
            expect(read(href, 'page.tsx')).toMatch(/export const maxDuration = \d+;/);
        }
    );

    it.each(TOOLS.map(tool => tool.href))('%s renders its own opengraph image', href => {
        const source = read(href, 'opengraph-image.tsx');

        expect(source).toContain(`const PATH = '${href}';`);
        expect(source).toContain('renderToolOgImage(locale, PATH)');
    });
});
