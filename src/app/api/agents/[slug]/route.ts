import { withApi, ok, requireApiSession, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { getAgentBySlug, toAgentDetail } from '@/lib/agents/service';

export const dynamic = 'force-dynamic';

/** One agent with its input schema and the runs of this workspace. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withApi({ route: '/api/agents/[slug]', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { slug } = await params;
    const db = createServiceClient();
    const agent = await getAgentBySlug(db, slug);
    if (!agent) throw new ApiError(404, 'That agent does not exist.', 'not_found');
    if (agent.row.status !== 'published') {
      throw new ApiError(404, 'That agent is not available.', 'not_found');
    }

    const { data: runs } = await db
      .from('ai_agent_runs')
      .select('id, status, created_at, finished_at, lead_list_id, campaign_id, error, scheduled_for')
      .eq('organization_id', session.organizationId)
      .eq('agent_id', agent.row.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return ok({
      agent: toAgentDetail(agent.row, agent.apiConfigured),
      runs: (runs ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        return {
          id: record.id,
          status: record.status,
          createdAt: record.created_at,
          finishedAt: record.finished_at,
          scheduledFor: record.scheduled_for,
          leadListId: record.lead_list_id,
          campaignId: record.campaign_id,
          error: record.error ?? null,
        };
      }),
    });
  });
}
