import type { NextConfig } from 'next';

import {
    CROSS_ORIGIN_ASSET_PATH,
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
    },
    async headers() {
        return [
            { source: '/:path*', headers: securityHeaders(isDev) },
            { source: CROSS_ORIGIN_ASSET_PATH, headers: crossOriginAssetHeaders() },
        ];
    },
};

export default nextConfig;
