import { withApi, ok, parseBody, requireApiSession, writeAudit, assertRole, ApiError, enforceRateLimit } from '@/lib/http';
import { agentRunSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { coerceAgentInputs, validateAgentInputs } from '@/lib/agents/inputs';
import { getAgentBySlug } from '@/lib/agents/service';
import { ensureAgentWorkflow, startAutomationExecution } from '@/lib/agents/workflow';
import { enqueueJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Start an agent task.
 *
 * The task is queued and runs in the background, so a slow agent API never
 * blocks the browser. A scheduled task is queued with a run time, which the
 * background worker picks up when the time comes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withApi({ route: '/api/agents/[slug]/run', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'agent-run', 30, 3600, session.userId);
    const { slug } = await params;
    const body = await parseBody(request, agentRunSchema);
    const db = createServiceClient();

    const agent = await getAgentBySlug(db, slug);
    if (!agent) throw new ApiError(404, 'That agent does not exist.', 'not_found');
    if (agent.row.status !== 'published') {
      throw new ApiError(404, 'That agent is not available.', 'not_found');
    }

    const fields = agent.row.input_schema ?? [];
    const inputs = coerceAgentInputs(fields, body.inputs);
    const problems = validateAgentInputs(fields, inputs);
    if (problems.length) {
      throw new ApiError(422, problems[0], 'invalid_agent_input');
    }

    const outreach = agent.row.supports_outreach && body.outreach ? body.outreach : undefined;
    if (outreach?.enabled) {
      if (!outreach.mailbox_id) {
        throw new ApiError(422, 'Choose the mailbox that should send the emails.', 'mailbox_required');
      }
      const { data: mailbox } = await db
        .from('mailboxes')
        .select('id, status')
        .eq('id', outreach.mailbox_id)
        .eq('organization_id', session.organizationId)
        .maybeSingle();
      if (!mailbox) throw new ApiError(422, 'Choose a mailbox that belongs to this workspace.', 'mailbox_required');
      if (mailbox.status !== 'connected') {
        throw new ApiError(422, 'Reconnect the chosen mailbox before starting the task.', 'mailbox_required');
      }
      if (!outreach.template_id && !(outreach.subject && outreach.body)) {
        throw new ApiError(422, 'Choose a template or write a subject and body for the outreach.', 'template_required');
      }
      if (outreach.template_id) {
        const { data: template } = await db
          .from('email_templates')
          .select('id')
          .eq('id', outreach.template_id)
          .eq('organization_id', session.organizationId)
          .is('archived_at', null)
          .maybeSingle();
        if (!template) throw new ApiError(422, 'Choose a template that belongs to this workspace.', 'template_required');
      }
    }

    let runAt: Date | null = null;
    if (body.mode === 'schedule') {
      if (!body.send_at) throw new ApiError(422, 'Choose a date and time for the task.', 'send_at_required');
      runAt = new Date(body.send_at);
      if (Number.isNaN(runAt.getTime()) || runAt.getTime() < Date.now() - 60_000) {
        throw new ApiError(422, 'The scheduled time must be in the future.', 'send_at_required');
      }
    }

    const { data: runRow, error: runError } = await db
      .from('ai_agent_runs')
      .insert({
        organization_id: session.organizationId,
        agent_id: agent.row.id,
        user_id: session.userId,
        status: 'queued',
        source: body.source,
        inputs,
        outreach: outreach ?? {},
        scheduled_for: runAt?.toISOString() ?? null,
      })
      .select('id')
      .single();
    if (runError || !runRow) throw new ApiError(500, 'Could not start the agent task.');
    const runId = runRow.id as string;

    if (body.source === 'automation') {
      const workflow = await ensureAgentWorkflow({
        db,
        organizationId: session.organizationId,
        userId: session.userId,
        agent: agent.row,
        automationId: body.automation_id ?? null,
        mode: body.mode,
        sendAt: runAt?.toISOString() ?? null,
      });
      const executionId = await startAutomationExecution({
        db,
        organizationId: session.organizationId,
        workflowId: workflow.id,
      });
      await db.from('ai_agent_runs').update({ automation_id: workflow.id, automation_execution_id: executionId }).eq('id', runId);
    }

    await enqueueJob({
      jobType: 'agents.run',
      organizationId: session.organizationId,
      payload: { runId, agentId: agent.row.id },
      runAt: runAt ?? undefined,
      maxAttempts: 3,
      idempotencyKey: `agents.run:${runId}`,
    });

    await writeAudit({
      organizationId: session.organizationId,
      actorId: session.userId,
      actorEmail: session.email,
      action: 'agent.run_started',
      entityType: 'ai_agent_run',
      entityId: runId,
      request,
      metadata: { agent: agent.row.slug, mode: body.mode, source: body.source, scheduled_for: runAt?.toISOString() ?? null },
    });

    return ok(
      {
        id: runId,
        status: 'queued',
        mode: body.mode,
        scheduledFor: runAt?.toISOString() ?? null,
        agent: agent.row.slug,
      },
      { status: 202 },
    );
  });
}
