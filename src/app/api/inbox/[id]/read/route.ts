import { withApi, ok, requireApiSession, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/inbox/[id]/read', method: 'POST' }, async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const db = createServiceClient();
    const { data } = await db
      .from('email_threads')
      .update({ unread_count: 0 })
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .select('id')
      .maybeSingle();
    if (!data) throw new ApiError(404, 'Conversation not found.', 'not_found');
    await db.from('email_messages').update({ is_read: true }).eq('thread_id', id).eq('organization_id', session.organizationId).eq('direction', 'inbound');
    return ok({ read: true });
  });
}
