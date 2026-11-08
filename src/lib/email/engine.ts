import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { decryptSecret, encryptSecret, randomToken, sha256 } from '@/lib/crypto';
import {
  fetchImapMessages,
  getAccessToken,
  sendEmail,
  type InboundEmail,
  type MailboxCredentials,
} from '@/lib/email/providers';
import { applyUnsubscribeFooter, buildLeadVariables, renderHtml, renderText, textToHtml } from '@/lib/email/template';

const service = () => createServiceClient();

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/$/, '');
}

export function mapCredentials(mailbox: Record<string, unknown>, config: Record<string, unknown>): MailboxCredentials {
  const provider = mailbox.provider as string;
  if (provider === 'gmail') {
    return {
      kind: 'gmail',
      refreshToken: String(config.refresh_token ?? ''),
      accessToken: config.access_token ? String(config.access_token) : undefined,
      expiresAt: config.expires_at ? Number(config.expires_at) : undefined,
    };
  }
  if (provider === 'outlook') {
    return {
      kind: 'outlook',
      refreshToken: String(config.refresh_token ?? ''),
      accessToken: config.access_token ? String(config.access_token) : undefined,
      expiresAt: config.expires_at ? Number(config.expires_at) : undefined,
      tenant: config.tenant ? String(config.tenant) : undefined,
    };
  }
  return {
    kind: 'smtp',
    host: String(config.host ?? ''),
    port: Number(config.port ?? 587),
    secure: Boolean(config.secure),
    username: String(config.username ?? ''),
    password: String(config.password ?? ''),
    imapHost: config.imap_host ? String(config.imap_host) : undefined,
    imapPort: config.imap_port ? Number(config.imap_port) : undefined,
  };
}

export async function saveMailboxCredentials(mailboxId: string, organizationId: string, payload: Record<string, unknown>) {
  const { error } = await service().from('mailbox_credentials').upsert(
    {
      mailbox_id: mailboxId,
      organization_id: organizationId,
      encrypted_payload: encryptSecret(payload),
      key_version: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'mailbox_id' },
  );
  if (error) throw new Error(`Could not store mailbox credentials: ${error.message}`);
}

export async function loadMailboxCredentials(mailboxId: string): Promise<{ credentials: MailboxCredentials; mailbox: Record<string, unknown> }> {
  const db = service();
  const { data: mailbox, error } = await db.from('mailboxes').select('*').eq('id', mailboxId).maybeSingle();
  if (error || !mailbox) throw new Error('Mailbox not found.');
  const { data: stored } = await db.from('mailbox_credentials').select('encrypted_payload').eq('mailbox_id', mailboxId).maybeSingle();
  if (!stored?.encrypted_payload) throw new Error('Mailbox is not connected. Reconnect it and try again.');
  const config = decryptSecret<Record<string, unknown>>(stored.encrypted_payload);
  return { credentials: mapCredentials(mailbox, config), mailbox };
}

