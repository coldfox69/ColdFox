import { z } from 'zod';
import { withApi, ok, parseBody, requireApiSession, assertRole, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

const schema = z.object({
  archived: z.boolean().optional(),
  assigned: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/inbox/[id]', method: 'PATCH' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const input = await parseBody(request, schema);
    const db = createServiceClient();
    const update: Record<string, unknown> = {};
    if (input.archived !== undefined) update.is_archived = input.archived;
    if (input.assigned !== undefined) update.assigned_to = input.assigned ? session.userId : null;
    if (!Object.keys(update).length) throw new ApiError(422, 'Nothing to update.');
    const { data, error } = await db
      .from('email_threads')
      .update(update)
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .select('id, is_archived, assigned_to')
      .maybeSingle();
    if (error || !data) throw new ApiError(404, 'Conversation not found.', 'not_found');
    return ok(data);
  });
}
