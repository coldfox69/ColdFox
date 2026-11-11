import { withApi, ok, requireApiSession, assertRole, enforceRateLimit } from '@/lib/http';
import { runOrgSendingTick } from '@/lib/email/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Flush this workspace's due sending queue.
 *
 * Authenticated callers only; sends the same messages as the cron worker,
 * limited to the caller's own organization and to the guardrails of the send
 * pipeline (campaign limits, mailbox limits, suppression, throttle, send
 * window). Called opportunistically by the app while a campaign is live so
 * instant campaigns actually send without waiting for an external cron.
 */
export async function POST(request: Request) {
  return withApi({ route: '/api/campaigns/send-due', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'campaign-send-due', 120, 60, session.userId);
    const result = await runOrgSendingTick(session.organizationId, 20);
    return ok(result);
  });
}
