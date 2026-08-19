import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            'next/navigation': 'next/navigation.js',
        },
    },
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['src/**/*.test.ts'],
                    exclude: ['src/**/*.dom.test.ts'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'dom',
                    environment: 'jsdom',
                    include: ['src/**/*.test.tsx', 'src/**/*.dom.test.ts'],
                    setupFiles: ['./vitest.setup.ts'],
                    server: { deps: { inline: ['next-intl'] } },
                },
            },
        ],
    },
});
