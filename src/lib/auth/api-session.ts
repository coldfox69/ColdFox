import 'server-only';
import { cookies, headers } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { USER_ID_HEADER, USER_EMAIL_HEADER } from '@/lib/auth/headers';
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

  // The proxy already validated the session and forwarded the identity, so
  // the token does not have to be validated a second time here.
  const headerList = await headers();
  const forwardedId = headerList.get(USER_ID_HEADER);
  const forwardedEmail = headerList.get(USER_EMAIL_HEADER);

  let userId = forwardedId;
  let userEmail = forwardedEmail ?? '';

  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
    userEmail = user.email ?? '';
  }

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!memberships?.length) {
    return requireOrg ? null : { userId, email: userEmail, organizationId: '', role: 'viewer' };
  }

  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const membership = memberships.find((m) => m.organization_id === requested) ?? memberships[0];

  return {
    userId,
    email: userEmail,
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
