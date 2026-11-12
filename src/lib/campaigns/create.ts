/**
 * Creating a campaign.
 *
 * Shared by the campaign API and by the AI agent outreach step, so an agent
 * campaign is built with exactly the same rules, placeholders and suppression
 * handling as a campaign created by hand.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '@/lib/http';
import type { CampaignInput } from '@/lib/validation';
import { ensureCampaignSteps } from '@/lib/email/engine';
import { extractRawVariables, validateVariablesAgainstList, type LeadListColumn } from '@/lib/placeholders';
import { partitionSuppressed } from '@/lib/suppression';

export interface CreateCampaignResult {
  campaign: Record<string, unknown>;
  /** Leads that were skipped because they were excluded or suppressed. */
  excluded: number;
}

export async function createCampaign(input: {
  db: SupabaseClient;
  organizationId: string;
  userId: string;
  data: CampaignInput;
}): Promise<CreateCampaignResult> {
  const { db, organizationId, userId, data } = input;
  if (data.interval_min_seconds > data.interval_max_seconds) {
    throw new ApiError(422, 'The minimum sending interval cannot be longer than the maximum.');
  }

  if (data.mailbox_id) {
    const { data: mailbox } = await db.from('mailboxes').select('id, status').eq('id', data.mailbox_id).eq('organization_id', organizationId).maybeSingle();
    if (!mailbox) throw new ApiError(422, 'Choose a mailbox that belongs to this workspace.');
    if (mailbox.status === 'disconnected') throw new ApiError(422, 'Reconnect the chosen mailbox before creating a campaign.');
  }
  let listColumns: LeadListColumn[] | null = null;
  let templateRow: Record<string, unknown> | null = null;
  if (data.template_id) {
    const { data: template } = await db.from('email_templates').select('id, mode, ai_personalization, subject, body_text').eq('id', data.template_id).eq('organization_id', organizationId).is('archived_at', null).maybeSingle();
    if (!template) throw new ApiError(422, 'Choose a template that belongs to this workspace.');
    templateRow = template as Record<string, unknown>;
  }
  if (data.lead_list_id) {
    const { data: list } = await db.from('lead_lists').select('id, columns').eq('id', data.lead_list_id).eq('organization_id', organizationId).is('archived_at', null).maybeSingle();
    if (!list) throw new ApiError(422, 'Choose a lead list that belongs to this workspace.');
    listColumns = list.columns as LeadListColumn[];
  }
  if (!data.template_id && (!data.subject || !data.body)) {
    throw new ApiError(422, 'Provide a template or write a subject and body for this campaign.');
  }

  // Reject templates whose placeholders cannot be rendered for the chosen list.
  if (listColumns) {
    let sources = templateRow
      ? [String(templateRow.subject ?? ''), String(templateRow.body_text ?? '')]
      : [String(data.subject ?? ''), String(data.body ?? '')];
    if (templateRow?.mode === 'group' && data.template_id) {
      const { data: variants } = await db.from('email_template_variants').select('subject, body_text').eq('template_id', data.template_id);
      sources = sources.concat((variants ?? []).flatMap((variant) => [String(variant.subject ?? ''), String(variant.body_text ?? '')]));
    }
    const used = extractRawVariables(...sources);
    const checks = validateVariablesAgainstList(used, listColumns);
    const unsupported = checks.filter((check) => !check.supported).map((check) => `{{${check.key}}}`);
    if (unsupported.length) {
      throw new ApiError(422, `These placeholders have no matching column in the selected lead list: ${unsupported.join(', ')}`, 'unsupported_placeholders');
    }
  }

  const { data: allowed } = await db.rpc('check_org_limit', { p_org: organizationId, p_metric: 'campaigns', p_increment: 1 });
  if (allowed === false) throw new ApiError(402, 'This workspace has reached its campaign limit. Upgrade to create more.', 'plan_limit');

  let templateId = data.template_id ?? null;
  if (!templateId && data.subject && data.body) {
    const { data: template, error: templateError } = await db
      .from('email_templates')
      .insert({
        organization_id: organizationId,
        name: `${data.name.slice(0, 140)} - message`,
        subject: data.subject,
        body_text: data.body,
        body_html: '',
        category: 'Campaign',
        created_by: userId,
      })
      .select('id')
      .single();
    if (templateError || !template) throw new ApiError(500, 'Could not save the campaign message.');
    templateId = template.id as string;
  }

  const aiPersonalization = data.ai_personalization || Boolean(templateRow?.ai_personalization);
  const { data: campaign, error } = await db
    .from('campaigns')
    .insert({
      organization_id: organizationId,
      name: data.name,
      description: data.description ?? null,
      mailbox_id: data.mailbox_id ?? null,
      template_id: templateId,
      lead_list_id: data.lead_list_id ?? null,
      interval_min_seconds: data.interval_min_seconds,
      interval_max_seconds: data.interval_max_seconds,
      ai_personalization: aiPersonalization,
      timezone: data.timezone,
      daily_limit: data.daily_limit,
      status: 'draft',
      created_by: userId,
    })
    .select('*')
    .single();
  if (error || !campaign) throw new ApiError(500, 'Could not create the campaign.');

  await db.from('campaign_settings').insert({
    organization_id: organizationId,
    campaign_id: campaign.id,
    stop_on_reply: data.stop_on_reply,
    max_followups: data.follow_up_days && data.follow_up_days > 0 ? 1 : 0,
    send_window_start: data.send_window_start,
    send_window_end: data.send_window_end,
    weekdays: data.weekdays,
    settings: {
      subject_override: data.subject ?? '',
      body_override: data.body ?? '',
      follow_up_days: data.follow_up_days ?? 0,
      stop_on_reply: data.stop_on_reply,
      max_followups: data.follow_up_days && data.follow_up_days > 0 ? 1 : 0,
    },
  });

  // Build the recipient set. A lead list is the primary source; ad-hoc lead
  // ids are still supported for backwards compatibility.
  let candidateIds: string[] = data.lead_ids.slice(0, 10000);
  if (data.lead_list_id) {
    const { data: listLeads } = await db
      .from('leads')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('lead_list_id', data.lead_list_id)
      .is('deleted_at', null)
      .not('status', 'in', '(unsubscribed,bounced,not_interested)')
      .limit(10000);
    const seen = new Set<string>(candidateIds);
    for (const lead of listLeads ?? []) {
      const id = String(lead.id);
      if (!seen.has(id)) { seen.add(id); candidateIds.push(id); }
    }
  }
  let excludedCount = 0;
  if (candidateIds.length) {
    const { data: validLeads } = await db
      .from('leads')
      .select('id, email')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .in('id', candidateIds);
    const { suppressed } = await partitionSuppressed(db, organizationId, (validLeads ?? []).map((lead) => String(lead.email)));
    const blockedInDb = new Set<string>(suppressed);
    const excludeSet = new Set(data.exclude_lead_ids);
    const rows = (validLeads ?? [])
      .filter((lead) => {
        if (excludeSet.has(String(lead.id))) { excludedCount += 1; return false; }
        if (blockedInDb.has(String(lead.email).trim().toLowerCase())) { excludedCount += 1; return false; }
        return true;
      })
      .map((lead) => lead.id as string)
      .map((leadId) => ({
        organization_id: organizationId,
        campaign_id: campaign.id,
        lead_id: leadId,
        status: 'queued',
      }));
    if (rows.length) await db.from('campaign_leads').upsert(rows, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true });
    await db.from('campaigns').update({ total_leads: rows.length }).eq('id', campaign.id);
  }

  await ensureCampaignSteps(campaign);
  await db.rpc('record_usage', { p_org: organizationId, p_metric: 'campaigns', p_quantity: 1 }).then(() => undefined, () => undefined);

  return { campaign: campaign as Record<string, unknown>, excluded: excludedCount };
}
