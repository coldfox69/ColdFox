import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  const checks: Record<string, { ok: boolean; detail?: string; latencyMs?: number }> = {};

  try {
    const db = createServiceClient();
    const t = Date.now();
    const { error } = await db.from('subscription_plans').select('key').limit(1);
    checks.database = { ok: !error, detail: error?.message, latencyMs: Date.now() - t };
  } catch (error) {
    checks.database = { ok: false, detail: error instanceof Error ? error.message : 'unreachable' };
  }

  checks.ai = { ok: Boolean(process.env.GROQ_API_KEY), detail: process.env.GROQ_API_KEY ? 'configured' : 'not configured' };
  checks.gmail_oauth = { ok: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), detail: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not configured' };
  checks.microsoft_oauth = { ok: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET), detail: process.env.MICROSOFT_CLIENT_ID ? 'configured' : 'not configured' };
  checks.cron = { ok: Boolean(process.env.CRON_SECRET), detail: process.env.CRON_SECRET ? 'configured' : 'not configured' };

  const healthy = checks.database.ok;
  return NextResponse.json(
    {
      ok: healthy,
      service: 'coldfox',
      version: process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
