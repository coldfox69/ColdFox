import { withApi, ok, parseBody, requireApiSession, writeAudit, assertRole, ApiError } from '@/lib/http';
import { leadUpdateSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { recordLeadActivity, syncLeadTags, tagsForLeads, toLeadDto } from '@/lib/leads';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/leads/[id]', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const db = createServiceClient();
    const { data: lead, error } = await db
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !lead) throw new ApiError(404, 'Lead not found.', 'not_found');

    const [tagMap, notes, activities, campaignLeads] = await Promise.all([
      tagsForLeads(db, session.organizationId, [id]),
      db.from('lead_notes').select('id, body, created_at, author_id').eq('organization_id', session.organizationId).eq('lead_id', id).order('created_at', { ascending: false }).limit(50),
      db.from('lead_activities').select('id, activity_type, description, metadata, occurred_at').eq('organization_id', session.organizationId).eq('lead_id', id).order('occurred_at', { ascending: false }).limit(50),
      db.from('campaign_leads').select('status, current_step, last_sent_at, campaign:campaigns(id, name, status)').eq('organization_id', session.organizationId).eq('lead_id', id).limit(20),
    ]);

    return ok({
      lead: toLeadDto(lead, tagMap.get(id) ?? []),
      notes: notes.data ?? [],
      activities: activities.data ?? [],
      campaigns: campaignLeads.data ?? [],
    });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/leads/[id]', method: 'PATCH' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const input = await parseBody(request, leadUpdateSchema);
    const db = createServiceClient();

    const { data: existing } = await db.from('leads').select('id').eq('id', id).eq('organization_id', session.organizationId).is('deleted_at', null).maybeSingle();
    if (!existing) throw new ApiError(404, 'Lead not found.', 'not_found');

    const update: Record<string, unknown> = {};
    const map: Record<string, string> = {
      first_name: 'first_name', last_name: 'last_name', email: 'email', company_name: 'company_name',
      job_title: 'job_title', phone: 'phone', linkedin_url: 'linkedin_url', website: 'website',
      industry: 'industry', city: 'city', country: 'country', status: 'status', source: 'source',
      custom_data: 'custom_data', next_follow_up_at: 'next_follow_up_at',
    };
    for (const [key, column] of Object.entries(map)) {
      const value = (input as Record<string, unknown>)[key];
      if (value !== undefined) update[column] = key === 'linkedin_url' && value === '' ? null : value;
    }
    if (Object.keys(update).length) {
      const { error } = await db.from('leads').update(update).eq('id', id).eq('organization_id', session.organizationId);
      if (error) {
        if (error.code === '23505') throw new ApiError(409, 'That email is already used by another lead.', 'duplicate_lead');
        throw new ApiError(500, 'Could not update the lead.');
      }
    }
    if (input.tags) await syncLeadTags(db, session.organizationId, id, input.tags);
    if (input.notes) {
      await db.from('lead_notes').insert({ organization_id: session.organizationId, lead_id: id, author_id: session.userId, body: input.notes });
    }
    await recordLeadActivity(db, { organizationId: session.organizationId, leadId: id, actorId: session.userId, type: 'lead_updated', description: 'Lead details updated.' });
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'lead.updated', entityType: 'lead', entityId: id, request });

    const { data: lead } = await db.from('leads').select('*').eq('id', id).maybeSingle();
    const tagMap = await tagsForLeads(db, session.organizationId, [id]);
    return ok(toLeadDto(lead ?? {}, tagMap.get(id) ?? []));
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/leads/[id]', method: 'DELETE' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const db = createServiceClient();
    const { data, error } = await db
      .from('leads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error || !data) throw new ApiError(404, 'Lead not found.', 'not_found');
    await db.from('campaign_leads').delete().eq('lead_id', id).eq('organization_id', session.organizationId);
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'lead.deleted', entityType: 'lead', entityId: id, request });
    return ok({ deleted: true });
  });
}
