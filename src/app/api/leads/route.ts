import { z } from 'zod';
import { withApi, ok, parseBody, parseQuery, requireApiSession, enforceRateLimit, writeAudit, assertRole, ApiError } from '@/lib/http';
import { leadInputSchema, leadListQuerySchema, LEAD_STATUSES } from '@/lib/validation';
import { countByValue } from '@/lib/data/app';
import { createServiceClient } from '@/lib/supabase/service';
import { recordLeadActivity, syncLeadTags, tagsForLeads, toLeadDto } from '@/lib/leads';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withApi({ route: '/api/leads', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const query = parseQuery(request, leadListQuerySchema);
    const db = createServiceClient();

    let builder = db
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('organization_id', session.organizationId)
      .is('deleted_at', null);

    if (query.status !== 'all') builder = builder.eq('status', query.status);
    if (query.q) {
      const safe = query.q.replace(/[%,()]/g, ' ');
      builder = builder.or(
        [
          `first_name.ilike.%${safe}%`,
          `last_name.ilike.%${safe}%`,
          `email.ilike.%${safe}%`,
          `company_name.ilike.%${safe}%`,
          `job_title.ilike.%${safe}%`,
        ].join(','),
      );
    }
    if (query.tag) {
      const { data: tag } = await db.from('lead_tags').select('id').eq('organization_id', session.organizationId).eq('name', query.tag).maybeSingle();
      if (!tag) return ok({ leads: [], total: 0, page: query.page, pageSize: query.pageSize, statuses: {} });
      const { data: assignments } = await db.from('lead_tag_assignments').select('lead_id').eq('organization_id', session.organizationId).eq('tag_id', tag.id).limit(10000);
      builder = builder.in('id', (assignments ?? []).map((a) => a.lead_id));
    }

    const sortColumn = query.sort === 'name' ? 'last_name' : query.sort;
    const from = (query.page - 1) * query.pageSize;
    const { data, count, error } = await builder.order(sortColumn, { ascending: query.dir === 'asc', nullsFirst: false }).range(from, from + query.pageSize - 1);
    if (error) throw new ApiError(500, 'Could not load leads.');

    const ids = (data ?? []).map((row) => row.id as string);
    // Exact per status counts with head requests: the breakdown never pulls
    // lead rows into memory, so it stays correct for very large lead sets.
    const [tagMap, statuses] = await Promise.all([
      tagsForLeads(db, session.organizationId, ids),
      countByValue(db, 'leads', 'status', LEAD_STATUSES, (query) =>
        query.eq('organization_id', session.organizationId).is('deleted_at', null),
      ),
    ]);

    return ok({
      leads: (data ?? []).map((row) => toLeadDto(row, tagMap.get(row.id as string) ?? [])),
      total: count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
      statuses,
    });
  });
}

export async function POST(request: Request) {
  return withApi({ route: '/api/leads', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'leads-write', 120, 60, session.userId);
    const input = await parseBody(request, leadInputSchema);
    const db = createServiceClient();

    const { data: lead, error } = await db
      .from('leads')
      .insert({
        organization_id: session.organizationId,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        email: input.email,
        company_name: input.company_name ?? null,
        job_title: input.job_title ?? null,
        phone: input.phone ?? null,
        linkedin_url: input.linkedin_url || null,
        website: input.website ?? null,
        industry: input.industry ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        status: input.status,
        source: input.source || 'manual',
        custom_data: input.custom_data,
        next_follow_up_at: input.next_follow_up_at ?? null,
        created_by: session.userId,
        owner_id: session.userId,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') throw new ApiError(409, 'A lead with that email already exists in this workspace.', 'duplicate_lead');
      throw new ApiError(500, 'Could not create the lead.');
    }

    await syncLeadTags(db, session.organizationId, lead.id, input.tags);
    if (input.notes) {
      await db.from('lead_notes').insert({ organization_id: session.organizationId, lead_id: lead.id, author_id: session.userId, body: input.notes });
    }
    await recordLeadActivity(db, { organizationId: session.organizationId, leadId: lead.id, actorId: session.userId, type: 'lead_created', description: 'Lead created manually.' });
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'lead.created', entityType: 'lead', entityId: lead.id, request });

    const { data: usageAllowed } = await db.rpc('check_org_limit', { p_org: session.organizationId, p_metric: 'leads', p_increment: 1 });
    if (usageAllowed === false) {
      await db.from('leads').delete().eq('id', lead.id);
      throw new ApiError(402, 'This workspace has reached its lead limit. Upgrade your plan to add more leads.', 'plan_limit');
    }
    await db.rpc('record_usage', { p_org: session.organizationId, p_metric: 'leads', p_quantity: 1 }).then(() => undefined, () => undefined);

    return ok(toLeadDto(lead, input.tags), { status: 201 });
  });
}
