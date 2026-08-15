export type SvgThreat = 'entity' | 'external_reference';

const SNIFF_BYTES = 2048;

const SCHEME_PREFIX = 64;

const SVG_SNIFF_PATTERN = /<svg[\s>]|<\?xml[\s?]/i;
const ENTITY_PATTERN = /<!ENTITY/i;
const HREF_PATTERN = new RegExp(
    String.raw`(?:xlink:)?href\s*=\s*["']([^"']{0,${SCHEME_PREFIX}})`,
    'gi'
);
const REFERENCE_PATTERNS = [
    new RegExp(String.raw`url\(\s*["']?([^"')]{0,${SCHEME_PREFIX}})`, 'gi'),
    new RegExp(String.raw`@import\s+(?:url\(\s*)?["']?([^"')\s]{0,${SCHEME_PREFIX}})`, 'gi'),
];

const LINK_ELEMENT = 'a';

const decoder = new TextDecoder('utf-8', { fatal: false });

function isBinary(buffer: Uint8Array): boolean {
    return buffer.subarray(0, SNIFF_BYTES).includes(0);
}

export function looksLikeSvg(buffer: Uint8Array): boolean {
    return !isBinary(buffer) && SVG_SNIFF_PATTERN.test(decoder.decode(buffer));
}

function isLocalReference(value: string): boolean {
    const target = value.trim();

    if (!target) return true;

    return target.startsWith('#') || /^data:/i.test(target);
}

function enclosingElement(markup: string, at: number): string {
    const open = markup.lastIndexOf('<', at);

    if (open === -1) return '';

    return /^<\s*([a-zA-Z][\w:.-]*)/.exec(markup.slice(open, open + 40))?.[1].toLowerCase() ?? '';
}

export function svgThreat(markup: string): SvgThreat | null {
    if (ENTITY_PATTERN.test(markup)) return 'entity';

    HREF_PATTERN.lastIndex = 0;

    for (let match = HREF_PATTERN.exec(markup); match; match = HREF_PATTERN.exec(markup)) {
        if (enclosingElement(markup, match.index) === LINK_ELEMENT) continue;

        if (!isLocalReference(match[1])) return 'external_reference';
    }

    for (const pattern of REFERENCE_PATTERNS) {
        pattern.lastIndex = 0;

        for (let match = pattern.exec(markup); match; match = pattern.exec(markup)) {
            if (!isLocalReference(match[1])) return 'external_reference';
        }
    }

    return null;
}

export function inspectSvg(buffer: Uint8Array): SvgThreat | null {
    if (isBinary(buffer)) return null;

    const markup = decoder.decode(buffer);

    return SVG_SNIFF_PATTERN.test(markup) ? svgThreat(markup) : null;
}
