import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import {
    CROSS_ORIGIN_ASSET_PATHS,
    crossOriginAssetHeaders,
    securityHeaders,
} from './src/lib/security-headers';

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    poweredByHeader: false,
    experimental: {
        serverActions: {
            bodySizeLimit: '25mb',
        },
        viewTransition: true,
        rootParams: true,
    },
    async headers() {
        return [
            { source: '/:path*', headers: securityHeaders(isDev) },
            ...CROSS_ORIGIN_ASSET_PATHS.map(source => ({
                source,
                headers: crossOriginAssetHeaders(),
            })),
        ];
    },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
