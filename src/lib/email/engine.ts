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
import { findUnresolvedPlaceholders } from '@/lib/placeholders';
import { pickVariant } from '@/lib/email/rotation';
import { personalizeForRecipient } from '@/lib/ai/personalize';
import { nextSendWindow } from '@/lib/timezone';
import { chunk, fetchAllRows } from '@/lib/data/paginate';

export { nextSendWindow };

const service = () => createServiceClient();

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/$/, '');
}

const WORKER_HEARTBEAT_KEY = 'worker_heartbeat';
/** A worker that has not run for this long is treated as not running at all. */
const WORKER_STALE_MS = 5 * 60_000;

/** Record that the scheduled worker ran, so the UI can prove background sending is alive. */
export async function recordWorkerHeartbeat(durationMs: number, summary: Record<string, unknown>) {
  const { error } = await service().from('system_settings').upsert(
    {
      key: WORKER_HEARTBEAT_KEY,
      value: { last_run_at: new Date().toISOString(), duration_ms: durationMs, summary },
      is_public: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  // A missing heartbeat must never fail the send tick that produced it.
  if (error) console.error('[worker] heartbeat write failed', error.message);
}

export async function getWorkerHeartbeat() {
  const { data } = await service().from('system_settings').select('value').eq('key', WORKER_HEARTBEAT_KEY).maybeSingle();
  const value = (data?.value ?? {}) as { last_run_at?: string; duration_ms?: number; summary?: Record<string, unknown> };
  const lastRunAt = value.last_run_at ?? null;
  const ageMs = lastRunAt ? Date.now() - new Date(lastRunAt).getTime() : Number.POSITIVE_INFINITY;
  return {
    lastRunAt,
    ageSeconds: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 1000)) : null,
    stale: ageMs > WORKER_STALE_MS,
    lastSummary: value.summary ?? null,
  };
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
  // The mailbox row and the encrypted credentials are independent reads: fetch them together.
  const [mailboxResult, credentialsResult] = await Promise.all([
    db.from('mailboxes').select('*').eq('id', mailboxId).maybeSingle(),
    db.from('mailbox_credentials').select('encrypted_payload').eq('mailbox_id', mailboxId).maybeSingle(),
  ]);
  const { data: mailbox, error } = mailboxResult;
  if (error || !mailbox) throw new Error('Mailbox not found.');
  const { data: stored } = credentialsResult;
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

  // Settings and campaign leads do not depend on each other: read them in one round-trip.
  // The lead read is paged because a campaign can hold far more recipients than
  // PostgREST returns in a single response.
  const [settingsResult, campaignLeads] = await Promise.all([
    db.from('campaign_settings').select('*').eq('campaign_id', campaignId).maybeSingle(),
    fetchAllRows<{ id: string; lead_id: string; status: string }>(
      (from, to) => db
        .from('campaign_leads')
        .select('id, lead_id, status')
        .eq('campaign_id', campaignId)
        .eq('organization_id', organizationId)
        .order('id')
        .range(from, to),
      { maxRows: 100_000 },
    ),
  ]);
  const settings = settingsResult.data ?? {};
  const timezone = String(campaign.timezone || 'UTC');
  const windowStart = (settings.send_window_start ?? '09:00') as string;
  const windowEnd = (settings.send_window_end ?? '17:00') as string;
  const weekdays = (settings.weekdays as number[]) ?? [1, 2, 3, 4, 5];
  const first = nextSendWindow(startAt, timezone, String(windowStart), String(windowEnd), weekdays);
  // Every recipient gets its own jittered slot inside the configured pause range.
  const minSec = Math.max(1, Number(campaign.interval_min_seconds ?? 30));
  const maxSec = Math.max(minSec, Number(campaign.interval_max_seconds ?? 70));
  const planned = campaignLeads.filter((cl) => ['queued', 'active'].includes(String(cl.status)));
  const reservations: Date[] = [];
  let cursor = first.getTime();
  for (let i = 0; i < planned.length; i += 1) {
    if (i === 0) reservations.push(new Date(cursor));
    else {
      const gap = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
      cursor = nextSendWindow(new Date(cursor + gap * 1000), timezone, String(windowStart), String(windowEnd), weekdays).getTime();
      reservations.push(new Date(cursor));
    }
  }

  if (!planned.length) return { queued: 0 };

  const rows = planned
    .map((cl, index) => ({
      organization_id: organizationId,
      campaign_id: campaignId,
      campaign_lead_id: cl.id,
      lead_id: cl.lead_id,
      step_id: initialStep.id,
      step_order: initialStep.step_order,
      status: 'queued',
      scheduled_for: (reservations[index] ?? first).toISOString(),
      idempotency_key: `campaign:${campaignId}:lead:${cl.lead_id}:step:${initialStep.step_order}`,
    }));

  if (rows.length) {
    for (const batch of chunk(rows, 1000)) {
      const { error: insertError } = await db.from('campaign_executions').upsert(batch, { onConflict: 'idempotency_key', ignoreDuplicates: true });
      if (insertError) throw new Error(`Could not queue campaign: ${insertError.message}`);
    }
    // The executions table is the source of truth for send timing; this only
    // marks every planned recipient of this campaign and sets a rough next
    // action timestamp. One statement is enough and avoids a large id list.
    await db
      .from('campaign_leads')
      .update({ status: 'active', next_send_at: first.toISOString() })
      .eq('campaign_id', campaignId)
      .eq('organization_id', organizationId)
      .in('status', ['queued', 'active']);
  }

  // A resume must never shrink the audience: keep the largest known total.
  if (Number(campaign.total_leads ?? 0) < rows.length) {
    await db.from('campaigns').update({ total_leads: rows.length }).eq('id', campaignId);
  }
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
  const campaigns = due ?? [];

  // Campaigns are independent of each other, so activate them concurrently.
  // A failure inside one campaign must not stop the others from being activated.
  const outcomes = await Promise.allSettled(
    campaigns.map(async (campaign) => {
      const { error } = await db.from('campaigns').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', campaign.id).eq('status', 'scheduled');
      if (error) return false;
      // Steps are created before the seed so the seed reuses them, but the schedule
      // bookkeeping does not depend on either of them.
      await Promise.all([
        (async () => {
          await ensureCampaignSteps(campaign as CampaignRecord);
          await seedCampaignExecutions(campaign.organization_id as string, campaign.id as string);
        })(),
        db.from('campaign_schedules').update({ status: 'completed' }).eq('campaign_id', campaign.id).eq('status', 'pending'),
      ]);
      return true;
    }),
  );

  let activated = 0;
  for (const outcome of outcomes) {
    if (outcome.status === 'fulfilled') {
      if (outcome.value) activated += 1;
      continue;
    }
    // Keep the original contract: the first failure is still surfaced to the caller.
    throw outcome.reason;
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

async function createThread(input: {
  organizationId: string;
  mailboxId: string | null;
  leadId: string | null;
  campaignId: string | null;
  subject: string;
  providerThreadId?: string | null;
}): Promise<Record<string, unknown>> {
  const db = service();
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
  return createThread(input);
}

export interface PersonalizedContent {
  subject: string;
  text: string;
  html: string;
  /** The variant chosen for this recipient, when the campaign uses a group template. */
  variantId: string | null;
  /** True when the AI produced the copy for this recipient (after validation fallback). */
  personalized: boolean;
}

interface CampaignRow extends Record<string, unknown> {
  ai_personalization?: boolean | null;
  lead_list_id?: string | null;
  created_by?: string | null;
  name?: string | null;
}

/**
 * Render the message for one recipient:
 * 1. pick the rotating variant for group templates,
 * 2. optionally AI-personalize,
 * 3. replace {{placeholders}},
 * 4. refuse to emit unresolved placeholders.
 */
async function buildPersonalizedContent(input: {
  db: ReturnType<typeof service>;
  campaign: CampaignRow;
  step: Record<string, unknown> | null;
  template: Record<string, unknown> | null;
  lead: Record<string, unknown>;
  vars: Record<string, string | null | undefined>;
  senderName: string;
  senderCompany: string | null;
  seed: string;
}): Promise<PersonalizedContent> {
  const { db, campaign, step, template, lead, vars, senderName, senderCompany, seed } = input;
  const subjectOverride = String(step?.subject_override ?? '');
  const bodyOverride = String(step?.body_override ?? '');
  const groupMode = template?.mode === 'group' && !subjectOverride && !bodyOverride;

  let variantId: string | null = null;
  if (groupMode && template?.id) {
    const { data: variants } = await db
      .from('email_template_variants')
      .select('*')
      .eq('template_id', String(template.id))
      .order('variant_order', { ascending: true });
    const usable = (variants ?? []).map((variant) => ({
      id: String(variant.id),
      variant_order: Number(variant.variant_order),
      subject: String(variant.subject),
      body_text: String(variant.body_text),
    }));
    const picked = pickVariant(usable, seed);
    if (picked) variantId = picked.id;
    const baseSubject = picked?.subject ?? String(template.subject ?? '');
    const baseBody = picked?.body_text ?? String(template.body_text ?? '');
    return personalizeAndRender({ db, campaign, lead, vars, senderName, senderCompany, baseSubject, baseBody, htmlSource: null, variantId, seed });
  }

  const baseSubject = subjectOverride || String(template?.subject ?? '');
  const baseBody = bodyOverride || String(template?.body_text ?? '');
  const htmlSource = template?.body_html ? String(template.body_html) : null;
  return personalizeAndRender({ db, campaign, lead, vars, senderName, senderCompany, baseSubject, baseBody, htmlSource, variantId, seed });
}

async function personalizeAndRender(input: {
  db: ReturnType<typeof service>;
  campaign: CampaignRow;
  lead: Record<string, unknown>;
  vars: Record<string, string | null | undefined>;
  senderName: string;
  senderCompany: string | null;
  baseSubject: string;
  baseBody: string;
  htmlSource: string | null;
  variantId: string | null;
  seed: string;
}): Promise<PersonalizedContent> {
  const { db, campaign, lead, vars, senderName, senderCompany, htmlSource, variantId } = input;
  let baseSubject = input.baseSubject;
  let baseBody = input.baseBody;
  let personalized = false;

  if (campaign.ai_personalization) {
    try {
      let columns: import('@/lib/placeholders').LeadListColumn[] = [];
      if (campaign.lead_list_id) {
        const { data: listRow } = await db.from('lead_lists').select('columns').eq('id', String(campaign.lead_list_id)).maybeSingle();
        if (Array.isArray(listRow?.columns)) columns = listRow.columns as import('@/lib/placeholders').LeadListColumn[];
      }
      const userId = String(campaign.created_by ?? '');
      const output = await personalizeForRecipient({
        organizationId: String(campaign.organization_id),
        userId,
        lead,
        columns,
        subject: baseSubject,
        body: baseBody,
        senderName,
        senderCompany,
        campaignName: campaign.name ? String(campaign.name) : null,
      });
      baseSubject = output.subject;
      baseBody = output.body;
      personalized = true;
    } catch (aiError) {
      // AI unavailable or over limit: fall back to the approved template.
      console.warn('[ai] recipient personalization failed, using original template:', aiError instanceof Error ? aiError.message : aiError);
    }
  }

  const subject = renderText(baseSubject, vars).trim();
  const text = renderText(baseBody, vars);
  const html = !personalized && htmlSource ? renderHtml(htmlSource, vars) : textToHtml(text);
  const unresolved = findUnresolvedPlaceholders(subject, text);
  if (unresolved.length) {
    throw new Error(`Cannot send: unresolved placeholders ${unresolved.map((key) => `{{${key}}}`).join(', ')}`);
  }
  return { subject, text, html, variantId, personalized };
}

export interface SendTickResult {
  processed: number;
  sent: number;
  skipped: number;
  retried: number;
  failed: number;
  errors: string[];
}

/** Classify provider errors as transient (retry with backoff) or permanent (dead-letter). */
function classifySendError(message: string): 'transient' | 'permanent' {
  const lower = message.toLowerCase();
  // SMTP permanent codes (mailbox/user rejected, reputation, policy).
  if (/\b(550|551|552|553|554|556)\b/.test(lower)) return 'permanent';
  // Rate limiting is explicitly transient and safe to back off on.
  if (/429|rate ?limit|too many requests|throttl/.test(lower)) return 'transient';
  // Network-level failures before the provider accepted the message.
  if (/fetch failed|network|econnreset|econnrefused|etimedout|enotfound|eai_again|esocket|socket hang up|timed? ?out|dns/.test(lower)) return 'transient';
  // HTTP 5xx from the provider or token service.
  if (/\b5\d\d\b/.test(lower)) return 'transient';
  // 4xx is permanent: auth, validation, policy.
  return 'permanent';
}

/** Load due executions, optionally scoped to one organization. */
async function loadDueExecutions(limit: number, organizationId?: string) {
  const db = service();
  let query = db
    .from('campaign_executions')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load due executions: ${error.message}`);
  return data ?? [];
}

async function processExecutions(executions: Array<Record<string, unknown>>): Promise<SendTickResult> {
  const result: SendTickResult = { processed: executions.length, sent: 0, skipped: 0, retried: 0, failed: 0, errors: [] };
  const outcomes: Array<PromiseSettledResult<'sent' | 'skipped' | 'requeued'>> = [];
  const batchSize = 8;
  for (let index = 0; index < executions.length; index += batchSize) {
    const batch = executions.slice(index, index + batchSize);
    const settled = await Promise.allSettled(batch.map((execution) => sendExecution(execution.id as string)));
    outcomes.push(...settled);
  }

  for (const outcome of outcomes) {
    if (outcome.status === 'fulfilled') {
      if (outcome.value === 'sent') result.sent += 1;
      else if (outcome.value === 'requeued') result.retried += 1;
      else result.skipped += 1;
      continue;
    }
    result.failed += 1;
    const message = outcome.reason instanceof Error ? outcome.reason.message : 'Unknown send error';
    result.errors.push(message.slice(0, 300));
  }

  await maybeCompleteCampaigns(executions.map((execution) => String(execution.campaign_id)));
  return result;
}

export async function runSendingTick(limit = 25): Promise<SendTickResult> {
  const executions = await loadDueExecutions(limit);
  return processExecutions(executions as Array<Record<string, unknown>>);
}

/**
 * Drain due executions for one organization. Designed for callers that are
 * already authenticated (the app itself after a launch, or a page that wants
 * to flush the queue) so a campaign fires without needing an external cron.
 */
export async function runOrgSendingTick(organizationId: string, limit = 10): Promise<SendTickResult> {
  const executions = await loadDueExecutions(limit, organizationId);
  return processExecutions(executions as Array<Record<string, unknown>>);
}

/** Flip a campaign to completed when nothing is queued/processing left. */
async function maybeCompleteCampaigns(campaignIds: string[]) {
  const db = service();
  const unique = [...new Set(campaignIds)];
  await Promise.allSettled(unique.map(async (campaignId) => {
    const { count } = await db
      .from('campaign_executions')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['queued', 'processing']);
    if ((count ?? 1) === 0) {
      await db.from('campaigns').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', campaignId).eq('status', 'active');
    }
  }));
}

export async function sendExecution(executionId: string): Promise<'sent' | 'skipped' | 'requeued'> {
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

  // The campaign lead and the lead itself are independent reads.
  const [campaignLeadResult, leadResult] = await Promise.all([
    db.from('campaign_leads').select('*').eq('id', execution.campaign_lead_id).maybeSingle(),
    db.from('leads').select('*').eq('id', execution.lead_id).maybeSingle(),
  ]);
  const campaignLead = campaignLeadResult.data;
  const lead = leadResult.data;
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
    // Settings, the current step and the organisation do not depend on each other.
    const [settingsResult, stepResult, orgResult] = await Promise.all([
      db.from('campaign_settings').select('*').eq('campaign_id', execution.campaign_id).maybeSingle(),
      execution.step_id ? db.from('campaign_steps').select('*').eq('id', execution.step_id).maybeSingle() : Promise.resolve({ data: null }),
      db.from('organizations').select('name').eq('id', execution.organization_id).maybeSingle(),
    ]);
    const settings = settingsResult.data;
    const step = stepResult.data;
    const org = orgResult.data;
    const timezone = String(campaign.timezone || 'UTC');
    const now = new Date();
    const windowStart = nextSendWindow(now, timezone, String(settings?.send_window_start ?? '09:00'), String(settings?.send_window_end ?? '17:00'), (settings?.weekdays as number[]) ?? [1, 2, 3, 4, 5]);
    if (windowStart.getTime() > now.getTime()) {
      await db.from('campaign_executions').update({ status: 'queued', scheduled_for: windowStart.toISOString(), started_at: null }).eq('id', executionId);
      return 'skipped';
    }

    // The template id can come from the step, so this read depends on the step above.
    const templateId = step?.template_id ?? campaign.template_id ?? null;
    const { data: template } = templateId
      ? await db.from('email_templates').select('*').eq('id', templateId).eq('organization_id', execution.organization_id).maybeSingle()
      : { data: null };
    const senderName = String(mailbox.display_name || org?.name || 'ColdFox user');
    const senderCompany = org?.name ? String(org.name) : null;
    const vars = {
      ...buildLeadVariables(lead),
      sender_name: senderName,
      sender_company: senderCompany ?? '',
    };
    const content = await buildPersonalizedContent({
      db,
      campaign: campaign as Record<string, unknown>,
      step: step ?? null,
      template: template ?? null,
      lead,
      vars,
      senderName,
      senderCompany,
      seed: String(execution.idempotency_key ?? executionId),
    });
    if (!content.subject) throw new Error('Email subject is empty. Add a subject before sending.');
    if (!content.text.trim()) throw new Error('Email body is empty. Add a body before sending.');

    const unsubscribeUrl = await createUnsubscribeToken(execution.organization_id, execution.lead_id, execution.campaign_id);
    const withFooter = applyUnsubscribeFooter(content.text, content.html, unsubscribeUrl);
    const mailtoUnsubscribe = process.env.EMAIL_FROM_ADDRESS ? `mailto:${process.env.EMAIL_FROM_ADDRESS}?subject=unsubscribe` : null;
    const headers: Record<string, string> = {
      'List-Unsubscribe': `<${unsubscribeUrl}>${mailtoUnsubscribe ? `, <${mailtoUnsubscribe}>` : ''}`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-ColdFox-Campaign': String(execution.campaign_id),
      // Bulk marketing mail signalling (Google/Yahoo bulk sender requirements):
      // this tells inbox providers it is a marketing campaign so they classify
      // rather than flag it as unexpected personal mail.
      'Precedence': 'bulk',
      'Feedback-ID': `${execution.campaign_id}:${execution.organization_id}:coldfox:coldfox`,
    };

    // Safe test mode (EMAIL_TEST_MODE=true): the full pipeline runs, but the
    // provider call is replaced by a synthetic acceptance and clearly logged.
    const outcome = process.env.EMAIL_TEST_MODE === 'true'
      ? { providerMessageId: `test-message-${executionId}`, provider: 'smtp' as const, acceptedAt: new Date().toISOString() }
      : await sendEmail(credentials, {
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
      variant_id: content.variantId,
      personalized: content.personalized,
      personalized_subject: content.personalized ? content.subject : null,
      personalized_body: content.personalized ? content.text : null,
    }).eq('id', executionId);

    // Every write below is independent: run them together, and never let one of
    // them abort the others.
    await Promise.allSettled([
      db.from('campaign_leads').update({ status: step?.step_type === 'follow_up' ? 'completed' : 'sent', last_sent_at: new Date().toISOString(), current_step: Number(execution.step_order ?? 1) }).eq('id', execution.campaign_lead_id),
      db.from('leads').update({ status: lead.status === 'new' ? 'contacted' : lead.status, last_contacted_at: new Date().toISOString() }).eq('id', execution.lead_id),
      db.rpc('increment_campaign_stat', { p_campaign: execution.campaign_id, p_stat: 'emails_sent' }),
      db.rpc('record_mailbox_send', { p_mailbox: campaign.mailbox_id, p_org: execution.organization_id, p_success: true }),
      db.rpc('record_usage', { p_org: execution.organization_id, p_metric: 'emails', p_quantity: 1, p_metadata: { campaign_id: execution.campaign_id } }),
      db.from('email_events').insert({
        organization_id: execution.organization_id,
        campaign_id: execution.campaign_id,
        lead_id: execution.lead_id,
        event_type: 'accepted',
        metadata: { provider: outcome.provider, execution_id: executionId, ...(process.env.EMAIL_TEST_MODE === 'true' ? { test_mode: true } : {}) },
      }),
      db.from('campaign_events').insert({
        organization_id: execution.organization_id,
        campaign_id: execution.campaign_id,
        lead_id: execution.lead_id,
        execution_id: executionId,
        event_type: 'sent',
        metadata: { provider: outcome.provider, ...(process.env.EMAIL_TEST_MODE === 'true' ? { test_mode: true } : {}) },
      }),
    ]);

    await scheduleNextStep(execution, campaign, step ?? null);
    return 'sent';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown send error';
    const attempts = Number(execution.attempts ?? 1);
    const classification = classifySendError(message);
    if (classification === 'transient' && attempts < 4) {
      // Exponential backoff: 5, 10, 20 minutes between retries.
      const backoffMinutes = 5 * 2 ** (attempts - 1);
      const requeueAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
      await Promise.allSettled([
        db.from('campaign_executions').update({ status: 'queued', scheduled_for: requeueAt, started_at: null, error: message.slice(0, 1000) }).eq('id', executionId),
        db.from('campaign_leads').update({ next_send_at: requeueAt, error: message.slice(0, 500) }).eq('id', execution.campaign_lead_id),
      ]);
      return 'requeued';
    }
    // Permanent failure (or retries exhausted): dead-letter the recipient.
    await Promise.allSettled([
      db.from('campaign_executions').update({
        status: 'failed',
        error: message.slice(0, 1000),
        finished_at: new Date().toISOString(),
      }).eq('id', executionId),
      db.from('campaign_leads').update({ status: 'error', error: message.slice(0, 500), next_send_at: null }).eq('id', execution.campaign_lead_id),
      // Record the failure against the mailbox, but do not flip its status:
      // a bad template should not block an otherwise healthy account.
      db.from('mailboxes').update({ last_error: message.slice(0, 500) }).eq('id', campaign.mailbox_id),
      db.rpc('record_mailbox_send', { p_mailbox: campaign.mailbox_id, p_org: execution.organization_id, p_success: false }).then(() => undefined),
      db.from('campaign_events').insert({
        organization_id: execution.organization_id,
        campaign_id: execution.campaign_id,
        lead_id: execution.lead_id,
        execution_id: executionId,
        event_type: 'failed',
        metadata: { attempts, error: message.slice(0, 500) },
      }).then(() => undefined, () => undefined),
    ]);
    throw err;
  }
}

async function scheduleNextStep(execution: Record<string, unknown>, campaign: Record<string, unknown>, currentStep: Record<string, unknown> | null) {
  const db = service();
  // The campaign settings and the next step are independent reads.
  const [settingsResult, nextStepResult] = await Promise.all([
    db.from('campaign_settings').select('*').eq('campaign_id', campaign.id).maybeSingle(),
    db.from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaign.id)
      .gt('step_order', Number(execution.step_order ?? 1))
      .order('step_order')
      .limit(1)
      .maybeSingle(),
  ]);
  const settings = settingsResult.data;
  if (!settings) return;
  if (currentStep && currentStep.step_type === 'follow_up' && Number(currentStep.step_order) >= Number(settings.max_followups ?? 0) + 1) return;

  const nextStep = nextStepResult.data;
  if (!nextStep) return;

  const delayMs = (Number(nextStep.delay_days ?? 0) * 86_400 + Number(nextStep.delay_hours ?? 0) * 3_600_000);
  const scheduled = nextSendWindow(
    new Date(Date.now() + delayMs),
    String(campaign.timezone || 'UTC'),
    String(settings.send_window_start ?? '09:00'),
    String(settings.send_window_end ?? '17:00'),
    (settings.weekdays as number[]) ?? [1, 2, 3, 4, 5],
  );
  // Queuing the next execution and moving the campaign lead forward are independent writes.
  await Promise.all([
    db.from('campaign_executions').upsert(
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
    ),
    db.from('campaign_leads').update({ next_send_at: scheduled.toISOString() }).eq('id', execution.campaign_lead_id),
  ]);
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

async function fetchGmailMessage(token: string, messageId: string): Promise<InboundEmail | null> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const msg = (await res.json()) as { id: string; threadId: string; payload?: Record<string, unknown>; internalDate?: string };
  const headers = ((msg.payload?.headers as { name: string; value: string }[] | undefined) ?? []).reduce<Record<string, string>>((acc, h) => {
    acc[h.name.toLowerCase()] = h.value;
    return acc;
  }, {});
  const fromMatch = /<([^>]+)>|([^\s]+@[^\s]+)/.exec(headers.from ?? '');
  const fromEmail = (fromMatch?.[1] || fromMatch?.[2] || '').toLowerCase();
  if (!fromEmail) return null;
  const body = gmailBody(msg.payload);
  return {
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
  };
}

async function fetchGmailMessages(creds: MailboxCredentials): Promise<InboundEmail[]> {
  const token = await getAccessToken(creds);
  const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=' + encodeURIComponent('in:inbox newer_than:2d'), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!listRes.ok) throw new Error(`Gmail inbox request failed (${listRes.status}).`);
  const list = (await listRes.json()) as { messages?: { id: string; threadId: string }[] };
  const items = (list.messages ?? []).slice(0, 25);
  const out: InboundEmail[] = [];
  // Fetch the message bodies in small parallel batches: 25 sequential requests with a
  // 20s timeout each can block the worker for minutes.
  const batchSize = 5;
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const settled = await Promise.allSettled(batch.map((item) => fetchGmailMessage(token, item.id)));
    for (const outcome of settled) {
      if (outcome.status === 'rejected') throw outcome.reason;
      if (outcome.value) out.push(outcome.value);
    }
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

  const organizationId = mailbox.organization_id as string;
  const selfAddress = String(mailbox.email_address).toLowerCase();
  const candidates = inbound.filter((message) => message.fromEmail !== selfAddress);

  // ── batched reads: one round-trip per table for the whole batch ──
  const seenProviderMessageIds = new Set<string>();
  const providerMessageIds = [...new Set(candidates.map((message) => message.providerMessageId))];
  if (providerMessageIds.length) {
    const { data } = await db.from('email_messages').select('provider_message_id').in('provider_message_id', providerMessageIds);
    for (const row of data ?? []) seenProviderMessageIds.add(String(row.provider_message_id));
  }

  const leadsByEmail = new Map<string, Record<string, unknown>>();
  const senderEmails = [...new Set(candidates.map((message) => message.fromEmail))];
  if (senderEmails.length) {
    const { data } = await db.from('leads').select('*').eq('organization_id', organizationId).in('email_normalized', senderEmails).is('deleted_at', null);
    for (const row of data ?? []) leadsByEmail.set(String(row.email_normalized), row);
  }

  const leadIds = [...new Set([...leadsByEmail.values()].map((lead) => String(lead.id)))];
  const threadsByLead = new Map<string, Record<string, unknown>>();
  if (leadIds.length) {
    const { data } = await db.from('email_threads').select('*').eq('organization_id', organizationId).in('lead_id', leadIds).order('last_message_at', { ascending: false });
    for (const row of data ?? []) {
      const key = String(row.lead_id);
      if (!threadsByLead.has(key)) threadsByLead.set(key, row);
    }
  }

  const providerThreadIds = [...new Set(candidates.map((message) => message.threadId ?? '').filter((id) => Boolean(id)))];
  const threadsByProvider = new Map<string, Record<string, unknown>>();
  if (providerThreadIds.length) {
    const { data } = await db.from('email_threads').select('*').eq('organization_id', organizationId).eq('mailbox_id', mailboxId).in('provider_thread_id', providerThreadIds);
    for (const row of data ?? []) threadsByProvider.set(String(row.provider_thread_id), row);
  }

  let synced = 0;
  let replies = 0;
  // Local mirrors of the row state the sequential implementation re-read for every
  // message, so the batched version keeps producing the same values.
  const unreadByThread = new Map<string, number>();
  const leadStatusById = new Map<string, string>();

  for (const message of candidates) {
    if (seenProviderMessageIds.has(message.providerMessageId)) continue;

    const lead = leadsByEmail.get(message.fromEmail) ?? null;
    const leadId = lead ? String(lead.id) : null;
    let thread = (leadId ? threadsByLead.get(leadId) : undefined) ?? (message.threadId ? threadsByProvider.get(message.threadId) : undefined) ?? null;
    if (!thread) {
      thread = await createThread({
        organizationId,
        mailboxId,
        leadId,
        campaignId: null,
        subject: message.subject,
        providerThreadId: message.threadId ?? null,
      });
      if (leadId) threadsByLead.set(leadId, thread);
      if (message.threadId) threadsByProvider.set(message.threadId, thread);
    }

    const classification = classifyReply(message.text);
    const { data: inserted, error } = await db
      .from('email_messages')
      .insert({
        organization_id: organizationId,
        thread_id: thread.id,
        mailbox_id: mailboxId,
        lead_id: (lead?.id as string | null) ?? null,
        campaign_id: (thread.campaign_id as string | null) ?? null,
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

    const threadId = String(thread.id);
    const unreadCount = (unreadByThread.get(threadId) ?? Number((thread.unread_count as number | null) ?? 0)) + 1;
    unreadByThread.set(threadId, unreadCount);
    const leadStatus = leadId ? leadStatusById.get(leadId) ?? String(lead!.status) : null;

    const writes: Array<PromiseLike<unknown>> = [
      db.from('email_threads').update({ last_message_at: message.receivedAt, unread_count: unreadCount, subject: thread.subject ?? message.subject }).eq('id', threadId),
    ];
    if (leadId && leadStatus !== 'unsubscribed' && leadStatus !== 'bounced') {
      writes.push(db.from('leads').update({ status: classification === 'not_interested' ? 'not_interested' : 'replied', next_follow_up_at: null }).eq('id', leadId));
    }
    if (leadId) {
      const threadCampaignId = thread.campaign_id as string | null;
      if (threadCampaignId) {
        writes.push(db.from('campaign_leads').update({ status: 'replied', next_send_at: null }).eq('campaign_id', threadCampaignId).eq('lead_id', leadId));
        writes.push(db.from('campaign_executions').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('campaign_id', threadCampaignId).eq('lead_id', leadId).in('status', ['queued', 'processing']));
        writes.push(db.rpc('increment_campaign_stat', { p_campaign: threadCampaignId, p_stat: 'replies' }));
        writes.push(db.from('campaign_events').insert({ organization_id: organizationId, campaign_id: threadCampaignId, lead_id: leadId, event_type: 'replied', metadata: { classification } }));
      }
      writes.push(db.from('email_replies').insert({ organization_id: organizationId, thread_id: threadId, message_id: inserted.id, lead_id: leadId, campaign_id: thread.campaign_id, classification }));
      writes.push(db.from('email_events').insert({ organization_id: organizationId, campaign_id: thread.campaign_id, lead_id: leadId, event_type: 'replied', metadata: { classification } }));
      const notifyUser = (lead!.owner_id as string | null) ?? (mailbox.user_id as string | null);
      if (notifyUser) {
        // notifications are best-effort
        writes.push(
          db
            .from('notifications')
            .insert({
              organization_id: organizationId,
              user_id: notifyUser,
              notification_type: 'reply',
              title: `New reply from ${String((lead!.first_name as string | null) ?? (lead!.email as string))}`,
              body: message.subject,
              link: '/app/inbox',
            })
            .then(() => undefined, () => undefined),
        );
      }
    }
    // Every write for this message is independent: run them together, and a failing
    // write must never abort the rest of the message.
    await Promise.allSettled(writes);
    synced += 1;

    if (leadId) {
      replies += 1;
      if (classification === 'unsubscribe') {
        await Promise.allSettled([
          db.from('suppression_entries').upsert(
            {
              organization_id: organizationId,
              email: lead!.email as string,
              email_normalized: String(lead!.email).toLowerCase().trim(),
              reason_key: 'unsubscribed',
              source: 'reply',
              notes: 'Recipient asked to stop emailing in a reply.',
            },
            { onConflict: 'organization_id,email_normalized' },
          ),
          db.from('leads').update({ status: 'unsubscribed' }).eq('id', leadId),
        ]);
        leadStatusById.set(leadId, 'unsubscribed');
      } else if (leadStatus !== 'unsubscribed' && leadStatus !== 'bounced') {
        leadStatusById.set(leadId, classification === 'not_interested' ? 'not_interested' : 'replied');
      }
    }
  }

  await Promise.all([
    db.from('mailboxes').update({ status: 'connected', last_sync_at: new Date().toISOString(), last_error: null }).eq('id', mailboxId),
    db.from('mailbox_sync_state').upsert(
      { mailbox_id: mailboxId, organization_id: organizationId, last_sync_at: new Date().toISOString(), last_error: null },
      { onConflict: 'mailbox_id' },
    ),
  ]);
  return { synced, replies };
}

// ── worker loop ─────────────────────────────────────────────────
export async function runWorkerTick(limit = 25) {
  const db = service();
  const activated = await activateScheduledCampaigns();
  await db.rpc('reset_mailbox_daily_counters').then(() => undefined, () => undefined);

  const sent = await runSendingTick(limit);
  const summary = { activated, ...sent, mailboxesSynced: 0, syncErrors: [] as string[] };

  // Inbox sync is expensive (one IMAP session per mailbox), so it runs at most
  // every five minutes even when the scheduler calls this worker every minute.
  const syncCutoff = new Date(Date.now() - 4 * 60_000).toISOString();
  const { data: mailboxes } = await db
    .from('mailboxes')
    .select('id')
    .in('status', ['connected', 'syncing'])
    .or(`last_sync_at.is.null,last_sync_at.lt."${syncCutoff}"`)
    .limit(5);
  const targets = mailboxes ?? [];
  // Mailboxes are independent of each other: sync them concurrently instead of
  // waiting for each mailbox to finish before starting the next one.
  const outcomes = await Promise.allSettled(targets.map((mailbox) => syncMailbox(mailbox.id as string)));
  const errorWrites: Array<PromiseLike<unknown>> = [];
  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      summary.mailboxesSynced += 1;
      return;
    }
    const message = outcome.reason instanceof Error ? outcome.reason.message : 'Sync failed';
    summary.syncErrors.push(message.slice(0, 200));
    errorWrites.push(db.from('mailboxes').update({ last_error: message.slice(0, 500) }).eq('id', targets[index].id));
  });
  await Promise.allSettled(errorWrites);
  return summary;
}
