import { withApi, ok, requireApiSession, writeAudit, assertRole, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureCampaignSteps, seedCampaignExecutions } from '@/lib/email/engine';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/campaigns/[id]/resume', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const db = createServiceClient();
    const { data: campaign } = await db.from('campaigns').select('*').eq('id', id).eq('organization_id', session.organizationId).maybeSingle();
    if (!campaign) throw new ApiError(404, 'Campaign not found.', 'not_found');
    if (campaign.status !== 'paused') throw new ApiError(409, 'Only a paused campaign can be resumed.', 'invalid_state');

    const { error } = await db.from('campaigns').update({ status: 'active' }).eq('id', id);
    if (error) throw new ApiError(500, 'Could not resume the campaign.');
    await ensureCampaignSteps(campaign);
    // Requeue anything that was held while paused.
    await seedCampaignExecutions(session.organizationId, id, new Date());
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'campaign.resumed', entityType: 'campaign', entityId: id, request });
    return ok({ status: 'active' });
  });
}
