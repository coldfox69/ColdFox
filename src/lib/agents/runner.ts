/**
 * Running an agent task.
 *
 * A run is started from the user panel or from the Automation page. The heavy
 * work happens in the background queue so a slow agent API never blocks a
 * request:
 *
 *   agent API  ->  lead list  ->  campaign  ->  the normal sending engine
 *
 * The campaign is created with the shared campaign service, so the emails are
 * sent by exactly the same engine, with the same suppression list, send window
 * and daily limits as a campaign a user builds by hand.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { runOrgSendingTick, seedCampaignExecutions } from '@/lib/email/engine';
import { importLeadRows } from '@/lib/lead-lists/import';
import { createCampaign } from '@/lib/campaigns/create';
import { callAgentApi } from './api-client';
import { extractLeadRows } from './inputs';
import { getAgentById, readAgentCredential, type AgentRow } from './service';
import type { AgentOutreachSettings } from './types';
import type { CampaignInput } from '@/lib/validation';

const MAX_LEADS = 2000;

function campaignInputFor(input: {
  name: string;
  description: string;
  outreach: AgentOutreachSettings;
  leadListId: string;
}): CampaignInput {
  const outreach = input.outreach;
  return {
    name: input.name.slice(0, 160),
    description: input.description.slice(0, 2000),
    mailbox_id: outreach.mailbox_id ?? null,
    template_id: outreach.template_id ?? null,
    timezone: outreach.timezone ?? 'UTC',
    daily_limit: Math.min(2000, Math.max(1, Number(outreach.daily_limit ?? 100))),
    lead_ids: [],
    lead_list_id: input.leadListId,
    exclude_lead_ids: [],
    subject: outreach.subject?.trim() || undefined,
    body: outreach.body?.trim() || undefined,
    send_window_start: outreach.send_window_start ?? '09:00',
    send_window_end: outreach.send_window_end ?? '17:00',
    weekdays: outreach.weekdays?.length ? outreach.weekdays : [1, 2, 3, 4, 5],
    stop_on_reply: outreach.stop_on_reply ?? true,
    interval_min_seconds: Math.min(3600, Math.max(1, Number(outreach.interval_min_seconds ?? 30))),
    interval_max_seconds: Math.min(3600, Math.max(1, Number(outreach.interval_max_seconds ?? 70))),
    ai_personalization: outreach.ai_personalization ?? false,
  };
}

/** Turn agent lead rows into a spreadsheet shaped import. */
function toImportRows(rows: ReturnType<typeof extractLeadRows>) {
  const headers = ['email', 'first_name', 'last_name', 'company', 'job_title', 'website', 'industry', 'phone', 'linkedin_url', 'city', 'country'];
  const mapping = headers.map((header) => ({ header, field: header === 'company' ? 'company' : header }));
  const body = rows.slice(0, MAX_LEADS).map((row) => [
    row.email,
    row.first_name ?? '',
    row.last_name ?? '',
    row.company_name ?? '',
    row.job_title ?? '',
    row.website ?? '',
    row.industry ?? '',
    row.phone ?? '',
    row.linkedin_url ?? '',
    row.city ?? '',
    row.country ?? '',
  ]);
  return { headers, mapping, rows: body };
}

async function markRun(db: SupabaseClient, runId: string, patch: Record<string, unknown>) {
  await db.from('ai_agent_runs').update(patch).eq('id', runId);
}

async function updateAutomationExecution(db: SupabaseClient, run: Record<string, unknown>, status: string, detail?: string) {
  const executionId = run.automation_execution_id;
  if (!executionId) return;
  await db
    .from('automation_executions')
    .update({ status, finished_at: status === 'running' ? null : new Date().toISOString(), error: detail ?? null })
    .eq('id', executionId);
  await db.from('automation_execution_logs').insert({
    organization_id: run.organization_id,
    execution_id: executionId,
    event: `agent.${status}`,
    detail: detail ? { detail: detail.slice(0, 500) } : {},
  });
}

