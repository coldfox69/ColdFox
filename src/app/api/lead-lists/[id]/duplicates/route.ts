import { withApi, ok, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { requireLeadList } from '@/lib/lead-lists';
import { chunk, fetchAllRows } from '@/lib/data/paginate';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/lead-lists/[id]/duplicates', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const db = createServiceClient();
    const list = await requireLeadList(db, session.organizationId, id);
    if (!list) throw new ApiError(404, 'Lead list not found.');

    // Duplicate = same normalised email inside this list. Keep the oldest row.
    const rows = await fetchAllRows<{ id: string; email_normalized: string; created_at: string }>(
      (from, to) => db
        .from('leads')
        .select('id, email_normalized, created_at')
        .eq('organization_id', session.organizationId)
        .eq('lead_list_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id')
        .range(from, to),
      { maxRows: 200_000 },
    );

    const seen = new Set<string>();
    const doomed: string[] = [];
    for (const row of rows) {
      const email = String(row.email_normalized);
      if (seen.has(email)) doomed.push(String(row.id));
      else seen.add(email);
    }

    if (doomed.length) {
      for (const ids of chunk(doomed, 200)) {
        const { error: deleteError } = await db.from('leads').delete().in('id', ids).eq('organization_id', session.organizationId);
        if (deleteError) throw new ApiError(500, 'Could not remove duplicates.');
      }
    }

    const stats = (list.stats as Record<string, unknown>) ?? {};
    const duplicateRows = Number(stats.duplicate_rows ?? 0) + doomed.length;
    await db.from('lead_lists').update({ stats: { ...stats, duplicate_rows: duplicateRows } }).eq('id', id).eq('organization_id', session.organizationId);

    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'lead_list.deduped', entityType: 'lead_list', entityId: id, request, metadata: { removed: doomed.length } });
    return ok({ removed: doomed.length, kept: rows.length - doomed.length });
  });
}