export async function createUnsubscribeToken(organizationId: string, leadId: string, campaignId?: string | null) {
  const token = randomToken(32);
  const { error } = await service().from('unsubscribe_tokens').insert({
    organization_id: organizationId,
    lead_id: leadId,
    campaign_id: campaignId ?? null,
    token_hash: sha256(token),
    expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
  });
  if (error) throw new Error(`Could not create unsubscribe token: ${error.message}`);
  return `${appUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

// ── timezone / send window ──────────────────────────────────────
function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour') === '24' ? '0' : get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: weekdayMap[get('weekday')] ?? 1,
  };
}

function timezoneOffsetMs(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  for (let i = 0; i < 2; i += 1) {
    guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - timezoneOffsetMs(guess, timeZone));
  }
  return guess;
}

function parseClock(value: string, fallback: string) {
  const [h, m] = (value || fallback).slice(0, 5).split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : Number(fallback.slice(0, 2)), minute: Number.isFinite(m) ? m : 0 };
}

export function nextSendWindow(now: Date, timeZone: string, start: string, end: string, weekdays: number[]): Date {
  const startClock = parseClock(start, '09:00');
  const endClock = parseClock(end, '17:00');
  const days = weekdays.length ? weekdays : [1, 2, 3, 4, 5];
  for (let offset = 0; offset < 10; offset += 1) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const p = zonedParts(probe, timeZone);
    if (!days.includes(p.weekday)) continue;
    const windowStart = zonedTimeToUtc(p.year, p.month, p.day, startClock.hour, startClock.minute, timeZone);
    const windowEnd = zonedTimeToUtc(p.year, p.month, p.day, endClock.hour, endClock.minute, timeZone);
    if (now < windowStart) return windowStart;
    if (now >= windowStart && now < windowEnd) return now;
  }
  return now;
}

// ── campaign seeding ────────────────────────────────────────────
type CampaignRecord = Record<string, unknown>;

export async function ensureCampaignSteps(campaign: CampaignRecord): Promise<Array<Record<string, unknown>>> {
  const db = service();
  const { data: existing } = await db
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaign.id as string)
    .order('step_order');
  if (existing?.length) return existing;

  const { data: settingsRow } = await db.from('campaign_settings').select('settings, max_followups').eq('campaign_id', campaign.id as string).maybeSingle();
  const settings = (settingsRow?.settings as Record<string, unknown> | null) ?? {};
  const subject = String(settings.subject_override ?? settings.subject ?? '');
  const body = String(settings.body_override ?? settings.body ?? '');
  const followUpDays = Number(settings.follow_up_days ?? 0);
  const maxFollowups = Number(settings.max_followups ?? settingsRow?.max_followups ?? 0);
  const rows = [
    {
      organization_id: campaign.organization_id,
      campaign_id: campaign.id,
      step_order: 1,
      step_type: 'initial',
      delay_days: 0,
      delay_hours: 0,
      template_id: campaign.template_id ?? null,
      subject_override: subject || null,
      body_override: body || null,
      condition: { stop_on_reply: settings.stop_on_reply !== false },
    },
  ];
  if (followUpDays > 0 && maxFollowups > 0) {
    for (let i = 1; i <= maxFollowups; i += 1) {
      rows.push({
        organization_id: campaign.organization_id,
        campaign_id: campaign.id,
        step_order: i + 1,
        step_type: 'follow_up',
        delay_days: followUpDays,
        delay_hours: 0,
        template_id: campaign.template_id ?? null,
        subject_override: subject || null,
        body_override: body || null,
        condition: { stop_on_reply: settings.stop_on_reply !== false },
      });
    }
  }
  const { data, error } = await db.from('campaign_steps').insert(rows).select('*').order('step_order');
  if (error) throw new Error(`Could not create campaign steps: ${error.message}`);
  return data ?? [];
}

export async function seedCampaignExecutions(organizationId: string, campaignId: string, startAt = new Date()) {
  const db = service();
  const { data: campaign, error } = await db.from('campaigns').select('*').eq('id', campaignId).eq('organization_id', organizationId).maybeSingle();
  if (error || !campaign) throw new Error('Campaign not found.');
  const steps = await ensureCampaignSteps(campaign);
  const initialStep = steps[0];
  if (!initialStep) throw new Error('Campaign has no sending steps.');

  const { data: settingsRows } = await db.from('campaign_settings').select('*').eq('campaign_id', campaignId).maybeSingle();
  const settings = settingsRows ?? {};
  const timezone = String(campaign.timezone || 'UTC');
  const first = nextSendWindow(startAt, timezone, String(settings.send_window_start ?? '09:00'), String(settings.send_window_end ?? '17:00'), (settings.weekdays as number[]) ?? [1, 2, 3, 4, 5]);

  const { data: campaignLeads } = await db
    .from('campaign_leads')
    .select('id, lead_id, status')
    .eq('campaign_id', campaignId)
    .eq('organization_id', organizationId);
  if (!campaignLeads?.length) return { queued: 0 };

  const rows = campaignLeads
    .filter((cl) => ['queued', 'active'].includes(String(cl.status)))
    .map((cl) => ({
      organization_id: organizationId,
      campaign_id: campaignId,
      campaign_lead_id: cl.id,
      lead_id: cl.lead_id,
      step_id: initialStep.id,
      step_order: initialStep.step_order,
      status: 'queued',
      scheduled_for: first.toISOString(),
      idempotency_key: `campaign:${campaignId}:lead:${cl.lead_id}:step:${initialStep.step_order}`,
    }));

  if (rows.length) {
    const { error: insertError } = await db.from('campaign_executions').upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if (insertError) throw new Error(`Could not queue campaign: ${insertError.message}`);
    await db.from('campaign_leads').update({ status: 'active', next_send_at: first.toISOString() }).in('id', campaignLeads.map((c) => c.id)).in('status', ['queued', 'active']);
  }

  await db.from('campaigns').update({ total_leads: campaignLeads.length }).eq('id', campaignId);
  return { queued: rows.length };
}

export async function activateScheduledCampaigns() {
  const db = service();
  const { data: due } = await db
    .from('campaigns')
    .select('id, organization_id')
    .eq('status', 'scheduled')
    .lte('launch_at', new Date().toISOString())
    .limit(20);
  let activated = 0;
  for (const campaign of due ?? []) {
    const { error } = await db.from('campaigns').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', campaign.id).eq('status', 'scheduled');
    if (error) continue;
    await ensureCampaignSteps(campaign as CampaignRecord);
    await seedCampaignExecutions(campaign.organization_id as string, campaign.id as string);
    await db.from('campaign_schedules').update({ status: 'completed' }).eq('campaign_id', campaign.id).eq('status', 'pending');
    activated += 1;
  }
  return activated;
}

// ── send pipeline ───────────────────────────────────────────────
function classifyReply(text: string): 'interested' | 'not_interested' | 'out_of_office' | 'unsubscribe' | 'question' | 'other' {
  const lower = text.toLowerCase();
  if (/unsubscribe|remove me|stop emailing|opt out|don't contact|do not contact/.test(lower)) return 'unsubscribe';
  if (/out of (the )?office|maternity leave|on vacation|auto[- ]?reply/.test(lower)) return 'out_of_office';
  if (/not interested|no thanks|not a fit|no thank you/.test(lower)) return 'not_interested';
  if (/interested|let'?s talk|book a (call|meeting)|schedule|happy to chat|tell me more|sounds good/.test(lower)) return 'interested';
  if (/\?/.test(text)) return 'question';
  return 'other';
}

async function getOrCreateThread(input: {
  organizationId: string;
  mailboxId: string | null;
  leadId: string | null;
  campaignId: string | null;
  subject: string;
  providerThreadId?: string | null;
}) {
  const db = service();
  if (input.providerThreadId) {
    const { data } = await db
      .from('email_threads')
      .select('*')
      .eq('organization_id', input.organizationId)
      .eq('mailbox_id', input.mailboxId)
      .eq('provider_thread_id', input.providerThreadId)
      .maybeSingle();
    if (data) return data;
  }
  if (input.leadId) {
    const { data: existing } = await db
      .from('email_threads')
      .select('*')
      .eq('organization_id', input.organizationId)
      .eq('lead_id', input.leadId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing;
  }
  const { data, error } = await db
    .from('email_threads')
    .insert({
      organization_id: input.organizationId,
      mailbox_id: input.mailboxId,
      lead_id: input.leadId,
      campaign_id: input.campaignId,
      provider_thread_id: input.providerThreadId ?? null,
      subject: input.subject,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Could not create thread: ${error?.message ?? 'unknown error'}`);
  return data;
}

