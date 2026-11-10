import { withApi, ok, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { loadMailboxCredentials } from '@/lib/email/engine';
import { fetchSpamMessages } from '@/lib/email/providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return withApi({ route: '/api/inbox/sync-spam', method: 'POST' }, async () => {
    const session = await requireApiSession();
    await enforceRateLimit(request, 'inbox-sync-spam', 12, 300, session.userId);
    const db = createServiceClient();

    const { data: mailboxes } = await db
      .from('mailboxes')
      .select('id')
      .eq('organization_id', session.organizationId)
      .eq('status', 'connected')
      .limit(5);

    if (!mailboxes?.length) throw new ApiError(422, 'Connect a mailbox before syncing spam.', 'no_mailbox');

    let totalSpam = 0;
    const errors: string[] = [];

    for (const mailbox of mailboxes) {
      try {
        const { credentials } = await loadMailboxCredentials(mailbox.id as string);
        const spamMessages = await fetchSpamMessages(credentials, { limit: 25 });
        totalSpam += spamMessages.length;
        // Store spam messages as threads with a spam flag in metadata
        // (Full DB integration would require schema changes)
      } catch (error) {
        errors.push(error instanceof Error ? error.message.slice(0, 200) : 'Spam sync failed');
      }
    }

    return ok({ spamFound: totalSpam, errors, mailboxes: mailboxes.length });
  });
}
