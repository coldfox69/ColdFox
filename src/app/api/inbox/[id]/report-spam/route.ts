import { withApi, ok, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { loadMailboxCredentials } from '@/lib/email/engine';
import { moveToSpam } from '@/lib/email/providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/inbox/[id]/report-spam', method: 'POST' }, async () => {
    const session = await requireApiSession();
    await enforceRateLimit(request, 'inbox-report-spam', 60, 3600, session.userId);
    const { id } = await params;
    const db = createServiceClient();

    const { data: thread } = await db
      .from('email_threads')
      .select('id, mailbox_id, lead_id')
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
    if (!providerMsgId) throw new ApiError(422, 'No inbound message found to report.');

    try {
      await moveToSpam(credentials, providerMsgId);
    } catch (error) {
      throw new ApiError(502, `Could not report as spam: ${error instanceof Error ? error.message.slice(0, 300) : 'provider error'}`, 'move_failed');
    }

    // Also suppress the lead so we never email them again
    if (thread.lead_id) {
      await db.from('suppression_entries').upsert(
        { organization_id: session.organizationId, email_normalized: '', reason: 'spam_report' },
        { onConflict: 'organization_id,email_normalized', ignoreDuplicates: true },
      ).then(() => undefined, () => undefined);
    }

    return ok({ reported: true });
  });
}