function renderStepContent(step: Record<string, unknown>, template: Record<string, unknown> | null, vars: Record<string, string | null | undefined>) {
  const subjectTemplate = String(step.subject_override ?? template?.subject ?? '');
  const textTemplate = String(step.body_override ?? template?.body_text ?? '');
  const htmlTemplate = String(template?.body_html ?? '');
  const subject = renderText(subjectTemplate, vars).trim();
  const text = renderText(textTemplate, vars);
  const html = htmlTemplate ? renderHtml(htmlTemplate, vars) : textToHtml(text);
  return { subject, text, html };
}

export interface SendTickResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function runSendingTick(limit = 25): Promise<SendTickResult> {
  const db = service();
  const result: SendTickResult = { processed: 0, sent: 0, skipped: 0, failed: 0, errors: [] };
  const { data: due, error } = await db
    .from('campaign_executions')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw new Error(`Could not load due executions: ${error.message}`);

  for (const execution of due ?? []) {
    result.processed += 1;
    try {
      const outcome = await sendExecution(execution.id as string);
      if (outcome === 'sent') result.sent += 1;
      else result.skipped += 1;
    } catch (err) {
      result.failed += 1;
      const message = err instanceof Error ? err.message : 'Unknown send error';
      result.errors.push(message.slice(0, 300));
    }
  }
  return result;
}

