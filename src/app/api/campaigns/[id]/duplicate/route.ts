import { withApi, ok, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { chunk, fetchAllRows } from '@/lib/data/paginate';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/campaigns/[id]/duplicate', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const db = createServiceClient();
    const { data: original } = await db
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .maybeSingle();
    if (!original) throw new ApiError(404, 'Campaign not found.', 'not_found');

    const { data: copy, error } = await db
      .from('campaigns')
      .insert({
        organization_id: session.organizationId,
        name: `${String(original.name)} (copy)`.slice(0, 160),
        description: original.description,
        mailbox_id: original.mailbox_id,
        template_id: original.template_id,
        lead_list_id: original.lead_list_id,
        timezone: original.timezone,
        daily_limit: original.daily_limit,
        interval_min_seconds: original.interval_min_seconds,
        interval_max_seconds: original.interval_max_seconds,
        ai_personalization: original.ai_personalization,
        status: 'draft',
        created_by: session.userId,
      })
      .select('*')
      .single();
    if (error || !copy) throw new ApiError(500, 'Could not duplicate the campaign.');

    const { data: settings } = await db.from('campaign_settings').select('*').eq('campaign_id', id).maybeSingle();
    if (settings) {
      const { campaign_id: _ignored, organization_id: _org, ...rest } = settings as Record<string, unknown>;
      void _ignored; void _org;
      await db.from('campaign_settings').insert({ ...rest, campaign_id: copy.id, organization_id: session.organizationId });
    }

    const { data: steps } = await db.from('campaign_steps').select('*').eq('campaign_id', id).order('step_order');
    if (steps?.length) {
      await db.from('campaign_steps').insert(steps.map((step) => {
        const { id: _stepId, organization_id: _org, campaign_id: _campaign, ...rest } = step as Record<string, unknown>;
        void _stepId; void _org; void _campaign;
        return { ...rest, campaign_id: copy.id, organization_id: session.organizationId };
      }));
    }

    // Copy the recipient set so the clone is ready to launch.
    const leadRows = await fetchAllRows<{ lead_id: string }>(
      (from, to) => db
        .from('campaign_leads')
        .select('lead_id')
        .eq('campaign_id', id)
        .order('lead_id')
        .range(from, to),
      { maxRows: 100_000 },
    );
    if (leadRows.length) {
      for (const batch of chunk(leadRows, 500)) {
        await db.from('campaign_leads').upsert(
          batch.map((row) => ({ organization_id: session.organizationId, campaign_id: copy.id as string, lead_id: row.lead_id as string, status: 'queued' })),
          { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true },
        );
      }
      await db.from('campaigns').update({ total_leads: leadRows.length }).eq('id', copy.id);
    }

    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'campaign.duplicated', entityType: 'campaign', entityId: copy.id as string, request, metadata: { from_campaign_id: id } });
    return ok({ id: copy.id }, { status: 201 });
  });
}
