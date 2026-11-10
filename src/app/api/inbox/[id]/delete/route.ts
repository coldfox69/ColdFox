import { withApi, ok, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { loadMailboxCredentials } from '@/lib/email/engine';
import { trashMessage } from '@/lib/email/providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/inbox/[id]', method: 'DELETE' }, async () => {
    const session = await requireApiSession();
    await enforceRateLimit(request, 'inbox-delete', 60, 3600, session.userId);
    const { id } = await params;
    const db = createServiceClient();

    const { data: thread } = await db
      .from('email_threads')
      .select('id, mailbox_id')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .maybeSingle();
    if (!thread) throw new ApiError(404, 'Conversation not found.', 'not_found');
    if (!thread.mailbox_id) throw new ApiError(422, 'This conversation has no connected mailbox.');

    const { credentials, mailbox } = await loadMailboxCredentials(thread.mailbox_id as string);
    if (String(mailbox.organization_id) !== session.organizationId) throw new ApiError(403, 'Mailbox does not belong to this workspace.');

    const { data: messages } = await db
      .from('email_messages')
      .select('provider_message_id')
      .eq('thread_id', id)
      .eq('direction', 'inbound')
      .order('received_at', { ascending: false })
      .limit(1);
    const providerMsgId = messages?.[0]?.provider_message_id;
    if (providerMsgId) {
      try {
        await trashMessage(credentials, providerMsgId);
      } catch (error) {
        // Provider delete failed — still remove from local DB
        console.warn('[inbox] provider trash failed', error);
      }
    }

    // Soft-delete: mark thread as archived
    await db.from('email_threads').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);

    return ok({ deleted: true });
  });
}