export async function sendExecution(executionId: string): Promise<'sent' | 'skipped'> {
  const db = service();
  const { data: execution, error } = await db.from('campaign_executions').select('*').eq('id', executionId).maybeSingle();
  if (error || !execution) throw new Error('Execution not found.');
  if (execution.status !== 'queued') return 'skipped';

  const { data: campaign } = await db.from('campaigns').select('*').eq('id', execution.campaign_id).maybeSingle();
  if (!campaign) throw new Error('Campaign was deleted.');
  if (campaign.status === 'paused') {
    // Keep the execution queued while the campaign is paused.
    return 'skipped';
  }
  if (campaign.status !== 'active') {
    await db.from('campaign_executions').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('id', executionId).eq('status', 'queued');
    return 'skipped';
  }

  const { data: campaignLead } = await db.from('campaign_leads').select('*').eq('id', execution.campaign_lead_id).maybeSingle();
  const { data: lead } = await db.from('leads').select('*').eq('id', execution.lead_id).maybeSingle();
  if (!campaignLead || !lead) throw new Error('Lead for this execution no longer exists.');

  if (['unsubscribed', 'bounced', 'not_interested', 'replied'].includes(String(lead.status)) || ['replied', 'unsubscribed', 'bounced'].includes(String(campaignLead.status))) {
    await db.from('campaign_executions').update({ status: 'skipped', finished_at: new Date().toISOString(), error: 'Lead is no longer eligible.' }).eq('id', executionId).eq('status', 'queued');
    return 'skipped';
  }

  const { data: suppressed } = await db.rpc('is_suppressed', { p_org: execution.organization_id, p_email: lead.email });
  if (suppressed === true) {
    await db.from('campaign_executions').update({ status: 'skipped', finished_at: new Date().toISOString(), error: 'Recipient is on the suppression list.' }).eq('id', executionId).eq('status', 'queued');
    await db.from('campaign_leads').update({ status: 'unsubscribed', next_send_at: null }).eq('id', execution.campaign_lead_id);
    return 'skipped';
  }

  if (!campaign.mailbox_id) throw new Error('Campaign has no mailbox assigned.');
  let mailbox: Record<string, unknown>;
  let credentials: MailboxCredentials;
  try {
    const loaded = await loadMailboxCredentials(campaign.mailbox_id as string);
    mailbox = loaded.mailbox;
    credentials = loaded.credentials;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Mailbox credentials unavailable.');
  }
  if (String(mailbox.organization_id) !== String(execution.organization_id)) throw new Error('Mailbox does not belong to this workspace.');
  if (mailbox.status !== 'connected') throw new Error('Mailbox is not connected. Reconnect it before sending.');
  if (Number(mailbox.sent_today ?? 0) >= Number(mailbox.daily_limit ?? 100)) {
    await db.from('campaign_executions').update({ scheduled_for: new Date(Date.now() + 86_400_000).toISOString() }).eq('id', executionId).eq('status', 'queued');
    return 'skipped';
  }

  // Claim atomically so two workers cannot send the same message.
  const { data: claimed } = await db.from('campaign_executions').update({ status: 'processing', started_at: new Date().toISOString(), attempts: Number(execution.attempts ?? 0) + 1 }).eq('id', executionId).eq('status', 'queued').select('id').maybeSingle();
  if (!claimed) return 'skipped';

  try {
    const { data: settings } = await db.from('campaign_settings').select('*').eq('campaign_id', execution.campaign_id).maybeSingle();
    const timezone = String(campaign.timezone || 'UTC');
    const now = new Date();
    const windowStart = nextSendWindow(now, timezone, String(settings?.send_window_start ?? '09:00'), String(settings?.send_window_end ?? '17:00'), (settings?.weekdays as number[]) ?? [1, 2, 3, 4, 5]);
    if (windowStart.getTime() > now.getTime()) {
      await db.from('campaign_executions').update({ status: 'queued', scheduled_for: windowStart.toISOString(), started_at: null }).eq('id', executionId);
      return 'skipped';
    }

    const { data: step } = execution.step_id
      ? await db.from('campaign_steps').select('*').eq('id', execution.step_id).maybeSingle()
      : { data: null };
    const templateId = step?.template_id ?? campaign.template_id ?? null;
    const { data: template } = templateId
      ? await db.from('email_templates').select('*').eq('id', templateId).eq('organization_id', execution.organization_id).maybeSingle()
      : { data: null };

    const { data: org } = await db.from('organizations').select('name').eq('id', execution.organization_id).maybeSingle();
    const vars = {
      ...buildLeadVariables(lead),
      sender_name: String(mailbox.display_name || org?.name || 'ColdFox user'),
      sender_company: String(org?.name || ''),
    };
    const content = renderStepContent(step ?? {}, template ?? null, vars);
    if (!content.subject) throw new Error('Email subject is empty. Add a subject before sending.');
    if (!content.text.trim()) throw new Error('Email body is empty. Add a body before sending.');

    const unsubscribeUrl = await createUnsubscribeToken(execution.organization_id, execution.lead_id, execution.campaign_id);
    const withFooter = applyUnsubscribeFooter(content.text, content.html, unsubscribeUrl);
    const mailtoUnsubscribe = process.env.EMAIL_FROM_ADDRESS ? `mailto:${process.env.EMAIL_FROM_ADDRESS}?subject=unsubscribe` : null;
    const headers: Record<string, string> = {
      'List-Unsubscribe': `<${unsubscribeUrl}>${mailtoUnsubscribe ? `, <${mailtoUnsubscribe}>` : ''}`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-ColdFox-Campaign': String(execution.campaign_id),
    };

    const outcome = await sendEmail(credentials, {
      fromName: String(mailbox.display_name || org?.name || 'ColdFox'),
      fromEmail: String(mailbox.email_address),
      to: String(lead.email),
      subject: content.subject,
      text: withFooter.text,
      html: withFooter.html,
      headers,
    });

    const thread = await getOrCreateThread({
      organizationId: execution.organization_id,
      mailboxId: campaign.mailbox_id as string,
      leadId: execution.lead_id,
      campaignId: execution.campaign_id,
      subject: content.subject,
    });
    await db.from('email_messages').insert({
      organization_id: execution.organization_id,
      thread_id: thread.id,
      mailbox_id: campaign.mailbox_id,
      lead_id: execution.lead_id,
      campaign_id: execution.campaign_id,
      direction: 'outbound',
      from_email: String(mailbox.email_address),
      from_name: mailbox.display_name ? String(mailbox.display_name) : null,
      to_emails: [String(lead.email)],
      subject: content.subject,
      body_text: withFooter.text,
      body_html: withFooter.html,
      snippet: content.text.slice(0, 400),
      provider_message_id: outcome.providerMessageId,
      sent_at: outcome.acceptedAt,
      is_read: true,
    });

    await db.from('campaign_executions').update({
      status: 'accepted',
      provider_message_id: outcome.providerMessageId,
      finished_at: new Date().toISOString(),
      error: null,
    }).eq('id', executionId);

    await db.from('campaign_leads').update({ status: step?.step_type === 'follow_up' ? 'completed' : 'sent', last_sent_at: new Date().toISOString(), current_step: Number(execution.step_order ?? 1) }).eq('id', execution.campaign_lead_id);
    await db.from('leads').update({ status: lead.status === 'new' ? 'contacted' : lead.status, last_contacted_at: new Date().toISOString() }).eq('id', execution.lead_id);

    await Promise.allSettled([
      db.rpc('increment_campaign_stat', { p_campaign: execution.campaign_id, p_stat: 'emails_sent' }),
      db.rpc('record_mailbox_send', { p_mailbox: campaign.mailbox_id, p_org: execution.organization_id, p_success: true }),
      db.rpc('record_usage', { p_org: execution.organization_id, p_metric: 'emails', p_quantity: 1, p_metadata: { campaign_id: execution.campaign_id } }),
      db.from('email_events').insert({
        organization_id: execution.organization_id,
        campaign_id: execution.campaign_id,
        lead_id: execution.lead_id,
        event_type: 'accepted',
        metadata: { provider: outcome.provider, execution_id: executionId },
      }),
      db.from('campaign_events').insert({
        organization_id: execution.organization_id,
        campaign_id: execution.campaign_id,
        lead_id: execution.lead_id,
        execution_id: executionId,
        event_type: 'sent',
        metadata: { provider: outcome.provider },
      }),
    ]);

    await scheduleNextStep(execution, campaign, step ?? null);
    return 'sent';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown send error';
    // A failed provider call is ambiguous: the message may have been accepted.
    // Never auto-retry; a human must confirm before resending.
    await db.from('campaign_executions').update({
      status: 'failed',
      error: message.slice(0, 1000),
      finished_at: new Date().toISOString(),
    }).eq('id', executionId);
    await db.from('campaign_leads').update({ status: 'error', error: message.slice(0, 500), next_send_at: null }).eq('id', execution.campaign_lead_id);
    // Record the failure against the mailbox, but do not flip its status:
    // a bad template should not block an otherwise healthy account.
    await db.from('mailboxes').update({ last_error: message.slice(0, 500) }).eq('id', campaign.mailbox_id);
    await db.rpc('record_mailbox_send', { p_mailbox: campaign.mailbox_id, p_org: execution.organization_id, p_success: false }).then(() => undefined);
    throw err;
  }
}

