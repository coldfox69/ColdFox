import { withApi, ok, parseBody, parseQuery, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { templateInputSchema, paginationSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { extractVariables, textToHtml } from '@/lib/email/template';

export const dynamic = 'force-dynamic';

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
    // The payload stays an array; the pagination metadata rides in the headers.
    return ok(
      (data ?? []).map((template) => ({
        ...template,
        variables: extractVariables(String(template.subject ?? ''), String(template.body_text ?? '')),
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
