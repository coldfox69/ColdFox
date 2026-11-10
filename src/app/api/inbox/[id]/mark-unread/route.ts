import { withApi, ok, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { loadMailboxCredentials } from '@/lib/email/engine';
import { markAsUnread } from '@/lib/email/providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/inbox/[id]/mark-unread', method: 'POST' }, async () => {
    const session = await requireApiSession();
    await enforceRateLimit(request, 'inbox-mark-unread', 120, 3600, session.userId);
    const { id } = await params;
    const db = createServiceClient();

    const { data: thread } = await db
      .from('email_threads')
      .select('id, mailbox_id')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .maybeSingle();
    if (!thread) throw new ApiError(404, 'Conversation not found.', 'not_found');

    if (thread.mailbox_id) {
      const { credentials, mailbox } = await loadMailboxCredentials(thread.mailbox_id as string);
      if (String(mailbox.organization_id) === session.organizationId) {
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
            await markAsUnread(credentials, providerMsgId);
          } catch (error) {
            console.warn('[inbox] mark-as-unread failed', error);
          }
        }
      }
    }

    await db.from('email_threads').update({ unread_count: 1, updated_at: new Date().toISOString() }).eq('id', id);

    return ok({ unread: true });
  });
}
