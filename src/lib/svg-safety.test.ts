import { describe, expect, it } from 'vitest';

import { inspectSvg, looksLikeSvg, svgThreat } from './svg-safety';

const encoder = new TextEncoder();

function bytes(markup: string): Uint8Array {
    return encoder.encode(markup);
}

const PLAIN = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect/></svg>';

describe('looksLikeSvg', () => {
    it.each([
        ['a bare svg root', PLAIN],
        ['an xml declaration first', `<?xml version="1.0"?>\n${PLAIN}`],
        ['a leading comment', `<!-- exported -->\n${PLAIN}`],
    ])('recognises %s', (_label, markup) => {
        expect(looksLikeSvg(bytes(markup))).toBe(true);
    });

    it('recognises a root element pushed past any leading window', () => {
        expect(looksLikeSvg(bytes(`<!--${'x'.repeat(4096)}-->${PLAIN}`))).toBe(true);
    });

    it('ignores binary formats so every other upload skips the scan', () => {
        expect(
            looksLikeSvg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00]))
        ).toBe(false);
    });
});

describe('svgThreat', () => {
    it('rejects an internal entity declaration', () => {
        const bomb = `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aa">]>${PLAIN}`;

        expect(svgThreat(bomb)).toBe('entity');
    });

    it('rejects entity declarations whatever their case', () => {
        expect(svgThreat(`<!DOCTYPE svg [<!entity a "aa">]>${PLAIN}`)).toBe('entity');
    });

    it('allows a DOCTYPE that declares no entities', () => {
        const legacy =
            '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" ' +
            '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' +
            PLAIN;

        expect(svgThreat(legacy)).toBeNull();
    });

    it.each([
        ['file://', '<image xlink:href="file:///etc/passwd" />'],
        ['http://', '<image xlink:href="http://169.254.169.254/latest/meta-data/" />'],
        ['a bare href', '<image href="http://example.test/x.png" />'],
        ['a relative path', '<image href="../../etc/passwd" />'],
        ['protocol-relative', '<image href="//example.test/x.png" />'],
        ['a css url()', '<style>rect { fill: url("http://example.test/x.png"); }</style>'],
        ['a css @import', '<style>@import url("file:///etc/passwd");</style>'],
    ])('rejects %s', (_label, fragment) => {
        expect(svgThreat(`<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`)).toBe(
            'external_reference'
        );
    });

    it.each([
        ['an https hyperlink', '<a xlink:href="https://example.test"><rect /></a>'],
        ['a bare href hyperlink', '<a href="https://example.test"><rect /></a>'],
        [
            'a hyperlink wrapping an embedded image',
            '<a href="https://example.test"><image href="data:image/png;base64,AAAA" /></a>',
        ],
        ['a mailto hyperlink', '<a xlink:href="mailto:someone@example.test"><rect /></a>'],
    ])('allows %s', (_label, fragment) => {
        expect(svgThreat(`<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`)).toBeNull();
    });

    it('still rejects a subresource that sits inside a hyperlink', () => {
        const nested =
            '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://example.test">' +
            '<image href="file:///etc/passwd" /></a></svg>';

        expect(svgThreat(nested)).toBe('external_reference');
    });

    it('is not fooled by a greater-than sign in an earlier attribute', () => {
        const smuggled =
            '<svg xmlns="http://www.w3.org/2000/svg">' +
            '<image title="a>b" href="file:///etc/passwd" /></svg>';

        expect(svgThreat(smuggled)).toBe('external_reference');
    });

    it('checks every href on an element, not just the first', () => {
        const twoHrefs =
            '<svg xmlns="http://www.w3.org/2000/svg">' +
            '<image href="#local" xlink:href="http://example.test/x.png" /></svg>';

        expect(svgThreat(twoHrefs)).toBe('external_reference');
    });

    it.each([
        ['a document fragment', '<use href="#glyph" />'],
        ['a css url() fragment', '<rect fill="url(#grad)" />'],
        ['an empty value', '<use href="" />'],
    ])('allows %s', (_label, fragment) => {
        expect(svgThreat(`<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`)).toBeNull();
    });

    it('allows an embedded data URI', () => {
        const embedded =
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
            `<image xlink:href="data:image/png;base64,${'A'.repeat(4096)}" /></svg>`;

        expect(svgThreat(embedded)).toBeNull();
    });

    it('reports the entity even when an external reference follows it', () => {
        const both = `<!DOCTYPE svg [<!ENTITY a "aa">]><svg><image href="http://example.test/x" /></svg>`;

        expect(svgThreat(both)).toBe('entity');
    });
});

describe('inspectSvg', () => {
    it('passes non-SVG uploads through untouched', () => {
        expect(inspectSvg(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    });

    it('flags a bomb that only declares its entities past the sniff window', () => {
        const padding = `<!--${'x'.repeat(4096)}-->`;
        const late = `<?xml version="1.0"?>${padding}<!DOCTYPE svg [<!ENTITY a "aa">]>${PLAIN}`;

        expect(inspectSvg(bytes(late))).toBe('entity');
    });

    it('flags a bomb hidden behind padding that has no XML declaration in front of it', () => {
        const padded = `<!--${'x'.repeat(4096)}--><!DOCTYPE svg [<!ENTITY a "aa">]>${PLAIN}`;

        expect(inspectSvg(bytes(padded))).toBe('entity');
    });

    it('accepts an ordinary SVG', () => {
        expect(inspectSvg(bytes(PLAIN))).toBeNull();
    });
});
