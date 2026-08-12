import { describe, expect, it } from 'vitest';

import sitemap from '@/app/sitemap';
import { SITE, TOOLS, toolTransitionName } from './site';

describe('site metadata', () => {
    it('has an absolute url without a trailing slash', () => {
        expect(SITE.url).toMatch(/^https?:\/\//);
        expect(SITE.url.endsWith('/')).toBe(false);
    });
});

describe('the tool list', () => {
    it('gives every tool a unique route, a title and a description', () => {
        const hrefs = TOOLS.map(tool => tool.href);

        expect(new Set(hrefs).size).toBe(hrefs.length);

        for (const tool of TOOLS) {
            expect(tool.href.startsWith('/')).toBe(true);
            expect(tool.title.length).toBeGreaterThan(0);
            expect(tool.description.length).toBeGreaterThan(0);
        }
    });
});

describe('view transition names', () => {
    it('turns every tool route into a distinct CSS ident', () => {
        const names = TOOLS.flatMap(tool => [
            toolTransitionName('icon', tool.href),
            toolTransitionName('title', tool.href),
        ]);

        expect(new Set(names).size).toBe(names.length);

        for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    it('pairs the landing card with the page it opens', () => {
        expect(toolTransitionName('icon', '/resize')).toBe('tool-icon-resize');
        expect(toolTransitionName('title', '/resize')).toBe('tool-title-resize');
    });
});

describe('sitemap', () => {
    it('lists the home page, every tool and the privacy page', () => {
        const urls = sitemap().map(entry => entry.url);

        expect(urls[0]).toBe(SITE.url);
        expect(urls).toContain(`${SITE.url}/privacy`);

        for (const tool of TOOLS) expect(urls).toContain(`${SITE.url}${tool.href}`);

        expect(new Set(urls).size).toBe(urls.length);
    });
});
