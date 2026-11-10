import { withApi, ok, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { enqueueJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return withApi({ route: '/api/inbox/sync', method: 'POST' }, async () => {
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

    // The sync runs in the background so a slow provider connection cannot
    // hold the request open.
    const jobId = await enqueueJob({
      jobType: 'inbox.sync',
      organizationId: session.organizationId,
      payload: { mailboxes: mailboxes.length, requestedBy: session.userId },
      // One sync per workspace at a time.
      idempotencyKey: `inbox.sync:${session.organizationId}`,
    });

    return ok({ queued: true, jobId, mailboxes: mailboxes.length });
  });
}
