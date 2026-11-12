/**
 * Binding an agent task to the Automation page.
 *
 * An agent run can be started from the agent page or from the Automation
 * page. Either way it is recorded as an automation workflow with an
 * `agent_run` step, so it shows up with the other automations and its history
 * is kept.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '@/lib/http';
import type { AgentRow } from './service';

export interface AgentWorkflowInput {
  db: SupabaseClient;
  organizationId: string;
  userId: string;
  agent: AgentRow;
  /** An existing workflow to reuse. */
  automationId?: string | null;
  mode: 'now' | 'schedule';
  sendAt?: string | null;
}

/** Find or create the automation workflow that carries an agent task. */
export async function ensureAgentWorkflow(input: AgentWorkflowInput): Promise<{ id: string; created: boolean }> {
  const { db, organizationId, userId, agent } = input;

  if (input.automationId) {
    const { data } = await db
      .from('automation_workflows')
      .select('id, agent_id, name')
      .eq('id', input.automationId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (!data) throw new ApiError(404, 'That automation no longer exists.', 'not_found');
    if (data.agent_id && String(data.agent_id) !== agent.id) {
      throw new ApiError(422, 'That automation belongs to a different agent.', 'agent_mismatch');
    }
    return { id: String(data.id), created: false };
  }

  const name = `${agent.name} task`.slice(0, 160);
  const { data: workflow, error } = await db
    .from('automation_workflows')
    .insert({
      organization_id: organizationId,
      name,
      description: `Tasks started with the ${agent.name} agent.`,
      status: 'active',
      trigger_type: input.mode === 'schedule' ? 'schedule' : 'manual',
      agent_id: agent.id,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error || !workflow) throw new ApiError(500, 'Could not create the automation for this task.');

  const { error: stepError } = await db.from('automation_steps').insert({
    organization_id: organizationId,
    workflow_id: workflow.id,
    step_order: 1,
    step_type: 'agent_run',
    config: { agent_id: agent.id, mode: input.mode, send_at: input.sendAt ?? null },
  });
  if (stepError) throw new ApiError(500, 'Could not create the automation step for this task.');

  return { id: workflow.id as string, created: true };
}

/** Open an execution record for a workflow so the run shows up in the history. */
export async function startAutomationExecution(input: {
  db: SupabaseClient;
  organizationId: string;
  workflowId: string;
  campaignId?: string | null;
}): Promise<string> {
  const { data, error } = await input.db
    .from('automation_executions')
    .insert({
      organization_id: input.organizationId,
      workflow_id: input.workflowId,
      campaign_id: input.campaignId ?? null,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw new ApiError(500, 'Could not open the automation execution.');
  return data.id as string;
}
