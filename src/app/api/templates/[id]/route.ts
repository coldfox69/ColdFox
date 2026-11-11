import { withApi, ok, parseBody, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { templateUpdateSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { extractVariables, textToHtml } from '@/lib/email/template';

export const dynamic = 'force-dynamic';

interface VariantPayload { subject: string; body_text: string }

async function attachVariants(db: ReturnType<typeof createServiceClient>, organizationId: string, templateIds: string[]) {
  if (!templateIds.length) return new Map<string, Record<string, unknown>[]>();
  const { data } = await db
    .from('email_template_variants')
    .select('*')
    .eq('organization_id', organizationId)
    .in('template_id', templateIds)
    .order('variant_order', { ascending: true });
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of data ?? []) {
    const id = String((row as Record<string, unknown>).template_id);
    const list = map.get(id) ?? [];
    list.push(row as Record<string, unknown>);
    map.set(id, list);
  }
  return map;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/templates/[id]', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const db = createServiceClient();
    const { data, error } = await db.from('email_templates').select('*').eq('id', id).eq('organization_id', session.organizationId).is('archived_at', null).maybeSingle();
    if (error || !data) throw new ApiError(404, 'Template not found.');
    const variants = await attachVariants(db, session.organizationId, [id]);
    const variantList = variants.get(id) ?? [];
    return ok({
      ...data,
      variants: variantList,
      variables: extractVariables(
        String(data.subject ?? ''),
        String(data.body_text ?? ''),
        ...variantList.flatMap((v) => [String(v.subject ?? ''), String(v.body_text ?? '')]),
      ),
    });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/templates/[id]', method: 'PATCH' }, async () => {
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
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.ai_personalization !== undefined ? { ai_personalization: input.ai_personalization } : {}),
        current_version: nextVersion,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw new ApiError(500, 'Could not update the template.');

    // Variant set is replaced as a unit; order defines variant_order.
    if (input.variants) {
      const variants = (input.variants as VariantPayload[]).slice(0, 10).filter((v) => v.subject?.trim() && v.body_text?.trim());
      if (!variants.length) throw new ApiError(422, 'A group template needs at least one complete variant.');
      await db.from('email_template_variants').delete().eq('template_id', id);
      const payload = variants.map((variant, index) => ({
        organization_id: session.organizationId,
        template_id: id,
        variant_order: index + 1,
        subject: variant.subject,
        body_text: variant.body_text,
        body_html: textToHtml(variant.body_text),
      }));
      const { error: variantError } = await db.from('email_template_variants').insert(payload);
      if (variantError) throw new ApiError(500, 'Could not save the variants.');
    }

    await db.from('email_template_versions').insert({
      organization_id: session.organizationId,
      template_id: id,
      version: nextVersion,
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
      change_note: input.variants ? 'Variants updated' : 'Updated via editor',
      created_by: session.userId,
    });

    const { data: storedVariants } = await db.from('email_template_variants').select('subject, body_text').eq('template_id', id);
    const variables = extractVariables(
      subject,
      bodyText,
      ...((storedVariants ?? []) as VariantPayload[]).flatMap((v) => [v.subject, v.body_text]),
    );
    await db.from('email_template_variables').delete().eq('template_id', id);
    if (variables.length) {
      await db.from('email_template_variables').insert(
        variables.map((name) => ({ organization_id: session.organizationId, template_id: id, name, required: false })),
      );
    }
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'template.updated', entityType: 'template', entityId: id, request, metadata: { mode: input.mode, variants: input.variants?.length } });

    const attached = await attachVariants(db, session.organizationId, [id]);
    return ok({ ...data, variants: attached.get(id) ?? [], variables });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/templates/[id]', method: 'DELETE' }, async () => {
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
