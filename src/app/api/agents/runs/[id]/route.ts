import { withApi, ok, requireApiSession, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/** The state of one agent run, so the page can follow it. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/agents/runs/[id]', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const db = createServiceClient();
    const { data } = await db
      .from('ai_agent_runs')
      .select('id, agent_id, status, source, inputs, outreach, result, error, lead_list_id, campaign_id, automation_id, scheduled_for, started_at, finished_at, created_at')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .maybeSingle();
    if (!data) throw new ApiError(404, 'That agent run does not exist.', 'not_found');

    const run = data as Record<string, unknown>;
    return ok({
      run: {
        id: run.id,
        agentId: run.agent_id,
        status: run.status,
        source: run.source,
        error: run.error ?? null,
        result: run.result ?? null,
        leadListId: run.lead_list_id ?? null,
        campaignId: run.campaign_id ?? null,
        automationId: run.automation_id ?? null,
        scheduledFor: run.scheduled_for ?? null,
        startedAt: run.started_at ?? null,
        finishedAt: run.finished_at ?? null,
        createdAt: run.created_at,
      },
    });
  });
}
