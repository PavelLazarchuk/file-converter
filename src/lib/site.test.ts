import { describe, expect, it } from 'vitest';

import sitemap from '@/app/sitemap';
import { routing } from '@/i18n/routing';
import { translator } from '@/test/messages';
import {
    SITE,
    TOOLS,
    breadcrumbJsonLd,
    jsonLdScript,
    localeUrl,
    siteJsonLd,
    toolJsonLd,
    toolTransitionName,
    type Tool,
} from './site';

const tools = translator('Tools');
const site = translator('Site');

function copyOf(tool: Tool) {
    return {
        title: tools(`${tool.key}.title`),
        description: tools(`${tool.key}.description`),
    };
}

const siteCopy = {
    tagline: site('tagline'),
    description: site('description'),
    toolList: site('toolList'),
    tool: copyOf,
};

describe('site metadata', () => {
    it('has an absolute url without a trailing slash', () => {
        expect(SITE.url).toMatch(/^https?:\/\//);
        expect(SITE.url.endsWith('/')).toBe(false);
    });

    it('leaves the default locale unprefixed and prefixes the others', () => {
        expect(localeUrl(routing.defaultLocale, '/compress')).toBe(`${SITE.url}/compress`);
        expect(localeUrl(routing.defaultLocale)).toBe(SITE.url);
    });
});

describe('the tool list', () => {
    it('gives every tool a unique route and a translated title and description', () => {
        const hrefs = TOOLS.map(tool => tool.href);
        const keys = TOOLS.map(tool => tool.key);

        expect(new Set(hrefs).size).toBe(hrefs.length);
        expect(new Set(keys).size).toBe(keys.length);

        for (const tool of TOOLS) {
            expect(tool.href.startsWith('/')).toBe(true);
            expect(copyOf(tool).title.length).toBeGreaterThan(0);
            expect(copyOf(tool).description.length).toBeGreaterThan(0);
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
    it('lists the home page, every tool and the privacy page, in every locale', () => {
        const entries = sitemap();
        const urls = entries.map(entry => entry.url);

        expect(urls[0]).toBe(SITE.url);
        expect(urls).toContain(`${SITE.url}/privacy`);

        for (const locale of routing.locales) {
            for (const tool of TOOLS) expect(urls).toContain(localeUrl(locale, tool.href));
        }

        expect(new Set(urls).size).toBe(urls.length);
    });

    it('points every entry at its alternates', () => {
        for (const entry of sitemap()) {
            expect(Object.keys(entry.alternates?.languages ?? {})).toEqual([...routing.locales]);
        }
    });
});

describe('structured data', () => {
    it('describes every tool from the registry, with absolute urls', () => {
        for (const tool of TOOLS) {
            const copy = copyOf(tool);
            const data = toolJsonLd(tool, copy, routing.defaultLocale);

            expect(data['@type']).toBe('WebApplication');
            expect(data.url).toBe(localeUrl(routing.defaultLocale, tool.href));
            expect(data.description).toBe(copy.description);
            expect(data.name).toContain(copy.title);
            expect(data.inLanguage).toBe(routing.defaultLocale);
        }
    });

    it('never invents a rating or a review count', () => {
        for (const tool of TOOLS) {
            const data = toolJsonLd(tool, copyOf(tool), routing.defaultLocale);

            expect(data.aggregateRating).toBeUndefined();
            expect(data.review).toBeUndefined();
        }
    });

    it('builds a two-step breadcrumb from the site root to the tool', () => {
        const trail = breadcrumbJsonLd(
            TOOLS[0],
            { ...copyOf(TOOLS[0]), root: tools('allTools') },
            routing.defaultLocale
        ).itemListElement as Record<string, unknown>[];

        expect(trail.map(step => step.position)).toEqual([1, 2]);
        expect(trail[0].item).toBe(localeUrl(routing.defaultLocale));
        expect(trail[1].item).toBe(localeUrl(routing.defaultLocale, TOOLS[0].href));
        expect(trail[1].name).toBe(copyOf(TOOLS[0]).title);
    });

    it('lists every tool on the landing page, in registry order', () => {
        const [website, list] = siteJsonLd(siteCopy, routing.defaultLocale);
        const items = list.itemListElement as Record<string, unknown>[];

        expect(website['@type']).toBe('WebSite');
        expect(list.numberOfItems).toBe(TOOLS.length);
        expect(items.map(item => item.url)).toEqual(
            TOOLS.map(tool => localeUrl(routing.defaultLocale, tool.href))
        );
        expect(items.map(item => item.position)).toEqual(TOOLS.map((_, index) => index + 1));
    });

    it('escapes a closing tag so the payload cannot break out of the script element', () => {
        expect(jsonLdScript({ name: '</script><img onerror=alert(1)>' })).not.toContain('<');
        expect(jsonLdScript({ name: '</script>' })).toContain('\\u003c/script>');
    });

    it('stays parseable after escaping', () => {
        for (const block of siteJsonLd(siteCopy, routing.defaultLocale)) {
            expect(() => JSON.parse(jsonLdScript(block))).not.toThrow();
        }
    });
});
