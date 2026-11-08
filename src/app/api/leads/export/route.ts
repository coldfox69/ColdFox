import { requireApiSession, toCsv } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { tagsForLeads } from '@/lib/leads';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await requireApiSession();
  const db = createServiceClient();
  const url = new URL(request.url);
  const ids = url.searchParams.get('ids');

  let builder = db.from('leads').select('*').eq('organization_id', session.organizationId).is('deleted_at', null).limit(10000);
  if (ids) {
    const parsed = ids.split(',').filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 10000);
    if (!parsed.length) return new Response('No valid lead ids selected.', { status: 422 });
    builder = builder.in('id', parsed);
  }
  const { data, error } = await builder.order('created_at', { ascending: false });
  if (error) return new Response('Could not export leads.', { status: 500 });
  const tagMap = await tagsForLeads(db, session.organizationId, (data ?? []).map((r) => r.id as string));

  const header = ['first_name', 'last_name', 'email', 'company_name', 'job_title', 'phone', 'website', 'industry', 'city', 'country', 'linkedin_url', 'status', 'source', 'tags', 'last_contacted_at', 'next_follow_up_at', 'created_at'];
  const rows = [
    header,
    ...(data ?? []).map((lead) => [
      lead.first_name, lead.last_name, lead.email, lead.company_name, lead.job_title, lead.phone, lead.website,
      lead.industry, lead.city, lead.country, lead.linkedin_url, lead.status, lead.source,
      (tagMap.get(lead.id as string) ?? []).join(';'), lead.last_contacted_at, lead.next_follow_up_at, lead.created_at,
    ]),
  ];

  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="coldfox-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
