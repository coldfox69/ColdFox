import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getNotifications } from '@/lib/data/app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function now() {
  return performance.now();
}

export async function GET() {
  const marks: Record<string, number> = {};
  let last = now();
  const mark = (name: string) => {
    const t = now();
    marks[name] = Math.round(t - last);
    last = t;
  };

  const supabase = await createServerSupabaseClient();
  mark('createClient');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  mark('auth.getUser');

  if (!user) return NextResponse.json({ marks, note: 'no user' });

  await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url, onboarding_completed').eq('id', user.id).maybeSingle(),
    supabase.from('organization_members').select('role, organization:organizations!inner(id, name, slug, plan_key, timezone, deleted_at, is_suspended)').eq('user_id', user.id).eq('status', 'active'),
    supabase.from('platform_admins').select('role').eq('user_id', user.id).maybeSingle(),
  ]);
  mark('3 parallel user queries');

  await supabase.from('subscription_plans').select('key, name').in('key', ['free']);
  mark('plans query');

  const service = createServiceClient();
  await service.from('organizations').select('id').limit(1);
  mark('service client first query');

  await Promise.all([
    service.from('leads').select('id', { count: 'exact', head: true }).limit(1),
    service.from('campaigns').select('id').limit(1),
    service.from('mailboxes').select('id').limit(1),
    service.from('email_events').select('id').limit(1),
    service.from('cache_entries').select('key').limit(1),
  ]);
  mark('5 parallel service queries');

  await getNotifications(user.id);
  mark('getNotifications');

  return NextResponse.json({ marks, total: Math.round(now()) });
}
