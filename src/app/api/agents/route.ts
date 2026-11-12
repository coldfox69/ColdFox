import { withApi, ok, requireApiSession } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { listAgents, toAgentSummary } from '@/lib/agents/service';

export const dynamic = 'force-dynamic';

/** The agents a workspace can use. Only published agents are returned. */
export async function GET() {
  return withApi({ route: '/api/agents', method: 'GET' }, async () => {
    await requireApiSession();
    const db = createServiceClient();
    const agents = await listAgents(db, { publishedOnly: true });
    return ok({
      agents: agents.map(({ row, apiConfigured }) => toAgentSummary(row, apiConfigured)),
    });
  });
}
