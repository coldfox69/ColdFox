import 'server-only';
import { registerJobHandler } from '@/lib/jobs';
import { createServiceClient } from '@/lib/supabase/service';
import { syncMailbox } from '@/lib/email/engine';
import { runAgentTask } from '@/lib/agents/runner';

/**
 * Handlers for the background job queue.
 *
 * Importing this file registers every handler. It is imported by the cron
 * route that drains the queue.
 */

/**
 * Run an AI agent task.
 *
 * The task calls the agent API, imports whatever leads it returns into a lead
 * list and, when the user asked for it, hands the list to the email outreach
 * pipeline.
 */
registerJobHandler('agents.run', async (job) => {
  const runId = String(job.payload?.runId ?? '');
  if (!runId) throw new Error('The job has no agent run.');
  await runAgentTask(runId);
});

/**
 * Sync the connected mailboxes of a workspace.
 *
 * This used to run inside the request, where a slow provider connection kept
 * the response open. It now runs in the background.
 */
registerJobHandler('inbox.sync', async (job) => {
  const organizationId = job.organizationId;
  if (!organizationId) throw new Error('The job has no organization.');

  const db = createServiceClient();
  const { data: mailboxes } = await db
    .from('mailboxes')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'connected')
    .limit(5);

  const targets = mailboxes ?? [];
  if (!targets.length) return;

  // The mailboxes are independent, so they sync concurrently. One failing
  // provider must not stop the others.
  const outcomes = await Promise.allSettled(
    targets.map((mailbox) => syncMailbox(mailbox.id as string)),
  );

  const errors: string[] = [];
  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') return;
    const message = outcome.reason instanceof Error ? outcome.reason.message : 'Sync failed';
    errors.push(message.slice(0, 200));
    db.from('mailboxes')
      .update({ last_error: message.slice(0, 500) })
      .eq('id', targets[index].id)
      .then(() => undefined, () => undefined);
  });

  if (errors.length) {
    // Recorded, but the job itself succeeded: the other mailboxes were
    // synced, so a retry would repeat work.
    console.warn('[jobs] inbox.sync had errors', errors);
  }
});
