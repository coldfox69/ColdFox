import { withApi, ok, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { loadMailboxCredentials } from '@/lib/email/engine';
import { moveToInbox } from '@/lib/email/providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/inbox/[id]/not-spam', method: 'POST' }, async () => {
    const session = await requireApiSession();
    await enforceRateLimit(request, 'inbox-not-spam', 60, 3600, session.userId);
    const { id } = await params;
    const db = createServiceClient();

    const { data: thread } = await db
      .from('email_threads')
      .select('id, mailbox_id, provider_thread_id')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .maybeSingle();
    if (!thread) throw new ApiError(404, 'Conversation not found.', 'not_found');
    if (!thread.mailbox_id) throw new ApiError(422, 'This conversation has no connected mailbox.');

    const { credentials, mailbox } = await loadMailboxCredentials(thread.mailbox_id as string);
    if (String(mailbox.organization_id) !== session.organizationId) throw new ApiError(403, 'Mailbox does not belong to this workspace.');

    // Find the latest inbound message's provider message id
    const { data: messages } = await db
      .from('email_messages')
      .select('provider_message_id, direction')
      .eq('thread_id', id)
      .eq('direction', 'inbound')
      .order('received_at', { ascending: false })
      .limit(1);
    const providerMsgId = messages?.[0]?.provider_message_id;
    if (!providerMsgId) throw new ApiError(422, 'No inbound message found to move.');

    try {
      await moveToInbox(credentials, providerMsgId);
    } catch (error) {
      throw new ApiError(502, `Could not move message to inbox: ${error instanceof Error ? error.message.slice(0, 300) : 'provider error'}`, 'move_failed');
    }

    return ok({ moved: true, to: 'inbox' });
  });
}
