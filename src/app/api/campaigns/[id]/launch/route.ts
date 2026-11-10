import { withApi, ok, parseBody, requireApiSession, writeAudit, assertRole, ApiError, enforceRateLimit } from '@/lib/http';
import { campaignLaunchSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureCampaignSteps, seedCampaignExecutions } from '@/lib/email/engine';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/campaigns/[id]/launch', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'campaign-launch', 30, 3600, session.userId);
    const { id } = await params;
    const input = await parseBody(request, campaignLaunchSchema);
    const db = createServiceClient();

    const { data: campaign } = await db.from('campaigns').select('*').eq('id', id).eq('organization_id', session.organizationId).maybeSingle();
    if (!campaign) throw new ApiError(404, 'Campaign not found.', 'not_found');
    if (!['draft', 'paused', 'scheduled'].includes(String(campaign.status))) throw new ApiError(409, 'This campaign cannot be launched from its current state.', 'invalid_state');
    if (!campaign.mailbox_id) throw new ApiError(422, 'Assign a mailbox before launching.');
    if (!campaign.template_id) throw new ApiError(422, 'Add a message template before launching.');

    const { data: mailbox } = await db.from('mailboxes').select('id, status, daily_limit').eq('id', campaign.mailbox_id).eq('organization_id', session.organizationId).maybeSingle();
    if (!mailbox) throw new ApiError(422, 'The assigned mailbox no longer exists.');
    if (mailbox.status !== 'connected') throw new ApiError(422, 'Connect the assigned mailbox before launching.');

    const { count } = await db.from('campaign_leads').select('id', { count: 'exact', head: true }).eq('campaign_id', id).in('status', ['queued', 'active']);
    if (!count) throw new ApiError(422, 'Add at least one lead before launching.');

    const { data: allowed } = await db.rpc('check_org_limit', { p_org: session.organizationId, p_metric: 'emails_per_month', p_increment: count });
    if (allowed === false) throw new ApiError(402, 'Launching this campaign would exceed your monthly email limit. Upgrade your plan or reduce the audience.', 'plan_limit');

    await ensureCampaignSteps(campaign);

    if (input.mode === 'schedule') {
      if (!input.send_at) throw new ApiError(422, 'Choose a date and time to schedule this campaign.');
      const sendAt = new Date(input.send_at);
      if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() < Date.now() - 60_000) throw new ApiError(422, 'The scheduled time must be in the future.');
      const { error } = await db.from('campaigns').update({ status: 'scheduled', launch_at: sendAt.toISOString() }).eq('id', id);
      if (error) throw new ApiError(500, 'Could not schedule the campaign.');
      await db.from('campaign_schedules').insert({
        organization_id: session.organizationId,
        campaign_id: id,
        send_at: sendAt.toISOString(),
        timezone: String(campaign.timezone ?? 'UTC'),
        created_by: session.userId,
      });
      await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'campaign.scheduled', entityType: 'campaign', entityId: id, request, metadata: { send_at: sendAt.toISOString() } });
      return ok({ status: 'scheduled', sendAt: sendAt.toISOString() });
    }

    const now = new Date();
    const { error } = await db.from('campaigns').update({ status: 'active', started_at: now.toISOString(), launch_at: now.toISOString() }).eq('id', id);
    if (error) throw new ApiError(500, 'Could not launch the campaign.');
    const seeded = await seedCampaignExecutions(session.organizationId, id, now);
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'campaign.launched', entityType: 'campaign', entityId: id, request });
    return ok({ status: 'active', queued: seeded.queued });
  });
}
