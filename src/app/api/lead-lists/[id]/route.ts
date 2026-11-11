import { z } from 'zod';
import { withApi, ok, parseBody, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { toLeadListDto, leadCountsByList, requireLeadList } from '@/lib/lead-lists';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/lead-lists/[id]', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const db = createServiceClient();
    const list = await requireLeadList(db, session.organizationId, id);
    if (!list) throw new ApiError(404, 'Lead list not found.');
    const counts = await leadCountsByList(db, session.organizationId, [id]);
    const base = toLeadListDto(list, counts.get(id) ?? 0);

    const url = new URL(request.url);
    if (url.searchParams.get('leads') === '1') {
      // Preview rows and eligibility numbers for the campaign wizard.
      const { data: leads } = await db
        .from('leads')
        .select('id, email, first_name, last_name, company_name, job_title, website, industry')
        .eq('organization_id', session.organizationId)
        .eq('lead_list_id', id)
        .is('deleted_at', null)
        .not('status', 'in', '(unsubscribed,bounced,not_interested)')
        .order('created_at', { ascending: true })
        .limit(200);
      const rows = (leads ?? []) as Record<string, unknown>[];
      const { partitionSuppressed } = await import('@/lib/suppression');
      const { suppressed } = await partitionSuppressed(db, session.organizationId, rows.map((row) => String(row.email)));
      const eligible = rows.filter((row) => !suppressed.has(String(row.email).trim().toLowerCase()));
      return ok({
        ...base,
        eligibleCount: eligible.length,
        suppressedCount: rows.length - eligible.length,
        preview: eligible.slice(0, 100).map((row) => ({
          id: String(row.id),
          email: String(row.email),
          firstName: strOrNull(row.first_name),
          lastName: strOrNull(row.last_name),
          company: strOrNull(row.company_name),
          jobTitle: strOrNull(row.job_title),
          website: strOrNull(row.website),
          industry: strOrNull(row.industry),
        })),
        note: rows.length === 200 ? 'Preview limited to the first 200 eligible leads.' : undefined,
      });
    }
    return ok(base);
  });
}

function strOrNull(value: unknown): string | null {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || null;
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  archived: z.boolean().optional(),
}).refine((v) => v.name !== undefined || v.archived !== undefined || v.description !== undefined, { message: 'Nothing to update.' });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/lead-lists/[id]', method: 'PATCH' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const input = await parseBody(request, patchSchema);
    const db = createServiceClient();
    const list = await requireLeadList(db, session.organizationId, id);
    if (!list) throw new ApiError(404, 'Lead list not found.');
    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.description !== undefined) update.description = input.description;
    if (input.archived !== undefined) update.archived_at = input.archived ? new Date().toISOString() : null;
    const { data, error } = await db.from('lead_lists').update(update).eq('id', id).eq('organization_id', session.organizationId).select('*').single();
    if (error) throw new ApiError(500, 'Could not update the lead list.');
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'lead_list.updated', entityType: 'lead_list', entityId: id, request, metadata: update });
    const counts = await leadCountsByList(db, session.organizationId, [id]);
    return ok(toLeadListDto(data as Record<string, unknown>, counts.get(id) ?? 0));
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/lead-lists/[id]', method: 'DELETE' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const { id } = await params;
    const purge = new URL(request.url).searchParams.get('purge') === 'true';
    const db = createServiceClient();
    const list = await requireLeadList(db, session.organizationId, id);
    if (!list) throw new ApiError(404, 'Lead list not found.');

    if (purge) {
      // Permanent: remove the list and every lead that belongs to it.
      const { count } = await db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', session.organizationId).eq('lead_list_id', id);
      const { error: deleteLeadsError } = await db.from('leads').delete().eq('organization_id', session.organizationId).eq('lead_list_id', id);
      if (deleteLeadsError) throw new ApiError(500, 'Could not remove the leads in this list.');
      const { error } = await db.from('lead_lists').delete().eq('id', id).eq('organization_id', session.organizationId);
      if (error) throw new ApiError(500, 'Could not delete the lead list.');
      await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'lead_list.purged', entityType: 'lead_list', entityId: id, request, metadata: { leads_deleted: count ?? 0 } });
      return ok({ deleted: true, leadsDeleted: count ?? 0 });
    }

    const { error } = await db.from('lead_lists').update({ archived_at: new Date().toISOString() }).eq('id', id).eq('organization_id', session.organizationId);
    if (error) throw new ApiError(500, 'Could not archive the lead list.');
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'lead_list.archived', entityType: 'lead_list', entityId: id, request });
    return ok({ archived: true });
  });
}
