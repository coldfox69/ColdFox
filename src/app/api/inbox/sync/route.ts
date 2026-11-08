import { withApi, ok, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { syncMailbox } from '@/lib/email/engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession();
    await enforceRateLimit(request, 'inbox-sync', 12, 300, session.userId);
    const db = createServiceClient();
    const { data: mailboxes } = await db
      .from('mailboxes')
      .select('id, provider')
      .eq('organization_id', session.organizationId)
      .eq('status', 'connected')
      .limit(5);

    if (!mailboxes?.length) throw new ApiError(422, 'Connect a mailbox before syncing the inbox.', 'no_mailbox');

    let synced = 0;
    let replies = 0;
    const errors: string[] = [];
    for (const mailbox of mailboxes) {
      try {
        const result = await syncMailbox(mailbox.id as string);
        synced += result.synced;
        replies += result.replies;
      } catch (error) {
        errors.push(error instanceof Error ? error.message.slice(0, 200) : 'Sync failed');
      }
    }
    return ok({ synced, replies, errors, mailboxes: mailboxes.length });
  });
}