async function scheduleNextStep(execution: Record<string, unknown>, campaign: Record<string, unknown>, currentStep: Record<string, unknown> | null) {
  const db = service();
  const { data: settings } = await db.from('campaign_settings').select('*').eq('campaign_id', campaign.id).maybeSingle();
  if (!settings) return;
  if (currentStep && currentStep.step_type === 'follow_up' && Number(currentStep.step_order) >= Number(settings.max_followups ?? 0) + 1) return;

  const { data: nextStep } = await db
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaign.id)
    .gt('step_order', Number(execution.step_order ?? 1))
    .order('step_order')
    .limit(1)
    .maybeSingle();
  if (!nextStep) return;

  const delayMs = (Number(nextStep.delay_days ?? 0) * 86_400 + Number(nextStep.delay_hours ?? 0) * 3_600_000);
  const scheduled = nextSendWindow(
    new Date(Date.now() + delayMs),
    String(campaign.timezone || 'UTC'),
    String(settings.send_window_start ?? '09:00'),
    String(settings.send_window_end ?? '17:00'),
    (settings.weekdays as number[]) ?? [1, 2, 3, 4, 5],
  );
  await db.from('campaign_executions').upsert(
    {
      organization_id: execution.organization_id,
      campaign_id: execution.campaign_id,
      campaign_lead_id: execution.campaign_lead_id,
      lead_id: execution.lead_id,
      step_id: nextStep.id,
      step_order: nextStep.step_order,
      status: 'queued',
      scheduled_for: scheduled.toISOString(),
      idempotency_key: `campaign:${execution.campaign_id}:lead:${execution.lead_id}:step:${nextStep.step_order}`,
    },
    { onConflict: 'idempotency_key', ignoreDuplicates: true },
  );
  await db.from('campaign_leads').update({ next_send_at: scheduled.toISOString() }).eq('id', execution.campaign_lead_id);
}

