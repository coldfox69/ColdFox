import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Same shape as /api/diag, but the proxy does not run for this path, so it
 * measures the function on its own.
 */
export async function GET() {
  return NextResponse.json({
    route: 'bare',
    bootMs: Math.round(process.uptime() * 1000),
    at: Date.now(),
  });
}
