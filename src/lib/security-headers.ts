export type HeaderRule = { key: string; value: string };

const VERCEL_DEV_SCRIPTS = 'https://va.vercel-scripts.com';

export function contentSecurityPolicy(isDev: boolean): string {
    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'script-src': isDev
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", VERCEL_DEV_SCRIPTS]
            : ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': isDev
            ? ["'self'", VERCEL_DEV_SCRIPTS, 'ws://localhost:*', 'http://localhost:*']
            : ["'self'"],
        'manifest-src': ["'self'"],
    };

    const policy = Object.entries(directives).map(
        ([directive, values]) => `${directive} ${values.join(' ')}`
    );

    if (!isDev) policy.push('upgrade-insecure-requests');

    return policy.join('; ');
}

export function securityHeaders(isDev: boolean): HeaderRule[] {
    return [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy(isDev) },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
        },
        ...(isDev
            ? []
            : [
                  {
                      key: 'Strict-Transport-Security',
                      value: 'max-age=63072000; includeSubDomains',
                  },
              ]),
    ];
}
