import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

import { MAX_BATCH_BYTES, MAX_BATCH_FILES, MAX_FILE_SIZE, MAX_PDF_PAGES } from './image';
import { RATE_LIMIT } from './rate-limit';
import { TOOLS } from './site';

export const HEALTH_PROBE_KEYS = ['sharp', 'pdf'] as const;

export type HealthProbeName = (typeof HEALTH_PROBE_KEYS)[number];

export type HealthProbe = { name: HealthProbeName; ok: boolean; durationMs: number };

export type HealthReport = {
    status: 'ok' | 'degraded';
    uptimeSeconds: number;
    probes: HealthProbe[];
    tools: number;
    limits: {
        maxFileBytes: number;
        maxBatchFiles: number;
        maxBatchBytes: number;
        maxPdfPages: number;
        rateLimitImages: number;
        rateLimitWindowMs: number;
    };
    build: { commit?: string; region?: string; environment?: string };
    timestamp: string;
};

async function probeSharp(): Promise<void> {
    const png = await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#3b82f6' },
    })
        .png()
        .toBuffer();
    const { width } = await sharp(png).metadata();

    if (width !== 2) throw new Error('sharp decoded an unexpected size');
}

async function probePdf(): Promise<void> {
    const document = await PDFDocument.create();

    document.addPage([72, 72]);

    const bytes = await document.save();

    if (bytes.length === 0) throw new Error('pdf-lib produced an empty document');
}

const PROBES: Record<HealthProbeName, () => Promise<void>> = {
    sharp: probeSharp,
    pdf: probePdf,
};

async function runProbe(name: HealthProbeName): Promise<HealthProbe> {
    const started = performance.now();

    try {
        await PROBES[name]();

        return { name, ok: true, durationMs: Math.round(performance.now() - started) };
    } catch {
        return { name, ok: false, durationMs: Math.round(performance.now() - started) };
    }
}

function optional(value: string | undefined): string | undefined {
    return value && value.length > 0 ? value : undefined;
}

function buildInfo(env: NodeJS.ProcessEnv): HealthReport['build'] {
    const commit = optional(env.VERCEL_GIT_COMMIT_SHA);

    return {
        ...(commit ? { commit: commit.slice(0, 7) } : {}),
        ...(optional(env.VERCEL_REGION) ? { region: env.VERCEL_REGION } : {}),
        ...(optional(env.VERCEL_ENV) ? { environment: env.VERCEL_ENV } : {}),
    };
}

export function healthStatus(probes: readonly HealthProbe[]): HealthReport['status'] {
    return probes.every(probe => probe.ok) ? 'ok' : 'degraded';
}

export function healthStatusCode(report: Pick<HealthReport, 'status'>): number {
    return report.status === 'ok' ? 200 : 503;
}

export async function healthReport(): Promise<HealthReport> {
    const probes = await Promise.all(HEALTH_PROBE_KEYS.map(runProbe));

    return {
        status: healthStatus(probes),
        uptimeSeconds: Math.round(process.uptime()),
        probes,
        tools: TOOLS.length,
        limits: {
            maxFileBytes: MAX_FILE_SIZE,
            maxBatchFiles: MAX_BATCH_FILES,
            maxBatchBytes: MAX_BATCH_BYTES,
            maxPdfPages: MAX_PDF_PAGES,
            rateLimitImages: RATE_LIMIT.images,
            rateLimitWindowMs: RATE_LIMIT.windowMs,
        },
        build: buildInfo(process.env),
        timestamp: new Date().toISOString(),
    };
}
