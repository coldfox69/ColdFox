import { withApi, ok, parseBody, requireApiSession, writeAudit, assertRole, ApiError } from '@/lib/http';
import { settingsSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

export async function PATCH(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession();
    const input = await parseBody(request, settingsSchema);
    const db = createServiceClient();

    const profileUpdate: Record<string, unknown> = {};
    if (input.full_name !== undefined) profileUpdate.full_name = input.full_name;
    if (input.job_title !== undefined) profileUpdate.job_title = input.job_title;
    if (input.department !== undefined) profileUpdate.department = input.department;
    if (input.timezone !== undefined) profileUpdate.timezone = input.timezone;
    if (Object.keys(profileUpdate).length) {
      const { error } = await db.from('profiles').update(profileUpdate).eq('id', session.userId);
      if (error) throw new ApiError(500, 'Could not update your profile.');
    }

    const orgUpdate: Record<string, unknown> = {};
    if (input.organization_name !== undefined) orgUpdate.name = input.organization_name;
    if (input.website !== undefined) orgUpdate.website = input.website;
    if (input.industry !== undefined) orgUpdate.industry = input.industry;
    if (input.company_size !== undefined) orgUpdate.company_size = input.company_size;
    if (input.timezone !== undefined) orgUpdate.timezone = input.timezone;

    if (Object.keys(orgUpdate).length) {
      assertRole(session, ['owner', 'admin']);
      const { error } = await db.from('organizations').update(orgUpdate).eq('id', session.organizationId);
      if (error) throw new ApiError(500, 'Could not update the workspace.');
    }

    await writeAudit({
      organizationId: session.organizationId,
      actorId: session.userId,
      actorEmail: session.email,
      action: 'settings.updated',
      request,
      metadata: { fields: [...Object.keys(profileUpdate), ...Object.keys(orgUpdate)] },
    });

    return ok({ updated: true });
  });
}
