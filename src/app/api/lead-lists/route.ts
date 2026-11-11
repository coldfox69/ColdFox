import { withApi, ok, requireApiSession, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { toLeadListDto, leadCountsByList } from '@/lib/lead-lists';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withApi({ route: '/api/lead-lists', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const db = createServiceClient();
    const includeArchived = new URL(request.url).searchParams.get('archived') === '1';
    let query = db
      .from('lead_lists')
      .select('*')
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (!includeArchived) query = query.is('archived_at', null);
    const { data, error } = await query;
    if (error) throw new ApiError(500, 'Could not load lead lists.');
    const rows = data ?? [];
    const counts = await leadCountsByList(db, session.organizationId, rows.map((row) => String(row.id)));
    return ok(rows.map((row) => toLeadListDto(row as Record<string, unknown>, counts.get(String(row.id)) ?? 0)));
  });
}
