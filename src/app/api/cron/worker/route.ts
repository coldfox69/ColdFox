import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/crypto';
import { runWorkerTick } from '@/lib/email/engine';
import { runQueuedJobs } from '@/lib/jobs';
// Registers the handlers for the queued job types.
import '@/lib/job-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const header = request.headers.get('x-cron-secret') ?? '';
  const urlSecret = new URL(request.url).searchParams.get('secret') ?? '';
  return [bearer, header, urlSecret].some((candidate) => candidate && safeEqual(candidate, secret));
}

async function handler(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const started = Date.now();
  try {
    const summary = await runWorkerTick(50);
    // Drain the background job queue as part of the same tick, so the
    // scheduler that already calls this route needs no extra configuration.
    const jobs = await runQueuedJobs({ limit: 10 });
    return NextResponse.json({
      ok: true,
      data: { ...summary, jobs, durationMs: Date.now() - started },
    });
  } catch (error) {
    console.error('[cron] worker failed', error);
    return NextResponse.json({ ok: false, error: 'Worker failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
