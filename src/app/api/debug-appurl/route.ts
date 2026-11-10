import { NextResponse } from 'next/server';
import { appUrl } from '@/lib/email/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    appUrl: appUrl(),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
    VERCEL_URL: process.env.VERCEL_URL ?? null,
  });
}