/** Execute one agent run. Safe to call again: the run status is checked first. */
export async function runAgentTask(runId: string) {
  const db = createServiceClient();
  const { data: runRow } = await db.from('ai_agent_runs').select('*').eq('id', runId).maybeSingle();
  if (!runRow) throw new Error('The agent run no longer exists.');
  const run = runRow as Record<string, unknown>;
  const status = String(run.status ?? '');
  if (status === 'succeeded' || status === 'failed' || status === 'cancelled') return;

  const organizationId = String(run.organization_id);
  const agentId = String(run.agent_id);
  const agent = await getAgentById(db, agentId);
  if (!agent) {
    await markRun(db, runId, { status: 'failed', error: 'This agent is no longer available.', finished_at: new Date().toISOString() });
    await updateAutomationExecution(db, run, 'failed', 'This agent is no longer available.');
    return;
  }
  const agentRow = agent.row as AgentRow;

  await markRun(db, runId, { status: 'running', started_at: new Date().toISOString() });
  await updateAutomationExecution(db, run, 'running');

  const inputs = (run.inputs ?? {}) as Record<string, unknown>;
  const outreach = (run.outreach ?? {}) as AgentOutreachSettings;

  const credential = await readAgentCredential(db, agentId);
  const apiConfigured = Boolean(agentRow.api_config?.base_url) && Boolean(credential?.api_key);
  if (!apiConfigured) {
    // Nothing is invented here: the run stops and says why.
    const message = 'This agent is not connected to an API yet. An administrator has to add the API endpoint and key in Admin, AI agents.';
    await markRun(db, runId, { status: 'awaiting_api', error: message, finished_at: new Date().toISOString() });
    await updateAutomationExecution(db, run, 'stopped', message);
    return;
  }

  const response = await callAgentApi({ agent: agentRow, credential, inputs });
  if (!response.ok) {
    const message = response.error ?? 'The agent API could not be reached.';
    await markRun(db, runId, { status: 'failed', error: message, finished_at: new Date().toISOString(), result: { status: response.status } });
    await updateAutomationExecution(db, run, 'failed', message);
    return;
  }

  const leads = extractLeadRows(response.payload, agentRow.api_config?.results_path);
  const summary = {
    apiStatus: response.status,
    leadCount: leads.length,
    leadListId: null as string | null,
    campaignId: null as string | null,
    note: leads.length ? undefined : 'The agent did not return any lead with a usable email address.',
  };

  if (leads.length) {
    const { headers, mapping, rows } = toImportRows(leads);
    const listName = `${agentRow.name} leads`.slice(0, 150);
    const imported = await importLeadRows({
      db,
      organizationId,
      userId: String(run.user_id ?? ''),
      listName,
      filename: `${agentRow.slug}.csv`,
      headers,
      rows,
      mapping,
      source: 'agent',
    });
    summary.leadListId = imported.leadListId;

    if (outreach.enabled && imported.created > 0) {
      const { campaign } = await createCampaign({
        db,
        organizationId,
        userId: String(run.user_id ?? ''),
        data: campaignInputFor({
          name: outreach.campaign_name?.trim() || `${agentRow.name} outreach`,
          description: `Audience generated by the ${agentRow.name} agent.`,
          outreach,
          leadListId: imported.leadListId,
        }),
      });
      summary.campaignId = campaign.id as string;

      const now = new Date();
      await db
        .from('campaigns')
        .update({ status: 'active', started_at: now.toISOString(), launch_at: now.toISOString() })
        .eq('id', campaign.id);
      await seedCampaignExecutions(organizationId, campaign.id as string, now);
      // Send the first batch right away; the worker keeps the rest going.
      await runOrgSendingTick(organizationId, 10);
    }
  }

  await markRun(db, runId, { status: 'succeeded', error: summary.note ?? null, result: summary, finished_at: new Date().toISOString() });
  await updateAutomationExecution(db, run, 'completed');
  if (summary.campaignId) {
    await db.from('ai_agent_runs').update({ campaign_id: summary.campaignId }).eq('id', runId);
  }
  if (summary.leadListId) {
    await db.from('ai_agent_runs').update({ lead_list_id: summary.leadListId }).eq('id', runId);
  }
}
