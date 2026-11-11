import { withApi, ok, parseBody, parseQuery, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { templateInputSchema, paginationSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { extractVariables, textToHtml } from '@/lib/email/template';

export const dynamic = 'force-dynamic';

async function attachVariants(db: ReturnType<typeof createServiceClient>, organizationId: string, templateIds: string[]) {
  if (!templateIds.length) return new Map<string, unknown[]>();
  const { data } = await db
    .from('email_template_variants')
    .select('*')
    .eq('organization_id', organizationId)
    .in('template_id', templateIds)
    .order('variant_order', { ascending: true });
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of data ?? []) {
    const id = String(row.template_id);
    const list = map.get(id) ?? [];
    list.push(row as Record<string, unknown>);
    map.set(id, list);
  }
  return map;
}

export async function GET(request: Request) {
  return withApi({ route: '/api/templates', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { page, pageSize } = parseQuery(request, paginationSchema);
    const db = createServiceClient();
    const from = (page - 1) * pageSize;
    const { data, error, count } = await db
      .from('email_templates')
      .select('*', { count: 'exact' })
      .eq('organization_id', session.organizationId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new ApiError(500, 'Could not load templates.');
    const rows = (data ?? []) as Record<string, unknown>[];
    const variants = await attachVariants(db, session.organizationId, rows.map((t) => String(t.id)));
    return ok(
      rows.map((template) => ({
        ...template,
        variants: variants.get(String(template.id)) ?? [],
        variables: extractVariables(
          String(template.subject ?? ''),
          String(template.body_text ?? ''),
          ...((variants.get(String(template.id)) ?? []) as { subject?: string; body_text?: string }[]).flatMap((v) => [String(v.subject ?? ''), String(v.body_text ?? '')]),
        ),
      })),
      {
        headers: {
          'X-Total-Count': String(count ?? 0),
          'X-Page': String(page),
          'X-Page-Size': String(pageSize),
        },
      },
    );
  });
}

export async function POST(request: Request) {
  return withApi({ route: '/api/templates', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const input = await parseBody(request, templateInputSchema);
    const db = createServiceClient();

    const subject = input.subject;
    const bodyText = input.body_text;
    const bodyHtml = textToHtml(bodyText);
    const variantRows = input.mode === 'group'
      ? (input.variants && input.variants.length ? input.variants : [{ subject, body_text: bodyText }])
      : [{ subject, body_text: bodyText }];
    const variables = extractVariables(...variantRows.flatMap((variant) => [variant.subject, variant.body_text]));

    const { data, error } = await db
      .from('email_templates')
      .insert({
        organization_id: session.organizationId,
        name: input.name,
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        category: input.category,
        tags: input.tags,
        is_shared: input.is_shared,
        mode: input.mode,
        ai_personalization: input.ai_personalization,
        created_by: session.userId,
      })
      .select('*')
      .single();
    if (error || !data) throw new ApiError(500, 'Could not create the template.');

    if (input.mode === 'group') {
      const payload = variantRows.map((variant, index) => ({
        organization_id: session.organizationId,
        template_id: data.id,
        variant_order: index + 1,
        subject: variant.subject,
        body_text: variant.body_text,
        body_html: textToHtml(variant.body_text),
      }));
      const { error: variantError } = await db.from('email_template_variants').insert(payload);
      if (variantError) throw new ApiError(500, 'The template was created but its variants could not be saved.');
    }

    if (variables.length) {
      await db.from('email_template_variables').insert(
        variables.map((name) => ({ organization_id: session.organizationId, template_id: data.id, name, required: false })),
      );
    }
    await db.from('email_template_versions').insert({
      organization_id: session.organizationId,
      template_id: data.id,
      version: 1,
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
      change_note: input.mode === 'group' ? 'Initial version (multiple variants)' : 'Initial version',
      created_by: session.userId,
    });
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'template.created', entityType: 'template', entityId: data.id as string, request, metadata: { mode: input.mode, variants: input.mode === 'group' ? variantRows.length : 1 } });

    const variants = await attachVariants(db, session.organizationId, [String(data.id)]);
    return ok({ ...data, variables, variants: variants.get(String(data.id)) ?? [] }, { status: 201 });
  });
}
