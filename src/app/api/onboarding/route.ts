import { NextResponse } from 'next/server';
import { withApi, ok, parseBody, requireApiSession, enforceRateLimit, writeAudit } from '@/lib/http';
import { onboardingSchema } from '@/lib/validation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/context';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession(false);
    await enforceRateLimit(request, 'onboarding', 10, 3600, session.userId);
    const input = await parseBody(request, onboardingSchema);
    const supabase = await createServerSupabaseClient();

    const { data: orgId, error } = await supabase.rpc('bootstrap_organization', {
      p_company_name: input.company_name,
      p_website: input.website || null,
      p_industry: input.industry,
      p_company_size: input.company_size,
      p_full_name: input.full_name,
      p_job_title: input.job_title,
      p_department: input.department || null,
      p_intended_usage: input.intended_usage || null,
      p_expected_volume: input.expected_sending_volume || null,
    });
    if (error || !orgId) {
      console.error('[onboarding] bootstrap failed', error?.message);
      return fail();
    }

    await createServiceClient()
      .from('profiles')
      .update({ full_name: input.full_name, job_title: input.job_title, department: input.department || null, onboarding_completed: true })
      .eq('id', session.userId)
      .then(() => undefined, () => undefined);

    await writeAudit({
      organizationId: orgId as string,
      actorId: session.userId,
      actorEmail: session.email,
      action: 'onboarding.completed',
      entityType: 'organization',
      entityId: orgId as string,
      request,
    });

    const response = NextResponse.json({ ok: true, data: { organizationId: orgId } });
    response.cookies.set(ACTIVE_ORG_COOKIE, orgId as string, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  });
}

function fail() {
  return NextResponse.json({ ok: false, error: 'Could not create your workspace. Please try again.' }, { status: 500 });
}
