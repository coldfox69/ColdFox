import { withApi, ok, requireApiSession, writeAudit, assertRole, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/campaigns/[id]/pause', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const db = createServiceClient();
    const { data, error } = await db
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();
    if (error || !data) throw new ApiError(409, 'Only an active campaign can be paused.', 'invalid_state');
    await db.from('campaign_schedules').update({ status: 'cancelled' }).eq('campaign_id', id).eq('status', 'pending');
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'campaign.paused', entityType: 'campaign', entityId: id, request });
    return ok({ status: 'paused' });
  });
}
