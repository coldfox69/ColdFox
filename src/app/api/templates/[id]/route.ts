import { withApi, ok, parseBody, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { templateUpdateSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { extractVariables, textToHtml } from '@/lib/email/template';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const input = await parseBody(request, templateUpdateSchema);
    const db = createServiceClient();
    const { data: existing } = await db.from('email_templates').select('*').eq('id', id).eq('organization_id', session.organizationId).is('archived_at', null).maybeSingle();
    if (!existing) throw new ApiError(404, 'Template not found.', 'not_found');

    const subject = input.subject ?? String(existing.subject ?? '');
    const bodyText = input.body_text ?? String(existing.body_text ?? '');
    const bodyHtml = textToHtml(bodyText);
    const nextVersion = Number(existing.current_version ?? 1) + 1;

    const { data, error } = await db
      .from('email_templates')
      .update({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.subject !== undefined ? { subject } : {}),
        ...(input.body_text !== undefined ? { body_text: bodyText, body_html: bodyHtml } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.is_shared !== undefined ? { is_shared: input.is_shared } : {}),
        current_version: nextVersion,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw new ApiError(500, 'Could not update the template.');

    await db.from('email_template_versions').insert({
      organization_id: session.organizationId,
      template_id: id,
      version: nextVersion,
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
      change_note: 'Updated via editor',
      created_by: session.userId,
    });
    await db.from('email_template_variables').delete().eq('template_id', id);
    const variables = extractVariables(subject, bodyText);
    if (variables.length) {
      await db.from('email_template_variables').insert(
        variables.map((name) => ({ organization_id: session.organizationId, template_id: id, name, required: false })),
      );
    }
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'template.updated', entityType: 'template', entityId: id, request });
    return ok({ ...data, variables });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const db = createServiceClient();
    const { data, error } = await db
      .from('email_templates')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .is('archived_at', null)
      .select('id')
      .maybeSingle();
    if (error || !data) throw new ApiError(404, 'Template not found.', 'not_found');
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'template.archived', entityType: 'template', entityId: id, request });
    return ok({ archived: true });
  });
}
