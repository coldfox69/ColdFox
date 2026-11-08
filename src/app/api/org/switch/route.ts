import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi, parseBody, requireApiSession, ApiError } from '@/lib/http';

import { ACTIVE_ORG_COOKIE } from '@/lib/auth/context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const schema = z.object({ organizationId: z.string().uuid() });

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession(false);

    const { organizationId } = await parseBody(request, schema);
    const supabase = await createServerSupabaseClient();
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', session.userId)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) throw new ApiError(403, 'You are not a member of that workspace.', 'forbidden');

    const response = NextResponse.json({ ok: true, data: { organizationId } });
    response.cookies.set(ACTIVE_ORG_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  });
}
