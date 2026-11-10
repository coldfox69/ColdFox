import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Measures how long each dependency takes to load in a fresh serverless
 * function. The first import pays the module-graph cost, the rest are warm.
 */
export async function GET() {
  const results: Record<string, number> = {};
  const order = [
    ['next/link', () => import('next/link')],
    ['next/image', () => import('next/image')],
    ['next/navigation', () => import('next/navigation')],
    ['lucide-react', () => import('lucide-react')],
    ['recharts', () => import('recharts')],
    ['@supabase/ssr', () => import('@supabase/ssr')],
    ['@supabase/supabase-js', () => import('@supabase/supabase-js')],
    ['zod', () => import('zod')],
    ['@/lib/data/app', () => import('@/lib/data/app')],
    ['@/lib/validation', () => import('@/lib/validation')],
    ['@/components/layout/AppLayout', () => import('@/components/layout/AppLayout')],
    ['@/views/app/OverviewPage', () => import('@/views/app/OverviewPage')],
    ['@/components/admin/AdminModulePage', () => import('@/components/admin/AdminModulePage')],
  ] as const;

  for (const [name, load] of order) {
    const t = Date.now();
    try {
      await load();
      results[name] = Date.now() - t;
    } catch (error) {
      results[name] = -1;
      console.log(`[probe] ${name} failed`, error);
    }
  }

  return NextResponse.json({ results, uptime: Math.round(process.uptime() * 1000) });
}
