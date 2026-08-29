import { describe, expect, it } from 'vitest';

import { healthReport, healthStatus, healthStatusCode, HEALTH_PROBE_KEYS } from './health';
import { MAX_BATCH_BYTES, MAX_BATCH_FILES, MAX_FILE_SIZE, MAX_PDF_PAGES } from './image';
import { RATE_LIMIT } from './rate-limit';
import { TOOLS } from './site';

describe('the health report', () => {
    it('runs every probe and reports the image and PDF stacks as usable', async () => {
        const report = await healthReport();

        expect(report.probes.map(probe => probe.name)).toEqual([...HEALTH_PROBE_KEYS]);
        expect(report.probes.every(probe => probe.ok)).toBe(true);
        expect(report.status).toBe('ok');
    });

    it('publishes the limits the tools actually enforce', async () => {
        const { limits, tools } = await healthReport();

        expect(limits).toEqual({
            maxFileBytes: MAX_FILE_SIZE,
            maxBatchFiles: MAX_BATCH_FILES,
            maxBatchBytes: MAX_BATCH_BYTES,
            maxPdfPages: MAX_PDF_PAGES,
            rateLimitImages: RATE_LIMIT.images,
            rateLimitWindowMs: RATE_LIMIT.windowMs,
        });
        expect(tools).toBe(TOOLS.length);
    });

    it('timestamps the answer and never caches an uptime of nothing', async () => {
        const report = await healthReport();

        expect(Number.isNaN(Date.parse(report.timestamp))).toBe(false);
        expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('turns a single failed probe into a degraded 503', () => {
        const probes = [
            { name: 'sharp' as const, ok: true, durationMs: 1 },
            { name: 'pdf' as const, ok: false, durationMs: 1 },
        ];

        expect(healthStatus(probes)).toBe('degraded');
        expect(healthStatusCode({ status: healthStatus(probes) })).toBe(503);
        expect(healthStatusCode({ status: 'ok' })).toBe(200);
    });
});
