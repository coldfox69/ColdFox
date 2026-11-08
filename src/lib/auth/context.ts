import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ActiveOrganization, OrgRole, SessionUser } from '@/lib/types';

export const ACTIVE_ORG_COOKIE = 'cf_org_id';

export interface SessionContext {
  user: SessionUser;
  role: OrgRole;
  organization: ActiveOrganization | null;
  organizations: ActiveOrganization[];
  onboardingCompleted: boolean;
  isPlatformAdmin: boolean;
  adminRole: string | null;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const [{ data: profile }, { data: memberships }, { data: adminRow }] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url, onboarding_completed').eq('id', user.id).maybeSingle(),
    supabase
      .from('organization_members')
      .select('role, organization:organizations!inner(id, name, slug, plan_key, timezone, deleted_at, is_suspended)')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase.from('platform_admins').select('role').eq('user_id', user.id).maybeSingle(),
  ]);

  const planKeys = Array.from(
    new Set((memberships ?? []).map((m) => (m.organization as unknown as { plan_key: string } | null)?.plan_key).filter(Boolean)),
  ) as string[];
  const { data: plans } = planKeys.length
    ? await supabase.from('subscription_plans').select('key, name').in('key', planKeys)
    : { data: [] as { key: string; name: string }[] };
  const planNames = new Map((plans ?? []).map((p) => [p.key, p.name]));

  const orgs: ActiveOrganization[] = (memberships ?? [])
    .map((m) => {
      const org = m.organization as unknown as {
        id: string; name: string; slug: string; plan_key: string; timezone: string; deleted_at: string | null; is_suspended: boolean;
      } | null;
      if (!org || org.deleted_at || org.is_suspended) return null;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        planKey: org.plan_key,
        planName: planNames.get(org.plan_key) ?? 'Free',
        timezone: org.timezone ?? 'UTC',
        role: m.role as OrgRole,
      } satisfies ActiveOrganization;
    })
    .filter((o): o is ActiveOrganization => Boolean(o));

  const cookieStore = await cookies();
  const requestedOrg = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const active = orgs.find((o) => o.id === requestedOrg) ?? orgs[0] ?? null;

  const email = (user.email ?? '').toLowerCase();
  const name = (profile?.full_name as string | null) || user.user_metadata?.full_name || email.split('@')[0] || 'ColdFox user';

  // Only coldfox6969@gmail.com can access the admin panel
  const isAdminEmail = email === 'coldfox6969@gmail.com';

  return {
    user: { id: user.id, email, name, avatarUrl: (profile?.avatar_url as string | null) ?? null },
    role: active?.role ?? 'viewer',
    organization: active,
    organizations: orgs,
    onboardingCompleted: Boolean(profile?.onboarding_completed) && orgs.length > 0,
    isPlatformAdmin: isAdminEmail || Boolean(adminRow),
    adminRole: isAdminEmail ? 'super_admin' : (adminRow?.role as string | null) ?? null,
  };
}

export async function requireUser(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  return ctx;
}

export async function requireOrganization(): Promise<SessionContext & { organization: ActiveOrganization }> {
  const ctx = await requireUser();
  if (!ctx.organization) redirect('/onboarding');
  if (!ctx.onboardingCompleted) redirect('/onboarding');
  return ctx as SessionContext & { organization: ActiveOrganization };
}

export async function requireAdmin(permission?: string) {
  const ctx = await requireUser();
  // Only coldfox6969@gmail.com can access the admin panel
  if (ctx.user.email.toLowerCase() !== 'coldfox6969@gmail.com') redirect('/app');
  if (!ctx.isPlatformAdmin) redirect('/app');

  if (permission) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.rpc('has_admin_permission', { p_permission: permission });
    if (!data) redirect('/admin');
  }
  return ctx;
}

export function canManage(role: OrgRole) {
  return role === 'owner' || role === 'admin';
}
