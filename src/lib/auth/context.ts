import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { USER_ID_HEADER, USER_EMAIL_HEADER, USER_NAME_HEADER } from '@/lib/auth/headers';
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
  adminPermissions: string[];
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createServerSupabaseClient();

  // The proxy already validated the session and forwarded the identity in a
  // request header. Re-using it avoids a second round trip to the auth
  // server on every render. The fallback keeps this working if the proxy
  // did not run.
  const headerList = await headers();
  const forwardedId = headerList.get(USER_ID_HEADER);
  const forwardedEmail = headerList.get(USER_EMAIL_HEADER);
  const forwardedName = headerList.get(USER_NAME_HEADER);

  let userId = forwardedId;
  let userEmail = forwardedEmail ?? '';
  let userName = forwardedName ?? '';

  if (!userId) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    userId = user.id;
    userEmail = user.email ?? '';
    userName = (user.user_metadata?.full_name as string | undefined) ?? '';
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, onboarding_completed')
    .eq('id', userId)
    .maybeSingle();

  const [{ data: memberships }, { data: adminRow }] = await Promise.all([
    supabase
      .from('organization_members')
      .select('role, organization:organizations!inner(id, name, slug, plan_key, timezone, deleted_at, is_suspended)')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase.from('platform_admins').select('role').eq('user_id', userId).maybeSingle(),
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

  const email = (userEmail || '').toLowerCase();
  const name = (profile?.full_name as string | null) || userName || email.split('@')[0] || 'ColdFox user';

  // Role permissions are the single source of truth. The owner account is
  // seeded as super_admin in platform_admins and admin_roles.
  const adminRole = (adminRow?.role as string | null) ?? null;
  let adminPermissions: string[] = [];
  if (adminRole) {
    const { data: roleRow } = await supabase
      .from('admin_roles')
      .select('permissions')
      .eq('key', adminRole)
      .maybeSingle();
    adminPermissions = (roleRow?.permissions as string[] | undefined) ?? [];
  }

  return {
    user: { id: userId, email, name, avatarUrl: (profile?.avatar_url as string | null) ?? null },
    role: active?.role ?? 'viewer',
    organization: active,
    organizations: orgs,
    onboardingCompleted: Boolean(profile?.onboarding_completed) && orgs.length > 0,
    isPlatformAdmin: Boolean(adminRow),
    adminRole,
    adminPermissions,
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
  if (!ctx.isPlatformAdmin) redirect('/app');

  if (permission) {
    const allowed = ctx.adminPermissions.includes('*') || ctx.adminPermissions.includes(permission);
    if (!allowed) redirect('/admin');
  }
  return ctx;
}

export function canManage(role: OrgRole) {
  return role === 'owner' || role === 'admin';
}
