import { Logger } from '@/lib/logger';

const DEFAULT_CONCURRENCY = 1;

function configuredConcurrency(): number {
    const value = Number(process.env.SHARP_CONCURRENCY);

    return Number.isInteger(value) && value > 0 ? value : DEFAULT_CONCURRENCY;
}

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    const { default: sharp } = await import('sharp');

    sharp.cache(false);
    sharp.concurrency(configuredConcurrency());

    Logger.info('sharp.configured', { cache: false, concurrency: sharp.concurrency() });
}
