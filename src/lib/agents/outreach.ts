/**
 * Turning the outreach part of an agent task into a campaign.
 *
 * The mapping is pure so it can be checked without a database: the runner
 * only has to pass the result to the shared campaign service.
 */

import type { AgentOutreachSettings } from './types';
import type { CampaignInput } from '@/lib/validation';

export interface OutreachCampaignInput {
  name: string;
  description: string;
  outreach: AgentOutreachSettings;
  leadListId: string;
}

/** Build the campaign input for an agent task. */
export function buildOutreachCampaign(input: OutreachCampaignInput): CampaignInput {
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
