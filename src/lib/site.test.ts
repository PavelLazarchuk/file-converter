import { describe, expect, it } from 'vitest';

import sitemap from '@/app/sitemap';
import {
    SITE,
    TOOLS,
    breadcrumbJsonLd,
    jsonLdScript,
    siteJsonLd,
    toolJsonLd,
    toolTransitionName,
} from './site';

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

describe('structured data', () => {
    it('describes every tool from the registry, with absolute urls', () => {
        for (const tool of TOOLS) {
            const data = toolJsonLd(tool);

            expect(data['@type']).toBe('WebApplication');
            expect(data.url).toBe(`${SITE.url}${tool.href}`);
            expect(data.description).toBe(tool.description);
            expect(data.name).toContain(tool.title);
        }
    });

    it('never invents a rating or a review count', () => {
        for (const tool of TOOLS) {
            const data = toolJsonLd(tool);

            expect(data.aggregateRating).toBeUndefined();
            expect(data.review).toBeUndefined();
        }
    });

    it('builds a two-step breadcrumb from the site root to the tool', () => {
        const trail = breadcrumbJsonLd(TOOLS[0]).itemListElement as Record<string, unknown>[];

        expect(trail.map(step => step.position)).toEqual([1, 2]);
        expect(trail[0].item).toBe(SITE.url);
        expect(trail[1].item).toBe(`${SITE.url}${TOOLS[0].href}`);
        expect(trail[1].name).toBe(TOOLS[0].title);
    });

    it('lists every tool on the landing page, in registry order', () => {
        const [website, list] = siteJsonLd();
        const items = list.itemListElement as Record<string, unknown>[];

        expect(website['@type']).toBe('WebSite');
        expect(list.numberOfItems).toBe(TOOLS.length);
        expect(items.map(item => item.url)).toEqual(TOOLS.map(tool => `${SITE.url}${tool.href}`));
        expect(items.map(item => item.position)).toEqual(TOOLS.map((_, index) => index + 1));
    });

    it('escapes a closing tag so the payload cannot break out of the script element', () => {
        expect(jsonLdScript({ name: '</script><img onerror=alert(1)>' })).not.toContain('<');
        expect(jsonLdScript({ name: '</script>' })).toContain('\\u003c/script>');
    });

    it('stays parseable after escaping', () => {
        for (const block of siteJsonLd()) {
            expect(() => JSON.parse(jsonLdScript(block))).not.toThrow();
        }
    });
});
