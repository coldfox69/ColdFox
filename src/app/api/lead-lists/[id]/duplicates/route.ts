import { withApi, ok, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { requireLeadList } from '@/lib/lead-lists';

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
    const { data: rows, error } = await db
      .from('leads')
      .select('id, email_normalized, created_at')
      .eq('organization_id', session.organizationId)
      .eq('lead_list_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(50000);
    if (error) throw new ApiError(500, 'Could not inspect the list.');

    const seen = new Set<string>();
    const doomed: string[] = [];
    for (const row of rows ?? []) {
      const email = String(row.email_normalized);
      if (seen.has(email)) doomed.push(String(row.id));
      else seen.add(email);
    }

    if (doomed.length) {
      const { error: deleteError } = await db.from('leads').delete().in('id', doomed).eq('organization_id', session.organizationId);
      if (deleteError) throw new ApiError(500, 'Could not remove duplicates.');
    }

    const stats = (list.stats as Record<string, unknown>) ?? {};
    const duplicateRows = Number(stats.duplicate_rows ?? 0) + doomed.length;
    await db.from('lead_lists').update({ stats: { ...stats, duplicate_rows: duplicateRows } }).eq('id', id).eq('organization_id', session.organizationId);

    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'lead_list.deduped', entityType: 'lead_list', entityId: id, request, metadata: { removed: doomed.length } });
    return ok({ removed: doomed.length, kept: (rows ?? []).length - doomed.length });
  });
}
