import { headers } from 'next/headers';

export const RATE_LIMIT = { images: 40, windowMs: 60_000 } as const;

const MAX_TRACKED_CLIENTS = 2000;

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

export async function checkRateLimit(cost = 1): Promise<RateLimitResult> {
    const key = await clientKey();

    if (key === null) return { allowed: true };

    const now = Date.now();

    if (buckets.size > MAX_TRACKED_CLIENTS) sweep(now);

    const charge = Math.max(1, Math.round(cost));
    const hits = (buckets.get(key) ?? []).filter(hit => now - hit < RATE_LIMIT.windowMs);
    const overflow = hits.length + charge - RATE_LIMIT.images;

    if (overflow > 0) {
        const blocking = hits[Math.min(overflow, hits.length) - 1] ?? now;

        buckets.set(key, hits);

        return {
            allowed: false,
            retryAfterSeconds: Math.max(
                1,
                Math.ceil((RATE_LIMIT.windowMs - (now - blocking)) / 1000)
            ),
        };
    }

    for (let index = 0; index < charge; index += 1) hits.push(now);

    buckets.set(key, hits);

    return { allowed: true };
}
