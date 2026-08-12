import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    experimental: {
        serverActions: {
            bodySizeLimit: '25mb',
        },
        viewTransition: true,
    },
};

export default nextConfig;
