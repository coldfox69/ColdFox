import 'server-only';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { OrgRole } from '@/lib/types';
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/context';

export interface ApiSession {
  userId: string;
  email: string;
  /** The authorized organization - resolved from the signed-in user's membership, never from the request body. */
  organizationId: string;
  role: OrgRole;
}

export async function getApiSession(requireOrg = true): Promise<ApiSession | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships?.length) return requireOrg ? null : { userId: user.id, email: user.email ?? '', organizationId: '', role: 'viewer' };

  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const membership = memberships.find((m) => m.organization_id === requested) ?? memberships[0];

  return {
    userId: user.id,
    email: user.email ?? '',
    organizationId: membership.organization_id as string,
    role: membership.role as OrgRole,
  };
}

export function assertRole(session: ApiSession, roles: OrgRole[]) {
  if (!roles.includes(session.role)) {
    const error = new Error('You do not have permission to perform this action.');
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
}
