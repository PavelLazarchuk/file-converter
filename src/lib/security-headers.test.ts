import { describe, expect, it } from 'vitest';

import {
    CROSS_ORIGIN_ASSET_PATH,
    contentSecurityPolicy,
    crossOriginAssetHeaders,
    securityHeaders,
} from './security-headers';

function directives(policy: string): Map<string, string[]> {
    return new Map(
        policy.split('; ').map(entry => {
            const [name, ...values] = entry.split(' ');

            return [name, values] as const;
        })
    );
}

describe('contentSecurityPolicy', () => {
    it('locks down the dangerous sinks in production', () => {
        const parsed = directives(contentSecurityPolicy(false));

        expect(parsed.get('default-src')).toEqual(["'self'"]);
        expect(parsed.get('object-src')).toEqual(["'none'"]);
        expect(parsed.get('frame-ancestors')).toEqual(["'none'"]);
        expect(parsed.get('base-uri')).toEqual(["'self'"]);
        expect(parsed.get('form-action')).toEqual(["'self'"]);
        expect(parsed.has('upgrade-insecure-requests')).toBe(true);
    });

    it('allows the blob and data previews the result card renders', () => {
        const parsed = directives(contentSecurityPolicy(false));

        expect(parsed.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    });

    it('keeps every production source same-origin', () => {
        const policy = contentSecurityPolicy(false);

        expect(policy).not.toContain('vercel-scripts.com');
        expect(policy).not.toContain('localhost');
        expect(policy).not.toContain("'unsafe-eval'");
    });

    it('opens up eval, websockets and the debug script only in development', () => {
        const parsed = directives(contentSecurityPolicy(true));

        expect(parsed.get('script-src')).toContain("'unsafe-eval'");
        expect(parsed.get('script-src')).toContain('https://va.vercel-scripts.com');
        expect(parsed.get('connect-src')).toContain('ws://localhost:*');
        expect(parsed.has('upgrade-insecure-requests')).toBe(false);
    });

    it('inlines scripts and styles, which Next and the pre-paint theme script need', () => {
        const parsed = directives(contentSecurityPolicy(false));

        expect(parsed.get('script-src')).toContain("'unsafe-inline'");
        expect(parsed.get('style-src')).toContain("'unsafe-inline'");
    });
});

describe('securityHeaders', () => {
    it('sends HSTS in production only', () => {
        const production = securityHeaders(false).map(header => header.key);
        const development = securityHeaders(true).map(header => header.key);

        expect(production).toContain('Strict-Transport-Security');
        expect(development).not.toContain('Strict-Transport-Security');
    });

    it('sets nosniff, which matters for the files this app hands back', () => {
        const nosniff = securityHeaders(false).find(
            header => header.key === 'X-Content-Type-Options'
        );

        expect(nosniff?.value).toBe('nosniff');
    });

    it('never repeats a header key', () => {
        const keys = securityHeaders(false).map(header => header.key);

        expect(new Set(keys).size).toBe(keys.length);
    });

    it.each([
        ['Cross-Origin-Opener-Policy', 'same-origin'],
        ['Cross-Origin-Resource-Policy', 'same-origin'],
    ])('isolates the page with %s', (key, value) => {
        expect(securityHeaders(false).find(header => header.key === key)?.value).toBe(value);
        expect(securityHeaders(true).find(header => header.key === key)?.value).toBe(value);
    });
});

describe('crossOriginAssetHeaders', () => {
    it('re-opens CORP for the opengraph image only', () => {
        expect(crossOriginAssetHeaders()).toEqual([
            { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ]);
        expect(CROSS_ORIGIN_ASSET_PATH).toBe('/opengraph-image');
    });

    it('overrides the key the site-wide rule sets, so the last rule wins', () => {
        const siteWide = securityHeaders(false).map(header => header.key);

        expect(siteWide).toContain(crossOriginAssetHeaders()[0].key);
    });
});
