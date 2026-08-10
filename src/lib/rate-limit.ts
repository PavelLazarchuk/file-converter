import { headers } from 'next/headers';

export const RATE_LIMIT = { requests: 30, windowMs: 60_000 } as const;

const MAX_TRACKED_CLIENTS = 5000;

const buckets = new Map<string, number[]>();

async function clientKey(): Promise<string | null> {
    let headerList: Awaited<ReturnType<typeof headers>>;

    try {
        headerList = await headers();
    } catch {
        return null;
    }

    const forwarded = headerList.get('x-forwarded-for');

    return (
        forwarded?.split(',')[0]?.trim() ||
        headerList.get('x-real-ip')?.trim() ||
        headerList.get('cf-connecting-ip')?.trim() ||
        null
    );
}

function sweep(now: number): void {
    for (const [key, hits] of buckets) {
        const kept = hits.filter(hit => now - hit < RATE_LIMIT.windowMs);

        if (kept.length) buckets.set(key, kept);
        else buckets.delete(key);
    }
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export async function checkRateLimit(): Promise<RateLimitResult> {
    const key = await clientKey();

    if (key === null) return { allowed: true };

    const now = Date.now();

    if (buckets.size > MAX_TRACKED_CLIENTS) sweep(now);

    const hits = (buckets.get(key) ?? []).filter(hit => now - hit < RATE_LIMIT.windowMs);

    if (hits.length >= RATE_LIMIT.requests) {
        const oldest = hits[0] ?? now;

        buckets.set(key, hits);

        return {
            allowed: false,
            retryAfterSeconds: Math.max(
                1,
                Math.ceil((RATE_LIMIT.windowMs - (now - oldest)) / 1000)
            ),
        };
    }

    hits.push(now);
    buckets.set(key, hits);

    return { allowed: true };
}
