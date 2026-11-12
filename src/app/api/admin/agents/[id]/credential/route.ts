import { withApi, ok, parseBody, requirePlatformAdmin, writeAudit, ApiError } from '@/lib/http';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { removeAgentCredential, saveAgentCredential } from '@/lib/agents/service';

export const dynamic = 'force-dynamic';

const credentialSchema = z.object({
  api_key: z.string().trim().min(4).max(500),
});

/**
 * Store the API key of an agent.
 *
 * The key is encrypted before it is written and is never sent back to the
 * browser, so the console can only ever tell an operator that a key exists.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/admin/agents/[id]/credential', method: 'POST' }, async () => {
    const { session } = await requirePlatformAdmin('ai.manage');
    const { id } = await params;
    const body = await parseBody(request, credentialSchema);
    const db = createServiceClient();

    const { data: agent } = await db.from('ai_agents').select('id, name').eq('id', id).maybeSingle();
    if (!agent) throw new ApiError(404, 'Agent not found.', 'not_found');

    await saveAgentCredential(db, id, { api_key: body.api_key });

    await writeAudit({
      actorId: session.userId,
      actorEmail: session.email,
      action: 'admin.agent.credential_set',
      entityType: 'ai_agent',
      entityId: id,
      request,
      metadata: { name: agent.name },
    });

    return ok({ configured: true });
  });
}

/** Remove the stored API key of an agent. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/admin/agents/[id]/credential', method: 'DELETE' }, async () => {
    const { session } = await requirePlatformAdmin('ai.manage');
    const { id } = await params;
    const db = createServiceClient();

    const { data: agent } = await db.from('ai_agents').select('id, name').eq('id', id).maybeSingle();
    if (!agent) throw new ApiError(404, 'Agent not found.', 'not_found');

    await removeAgentCredential(db, id);

    await writeAudit({
      actorId: session.userId,
      actorEmail: session.email,
      action: 'admin.agent.credential_removed',
      entityType: 'ai_agent',
      entityId: id,
      request,
      metadata: { name: agent.name },
    });

    return ok({ configured: false });
  });
}
