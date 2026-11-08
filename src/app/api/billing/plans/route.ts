import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await createServiceClient()
    .from('subscription_plans')
    .select('key, name, description, price_monthly, currency, limits, features, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return NextResponse.json({ ok: false, error: 'Could not load plans.' }, { status: 500 });
  return NextResponse.json({ ok: true, data: data ?? [] });
}
