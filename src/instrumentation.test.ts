import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cache = vi.fn();
const concurrency = vi.fn<(threads?: number) => number>(() => 1);

vi.mock('sharp', () => ({ default: { cache, concurrency } }));

const originalRuntime = process.env.NEXT_RUNTIME;
const originalConcurrency = process.env.SHARP_CONCURRENCY;

async function register() {
    vi.resetModules();

    const instrumentation = await import('./instrumentation');

    await instrumentation.register();
}

beforeEach(() => {
    cache.mockClear();
    concurrency.mockClear();
    process.env.NEXT_RUNTIME = 'nodejs';
    delete process.env.SHARP_CONCURRENCY;
});

afterEach(() => {
    if (originalRuntime === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = originalRuntime;

    if (originalConcurrency === undefined) delete process.env.SHARP_CONCURRENCY;
    else process.env.SHARP_CONCURRENCY = originalConcurrency;
});

describe('register', () => {
    it('disables the libvips operation cache and pins the thread pool', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});

        await register();

        expect(cache).toHaveBeenCalledWith(false);
        expect(concurrency).toHaveBeenCalledWith(1);
    });

    it('honours SHARP_CONCURRENCY when it is a positive integer', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        process.env.SHARP_CONCURRENCY = '4';

        await register();

        expect(concurrency).toHaveBeenCalledWith(4);
    });

    it.each(['0', '-2', 'many', '1.5', ''])('falls back to 1 for %j', async value => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        process.env.SHARP_CONCURRENCY = value;

        await register();

        expect(concurrency).toHaveBeenCalledWith(1);
    });

    it('does nothing outside the node runtime', async () => {
        process.env.NEXT_RUNTIME = 'edge';

        await register();

        expect(cache).not.toHaveBeenCalled();
        expect(concurrency).not.toHaveBeenCalled();
    });
});