// ── inbox sync ──────────────────────────────────────────────────
function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function gmailBody(payload: Record<string, unknown> | undefined): { text: string; html?: string } {
  if (!payload) return { text: '' };
  const parts = (payload.parts as Array<Record<string, unknown>> | undefined) ?? [];
  const mime = String(payload.mimeType ?? '');
  const bodyData = (payload.body as { data?: string } | undefined)?.data;
  if (mime === 'text/plain' && bodyData) return { text: decodeBase64Url(bodyData) };
  if (mime === 'text/html' && bodyData) return { text: '', html: decodeBase64Url(bodyData) };
  let text = '';
  let html: string | undefined;
  for (const part of parts) {
    const parsed = gmailBody(part);
    if (parsed.text) text += parsed.text;
    if (parsed.html) html = parsed.html;
  }
  return { text, html };
}

async function fetchGmailMessages(creds: MailboxCredentials): Promise<InboundEmail[]> {
  const token = await getAccessToken(creds);
  const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=' + encodeURIComponent('in:inbox newer_than:2d'), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!listRes.ok) throw new Error(`Gmail inbox request failed (${listRes.status}).`);
  const list = (await listRes.json()) as { messages?: { id: string; threadId: string }[] };
  const out: InboundEmail[] = [];
  for (const item of (list.messages ?? []).slice(0, 25)) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) continue;
    const msg = (await res.json()) as { id: string; threadId: string; payload?: Record<string, unknown>; internalDate?: string };
    const headers = ((msg.payload?.headers as { name: string; value: string }[] | undefined) ?? []).reduce<Record<string, string>>((acc, h) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    }, {});
    const fromMatch = /<([^>]+)>|([^\s]+@[^\s]+)/.exec(headers.from ?? '');
    const fromEmail = (fromMatch?.[1] || fromMatch?.[2] || '').toLowerCase();
    if (!fromEmail) continue;
    const body = gmailBody(msg.payload);
    out.push({
      providerMessageId: msg.id,
      threadId: msg.threadId,
      fromEmail,
      fromName: (headers.from ?? '').replace(/<[^>]+>/, '').replace(/"/g, '').trim() || undefined,
      to: (headers.to ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      subject: headers.subject ?? '(no subject)',
      text: body.text || (body.html ?? '').replace(/<[^>]+>/g, ' '),
      html: body.html,
      messageId: headers['message-id'],
      inReplyTo: headers['in-reply-to'],
      references: (headers.references ?? '').split(/\s+/).filter(Boolean),
      receivedAt: new Date(Number(msg.internalDate ?? Date.now())).toISOString(),
    });
  }
  return out;
}

