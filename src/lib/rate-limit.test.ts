import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = { headers: new Map<string, string>(), throws: false };

vi.mock('next/headers', () => ({
    headers: async () => {
        if (state.throws) throw new Error('`headers` was called outside a request scope');

        return { get: (name: string) => state.headers.get(name) ?? null };
    },
}));

async function loadLimiter() {
    vi.resetModules();

    return import('./rate-limit');
}

beforeEach(() => {
    state.headers = new Map([['x-forwarded-for', '203.0.113.7']]);
    state.throws = false;
});

afterEach(() => {
    vi.useRealTimers();
});

describe('client identification', () => {
    it('fails open when there is no request scope, so tests can call actions directly', async () => {
        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        state.throws = true;

        for (let index = 0; index < RATE_LIMIT.images + 5; index += 1) {
            expect(await checkRateLimit()).toEqual({ allowed: true });
        }
    });

    it('fails open when no header identifies the client', async () => {
        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        state.headers = new Map();

        for (let index = 0; index < RATE_LIMIT.images + 5; index += 1) {
            expect(await checkRateLimit()).toEqual({ allowed: true });
        }
    });

    it('takes the first entry of x-forwarded-for', async () => {
        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        state.headers = new Map([['x-forwarded-for', '198.51.100.1, 10.0.0.1']]);

        for (let index = 0; index < RATE_LIMIT.images; index += 1) await checkRateLimit();

        expect(await checkRateLimit()).toMatchObject({ allowed: false });

        state.headers = new Map([['x-forwarded-for', '198.51.100.2, 10.0.0.1']]);
        expect(await checkRateLimit()).toEqual({ allowed: true });
    });

    it('falls back to x-real-ip and cf-connecting-ip', async () => {
        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        for (const header of ['x-real-ip', 'cf-connecting-ip']) {
            state.headers = new Map([[header, `client-${header}`]]);

            for (let index = 0; index < RATE_LIMIT.images; index += 1) await checkRateLimit();

            expect(await checkRateLimit()).toMatchObject({ allowed: false });
        }
    });
});

describe('the budget', () => {
    it('allows the whole budget and then denies', async () => {
        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        for (let index = 0; index < RATE_LIMIT.images; index += 1) {
            expect(await checkRateLimit()).toEqual({ allowed: true });
        }

        const denied = await checkRateLimit();

        expect(denied.allowed).toBe(false);
        expect(denied.allowed === false && denied.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('charges a batch once per image', async () => {
        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        expect(await checkRateLimit(RATE_LIMIT.images - 1)).toEqual({ allowed: true });
        expect(await checkRateLimit()).toEqual({ allowed: true });
        expect(await checkRateLimit()).toMatchObject({ allowed: false });
    });

    it('lets a full batch through on a clean bucket', async () => {
        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        expect(await checkRateLimit(RATE_LIMIT.images)).toEqual({ allowed: true });
        expect(await checkRateLimit()).toMatchObject({ allowed: false });
    });

    it('does not charge for a denied request', async () => {
        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        await checkRateLimit(RATE_LIMIT.images - 1);

        expect(await checkRateLimit(5)).toMatchObject({ allowed: false });
        expect(await checkRateLimit()).toEqual({ allowed: true });
    });

    it('treats a zero or negative cost as one image', async () => {
        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        for (let index = 0; index < RATE_LIMIT.images; index += 1) await checkRateLimit(0);

        expect(await checkRateLimit()).toMatchObject({ allowed: false });
    });
});

describe('the window', () => {
    it('frees the budget again once the window passes', async () => {
        vi.useFakeTimers();

        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        for (let index = 0; index < RATE_LIMIT.images; index += 1) await checkRateLimit();

        expect(await checkRateLimit()).toMatchObject({ allowed: false });

        vi.advanceTimersByTime(RATE_LIMIT.windowMs + 1);

        expect(await checkRateLimit()).toEqual({ allowed: true });
    });

    it('reports how long to wait for enough slots', async () => {
        vi.useFakeTimers();

        const { checkRateLimit, RATE_LIMIT } = await loadLimiter();

        await checkRateLimit(RATE_LIMIT.images);
        vi.advanceTimersByTime(RATE_LIMIT.windowMs / 2);

        const denied = await checkRateLimit();

        expect(denied.allowed).toBe(false);
        expect(denied.allowed === false && denied.retryAfterSeconds).toBe(
            RATE_LIMIT.windowMs / 2000
        );
    });
});
