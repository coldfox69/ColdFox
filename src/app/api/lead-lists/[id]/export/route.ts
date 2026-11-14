import { withApi, requireApiSession, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { requireLeadList, leadsToCsv } from '@/lib/lead-lists';
import { fetchAllRows } from '@/lib/data/paginate';
import type { LeadListColumn } from '@/lib/placeholders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/lead-lists/[id]/export', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const db = createServiceClient();
    const list = await requireLeadList(db, session.organizationId, id);
    if (!list) throw new ApiError(404, 'Lead list not found.');

    const rows = await fetchAllRows<Record<string, unknown>>(
      (from, to) => db
        .from('leads')
        .select('id, email, first_name, last_name, company_name, job_title, website, industry, status, city, country, phone, custom_data')
        .eq('organization_id', session.organizationId)
        .eq('lead_list_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id')
        .range(from, to),
      { maxRows: 100_000 },
    );

    const csv = leadsToCsv(Array.isArray(list.columns) ? (list.columns as LeadListColumn[]) : [], rows);
    const filename = String(list.name ?? 'lead-list').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').toLowerCase() || 'lead-list';
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}.csv"`,
        'cache-control': 'no-store',
      },
    });
  });
}