async function fetchGraphMessages(creds: MailboxCredentials): Promise<InboundEmail[]> {
  const token = await getAccessToken(creds);
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=25&$orderby=receivedDateTime%20desc&$filter=${encodeURIComponent(`receivedDateTime ge ${since}`)}&$select=id,internetMessageId,conversationId,from,toRecipients,subject,body,receivedDateTime,internetMessageHeaders`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Microsoft inbox request failed (${res.status}).`);
  const data = (await res.json()) as {
    value?: Array<{
      id: string;
      internetMessageId?: string;
      conversationId?: string;
      from?: { emailAddress?: { address?: string; name?: string } };
      toRecipients?: { emailAddress?: { address?: string } }[];
      subject?: string;
      body?: { contentType?: string; content?: string };
      receivedDateTime?: string;
      internetMessageHeaders?: { name: string; value: string }[];
    }>;
  };
  return (data.value ?? []).map((msg) => {
    const headers = (msg.internetMessageHeaders ?? []).reduce<Record<string, string>>((acc, h) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    }, {});
    const isHtml = msg.body?.contentType?.toLowerCase() === 'html';
    return {
      providerMessageId: msg.internetMessageId || msg.id,
      threadId: msg.conversationId,
      fromEmail: (msg.from?.emailAddress?.address ?? '').toLowerCase(),
      fromName: msg.from?.emailAddress?.name,
      to: (msg.toRecipients ?? []).map((r) => r.emailAddress?.address ?? '').filter(Boolean),
      subject: msg.subject ?? '(no subject)',
      text: isHtml ? (msg.body?.content ?? '').replace(/<[^>]+>/g, ' ') : (msg.body?.content ?? ''),
      html: isHtml ? msg.body?.content : undefined,
      messageId: headers['message-id'] ?? msg.internetMessageId,
      inReplyTo: headers['in-reply-to'],
      references: (headers.references ?? '').split(/\s+/).filter(Boolean),
      receivedAt: msg.receivedDateTime ?? new Date().toISOString(),
    } satisfies InboundEmail;
  }).filter((m) => m.fromEmail);
}

