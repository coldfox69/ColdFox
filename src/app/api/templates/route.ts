import { withApi, ok, parseBody, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { templateInputSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { extractVariables, textToHtml } from '@/lib/email/template';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withApi(async () => {
    const session = await requireApiSession();
    const db = createServiceClient();
    const { data, error } = await db
      .from('email_templates')
      .select('*')
      .eq('organization_id', session.organizationId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false });
    if (error) throw new ApiError(500, 'Could not load templates.');
    return ok(
      (data ?? []).map((template) => ({
        ...template,
        variables: extractVariables(String(template.subject ?? ''), String(template.body_text ?? '')),
      })),
    );
  });
}

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const input = await parseBody(request, templateInputSchema);
    const db = createServiceClient();
    const variables = extractVariables(input.subject, input.body_text);

    const { data, error } = await db
      .from('email_templates')
      .insert({
        organization_id: session.organizationId,
        name: input.name,
        subject: input.subject,
        body_text: input.body_text,
        body_html: textToHtml(input.body_text),
        category: input.category,
        tags: input.tags,
        is_shared: input.is_shared,
        created_by: session.userId,
      })
      .select('*')
      .single();
    if (error || !data) throw new ApiError(500, 'Could not create the template.');

    if (variables.length) {
      await db.from('email_template_variables').insert(
        variables.map((name) => ({ organization_id: session.organizationId, template_id: data.id, name, required: false })),
      );
    }
    await db.from('email_template_versions').insert({
      organization_id: session.organizationId,
      template_id: data.id,
      version: 1,
      subject: input.subject,
      body_html: textToHtml(input.body_text),
      body_text: input.body_text,
      change_note: 'Initial version',
      created_by: session.userId,
    });
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'template.created', entityType: 'template', entityId: data.id as string, request });
    return ok({ ...data, variables }, { status: 201 });
  });
}
