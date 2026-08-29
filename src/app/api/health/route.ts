import { healthReport, healthStatusCode } from '@/lib/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
    const report = await healthReport();

    return Response.json(report, {
        status: healthStatusCode(report),
        headers: { 'Cache-Control': 'no-store' },
    });
}