export async function syncMailbox(mailboxId: string): Promise<{ synced: number; replies: number }> {
  const db = service();
  const { data: mailbox } = await db.from('mailboxes').select('*').eq('id', mailboxId).maybeSingle();
  if (!mailbox || mailbox.status === 'disconnected') return { synced: 0, replies: 0 };
  const { credentials } = await loadMailboxCredentials(mailboxId);

  let inbound: InboundEmail[] = [];
  if (credentials.kind === 'smtp') inbound = await fetchImapMessages(credentials, { sinceDays: 2, limit: 30 });
  else if (credentials.kind === 'gmail') inbound = await fetchGmailMessages(credentials);
  else inbound = await fetchGraphMessages(credentials);

  let synced = 0;
  let replies = 0;
  for (const message of inbound) {
    if (message.fromEmail === String(mailbox.email_address).toLowerCase()) continue;
    const { data: existing } = await db.from('email_messages').select('id').eq('provider_message_id', message.providerMessageId).maybeSingle();
    if (existing) continue;

    const { data: lead } = await db
      .from('leads')
      .select('*')
      .eq('organization_id', mailbox.organization_id)
      .eq('email_normalized', message.fromEmail)
      .is('deleted_at', null)
      .maybeSingle();

    const { data: outboundThread } = lead
      ? await db
          .from('email_threads')
          .select('*')
          .eq('organization_id', mailbox.organization_id)
          .eq('lead_id', lead.id)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const thread =
      outboundThread ??
      (await getOrCreateThread({
        organizationId: mailbox.organization_id,
        mailboxId,
        leadId: (lead?.id as string | undefined) ?? null,
        campaignId: null,
        subject: message.subject,
        providerThreadId: message.threadId ?? null,
      }));

    const classification = classifyReply(message.text);
    const { data: inserted, error } = await db
      .from('email_messages')
      .insert({
        organization_id: mailbox.organization_id,
        thread_id: thread.id,
        mailbox_id: mailboxId,
        lead_id: lead?.id ?? null,
        campaign_id: thread.campaign_id ?? null,
        direction: 'inbound',
        from_email: message.fromEmail,
        from_name: message.fromName ?? null,
        to_emails: message.to,
        subject: message.subject,
        body_text: message.text,
        body_html: message.html ?? null,
        snippet: message.text.slice(0, 400),
        provider_message_id: message.providerMessageId,
        in_reply_to: message.inReplyTo ?? null,
        references_ids: message.references,
        received_at: message.receivedAt,
        is_read: false,
      })
      .select('id')
      .single();
    if (error || !inserted) continue;

    await db.from('email_threads').update({ last_message_at: message.receivedAt, unread_count: Number(thread.unread_count ?? 0) + 1, subject: thread.subject ?? message.subject }).eq('id', thread.id);
    synced += 1;

    if (lead) {
      if (lead.status !== 'unsubscribed' && lead.status !== 'bounced') {
        await db.from('leads').update({ status: classification === 'not_interested' ? 'not_interested' : 'replied', next_follow_up_at: null }).eq('id', lead.id);
      }
      if (thread.campaign_id) {
        await db.from('campaign_leads').update({ status: 'replied', next_send_at: null }).eq('campaign_id', thread.campaign_id).eq('lead_id', lead.id);
        await db.from('campaign_executions').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('campaign_id', thread.campaign_id).eq('lead_id', lead.id).in('status', ['queued', 'processing']);
        await db.rpc('increment_campaign_stat', { p_campaign: thread.campaign_id, p_stat: 'replies' });
        await db.from('campaign_events').insert({ organization_id: mailbox.organization_id, campaign_id: thread.campaign_id, lead_id: lead.id, event_type: 'replied', metadata: { classification } });
      }
      await db.from('email_replies').insert({
        organization_id: mailbox.organization_id,
        thread_id: thread.id,
        message_id: inserted.id,
        lead_id: lead.id,
        campaign_id: thread.campaign_id,
        classification,
      });
      await db.from('email_events').insert({ organization_id: mailbox.organization_id, campaign_id: thread.campaign_id, lead_id: lead.id, event_type: 'replied', metadata: { classification } });
      const notifyUser = (lead.owner_id as string | null) ?? (mailbox.user_id as string | null);
      if (notifyUser) {
        try {
          await db.from('notifications').insert({
            organization_id: mailbox.organization_id,
            user_id: notifyUser,
            notification_type: 'reply',
            title: `New reply from ${lead.first_name ?? lead.email}`,
            body: message.subject,
            link: '/app/inbox',
          });
        } catch {
          // notifications are best-effort
        }
      }
      replies += 1;

      if (classification === 'unsubscribe') {
        await db.from('suppression_entries').upsert(
          {
            organization_id: mailbox.organization_id,
            email: lead.email,
            email_normalized: String(lead.email).toLowerCase().trim(),
            reason_key: 'unsubscribed',
            source: 'reply',
            notes: 'Recipient asked to stop emailing in a reply.',
          },
          { onConflict: 'organization_id,email_normalized' },
        );
        await db.from('leads').update({ status: 'unsubscribed' }).eq('id', lead.id);
      }
    }
  }

  await db.from('mailboxes').update({ status: 'connected', last_sync_at: new Date().toISOString(), last_error: null }).eq('id', mailboxId);
  await db.from('mailbox_sync_state').upsert(
    { mailbox_id: mailboxId, organization_id: mailbox.organization_id, last_sync_at: new Date().toISOString(), last_error: null },
    { onConflict: 'mailbox_id' },
  );
  return { synced, replies };
}

// ── worker loop ─────────────────────────────────────────────────
export async function runWorkerTick(limit = 25) {
  const db = service();
  const activated = await activateScheduledCampaigns();
  await db.rpc('reset_mailbox_daily_counters').then(() => undefined, () => undefined);

  const sent = await runSendingTick(limit);
  const summary = { activated, ...sent, mailboxesSynced: 0, syncErrors: [] as string[] };

  const { data: mailboxes } = await db.from('mailboxes').select('id').in('status', ['connected', 'syncing']).limit(5);
  for (const mailbox of mailboxes ?? []) {
    try {
      await syncMailbox(mailbox.id as string);
      summary.mailboxesSynced += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      summary.syncErrors.push(message.slice(0, 200));
      await db.from('mailboxes').update({ last_error: message.slice(0, 500) }).eq('id', mailbox.id);
    }
  }
  return summary;
}
