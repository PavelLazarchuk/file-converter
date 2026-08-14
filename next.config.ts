import type { NextConfig } from 'next';

import { securityHeaders } from './src/lib/security-headers';

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    experimental: {
        serverActions: {
            bodySizeLimit: '25mb',
        },
        viewTransition: true,
    },
    async headers() {
        return [{ source: '/:path*', headers: securityHeaders(isDev) }];
    },
};

export default nextConfig;
