import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/crypto';
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

/**
 * Drains the background job queue on its own, for a scheduler that runs more
 * often than the sending worker.
 */
async function handler(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const started = Date.now();
  try {
    const summary = await runQueuedJobs({ limit: 20 });
    return NextResponse.json({ ok: true, data: { ...summary, durationMs: Date.now() - started } });
  } catch (error) {
    console.error('[cron] job queue failed', error);
    return NextResponse.json({ ok: false, error: 'Job queue failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
