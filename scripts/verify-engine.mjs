/**
 * End-to-end verification of the campaign engine against a local production
 * build running with EMAIL_TEST_MODE=true. Emails never reach a provider.
 *
 * A disposable organization is created up front so the free-plan quota of the
 * owner's real workspace is untouched; every row created during the run is
 * removed in the finally block.
 */
import fs from 'node:fs';
import { createCipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const stamp = Date.now();
const fakeEmails = [`smoke-one-${stamp}@example.com`, `smoke-two-${stamp}@example.com`, `smoke-three-${stamp}@example.com`];

function loadEnv() {
  const raw = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}
const env = loadEnv();
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const email = process.env.SMOKE_EMAIL ?? env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD ?? env.SMOKE_PASSWORD;
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) { console.error('Sign-in failed:', authError.message); process.exit(1); }
const userId = auth.user.id;

// Disposable organization with a fresh free-plan quota.
const { data: orgRow, error: orgError } = await service
  .from('organizations')
  .insert({ name: `Smoke Org ${stamp}`, slug: `smoke-org-${stamp}`, owner_id: userId, plan_key: 'free', timezone: 'UTC', settings: {} })
  .select('id')
  .single();
if (orgError || !orgRow) { console.error('Could not create disposable org:', orgError?.message); process.exit(1); }
const orgId = String(orgRow.id);
await service.from('organization_members').insert({ organization_id: orgId, user_id: userId, role: 'owner', status: 'active', invited_by: userId });
await service.from('subscriptions').upsert({ organization_id: orgId, plan_key: 'free', status: 'active' }, { onConflict: 'organization_id' });

const authCookie = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`;
const cookie = `${authCookie}; cf_org_id=${orgId}`;
async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = { cookie, origin: BASE, ...(body && !formData ? { 'content-type': 'application/json' } : {}) };
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: response.status, ok: json?.ok, data: json?.data, error: json?.error, text };
}

const created = { listId: null, leadIds: [], templateIds: [], campaignId: null, mailboxId: null };

try {
  // 1) Import a disposable CSV lead list through the real import pipeline.
  const csv = [
    'first_name,last_name,email,company_name,job_title,industry,linkedin_url',
    `Smoke,One,${fakeEmails[0]},SmokeCo One,Tester,Testing,`,
    `Smoke,Two,${fakeEmails[1]},SmokeCo Two,Designer,Design,`,
    `Smoke,Three,${fakeEmails[2]},SmokeCo Three,Manager,Ops,`,
  ].join('\n');
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'smoke.csv');
  form.append('lead_list_name', `Smoke List ${stamp}`);
  form.append('mapping', JSON.stringify([
    { header: 'first_name', field: 'first_name' },
    { header: 'last_name', field: 'last_name' },
    { header: 'email', field: 'email' },
    { header: 'company_name', field: 'company' },
    { header: 'job_title', field: 'job_title' },
    { header: 'industry', field: 'custom' },
    { header: 'linkedin_url', field: 'ignore' },
  ]));
  const imported = await api('/api/leads/import/confirm', { method: 'POST', formData: form });
  record('CSV import creates a named lead list', imported.status === 200 && imported.data?.leadListId, `status=${imported.status} ${JSON.stringify(imported.data ?? imported.error)}`);
  created.listId = imported.data?.leadListId ?? null;
  created.leadIds = imported.data?.leadIds ?? [];
  record('placeholder {{industry}} generated for custom column', Array.isArray(imported.data?.placeholders) && imported.data.placeholders.includes('{{industry}}'), (imported.data?.placeholders ?? []).join(','));

  const lists = await api('/api/lead-lists');
  const mine = (lists.data ?? []).find((l) => l.id === created.listId);
  record('lead list visible with counts', Boolean(mine) && mine.leadCount === 3, `count=${mine?.leadCount}`);

  const detail = await api(`/api/lead-lists/${created.listId}?leads=1`);
  record('lead list preview + eligibility', detail.status === 200 && detail.data?.eligibleCount === 3 && detail.data?.preview?.length === 3);

  const dupe = await api(`/api/lead-lists/${created.listId}/duplicates`, { method: 'POST', body: {} });
  record('duplicate scan runs', dupe.status === 200, `status=${dupe.status}`);

  // 2) Create one single and one group template.
  const single = await api('/api/templates', {
    method: 'POST',
    body: {
      name: `Smoke Single ${stamp}`, subject: 'Quick question about {{company_name}}',
      body_text: 'Hi {{first_name}},\n\nI noticed {{company_name}} works on {{industry}}.\n\nWould a 15 minute call be useful?\n\nBest,\nSmokeTest',
      category: 'General', is_shared: false, tags: [], mode: 'single', ai_personalization: true,
    },
  });
  const singleId = single.data?.id;
  if (singleId) created.templateIds.push(singleId);
  record('single template created', single.status === 201 && singleId, `status=${single.status}`);

  const group = await api('/api/templates', {
    method: 'POST',
    body: {
      name: `Smoke Group ${stamp}`, subject: 'A note on {{first_name}}',
      body_text: 'Hi {{first_name}}, variant A.', category: 'General', is_shared: false, tags: [],
      mode: 'group', ai_personalization: false,
      variants: [
        { subject: 'A note on {{first_name}}', body_text: 'Hi {{first_name}}, variant A.' },
        { subject: 'Question about {{company_name}}', body_text: 'Hi {{first_name}}, variant B about {{company_name}}.' },
        { subject: 'Hello from SmokeTest', body_text: 'Variant C for {{company_name}}.' },
      ],
    },
  });
  if (group.data?.id) created.templateIds.push(group.data.id);
  record('group template created with 3 variants', group.status === 201 && (group.data?.variants?.length ?? 0) === 3, `status=${group.status}`);

  // AI deliverability review on disposable content (really calls Groq).
  const review = await api('/api/ai/deliverability-review', {
    method: 'POST',
    body: { subject: 'ACT NOW!!! BIG OFFER FOR {{first_name}}', body_text: 'BUY NOW!!! 100% GUARANTEED!!! CLICK HERE NOW!!! {{company_name}}' },
  });
  record('AI deliverability review returns improved copy', review.status === 200 && typeof review.data?.improved?.subject === 'string' && review.data.improved.subject.length > 0);

  const sample = await api(`/api/templates/${singleId}/personalize-sample`, { method: 'POST', body: { lead_list_id: created.listId } });
  record('personalize-sample renders with AI or template fallback', sample.status === 200 && Array.isArray(sample.data?.samples) && sample.data.samples.length > 0 && sample.data.samples.every((s) => !/\{\{/.test(s.subject + s.body)));

  // 3) Reject an illegal campaign: placeholder with no matching column.
  const badCampaign = await api('/api/campaigns', {
    method: 'POST',
    body: { name: `Smoke Bad ${stamp}`, mailbox_id: null, subject: 'Hi {{phonenumber}}', body: '{{phonenumber}}', lead_list_id: created.listId, interval_min_seconds: 1, interval_max_seconds: 2 },
  });
  record('campaign rejected when placeholder is not in the list', badCampaign.status === 422 && String(badCampaign.error ?? '').includes('phonenumber'), `status=${badCampaign.status}`);

  // 4) Real campaign + instant launch with interval 1-2s.
  const smtpEmail = `smoke-smtp-${stamp}@example.com`;
  const encryptionKey = Buffer.from(String(env.MAILBOX_ENCRYPTION_KEY), 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const plaintext = Buffer.from(JSON.stringify({ host: 'smtp.invalid.local', port: 587, secure: false, username: smtpEmail, password: 'smoke-password' }), 'utf8');
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const encryptedPayload = ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
  const { data: createdMailbox, error: mailboxError } = await service
    .from('mailboxes')
    .insert({ organization_id: orgId, email_address: smtpEmail, display_name: 'Smoke SMTP', provider: 'smtp', status: 'connected', daily_limit: 100 })
    .select('id')
    .single();
  if (mailboxError) console.log('MAILBOX CREATE ERROR', JSON.stringify(mailboxError));
  const disposableMailboxId = createdMailbox ? String(createdMailbox.id) : null;
  created.mailboxId = disposableMailboxId;
  if (disposableMailboxId) {
    const { error: credError } = await service.from('mailbox_credentials').insert({
      mailbox_id: disposableMailboxId, organization_id: orgId, encrypted_payload: encryptedPayload, key_version: 1, updated_at: new Date().toISOString(),
    });
    if (credError) console.log('MAILBOX CRED ERROR', JSON.stringify(credError));
  }
  record('disposable connected SMTP mailbox created for test', Boolean(disposableMailboxId));

  const [excludeMe] = created.leadIds;
  const makeCampaign = await api('/api/campaigns', {
    method: 'POST',
    body: {
      name: `Smoke Campaign ${stamp}`,
      description: 'Disposable end-to-end verification',
      mailbox_id: disposableMailboxId ?? undefined,
      template_id: group.data?.id,
      lead_list_id: created.listId,
      exclude_lead_ids: excludeMe ? [excludeMe] : [],
      interval_min_seconds: 1,
      interval_max_seconds: 2,
      daily_limit: 50,
      ai_personalization: false,
      send_window_start: '00:00',
      send_window_end: '23:59',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      timezone: 'UTC',
    },
  });
  if (makeCampaign.status !== 201) console.log('CAMPAIGN DEBUG', makeCampaign.status, JSON.stringify(makeCampaign));
  record('campaign created, excluded recipient honored', makeCampaign.status === 201 && Number(makeCampaign.data?.excluded ?? 0) === (excludeMe ? 1 : 0), `status=${makeCampaign.status} excluded=${makeCampaign.data?.excluded}`);
  created.campaignId = makeCampaign.data?.id ?? null;

  if (created.campaignId) {
    const campaignRow = await service.from('campaign_leads').select('id, status').eq('campaign_id', created.campaignId);
    record('campaign recipients = list minus exclusion', (campaignRow.data?.length ?? 0) === 2, `rows=${campaignRow.data?.length}`);

    const launch = await api(`/api/campaigns/${created.campaignId}/launch`, { method: 'POST', body: { mode: 'now' } });
    record('instant launch queues recipients', launch.status === 200 && typeof launch.data?.queued === 'number', `queued=${launch.data?.queued}`);

    const executions = await service.from('campaign_executions').select('id, status, scheduled_for, idempotency_key').eq('campaign_id', created.campaignId).order('scheduled_for');
    record('executions seeded with idempotency keys', (executions.data?.length ?? 0) === 2 && (executions.data ?? []).every((e) => String(e.idempotency_key).startsWith('campaign:')));
    if ((executions.data?.length ?? 0) === 2) {
      const [a, b] = executions.data.map((e) => new Date(String(e.scheduled_for)).getTime());
      const gap = (b - a) / 1000;
      record('jittered 1-2s pause between eligible sends', gap >= 0.5 && gap <= 3, `gap=${gap}s`);
    }

    const preCron = await service.from('campaign_executions').select('status').eq('campaign_id', created.campaignId);
    record('no email accepted before worker runs', (preCron.data ?? []).every((e) => e.status === 'queued'));
  }

  // 5) Run the worker (EMAIL_TEST_MODE=true on the server): synthetic send only.
  const worker = await fetch(`${BASE}/api/cron/worker`, { headers: { 'x-cron-secret': env.CRON_SECRET } });
  const workerJson = await worker.json().catch(() => null);
  record('cron worker completes with synthetic sends', worker.status === 200 && workerJson?.ok === true, `sent=${workerJson?.data?.sent}`);

  if (created.campaignId) {
    const afterCron = await service.from('campaign_executions').select('id, status, personalized, variant_id').eq('campaign_id', created.campaignId);
    const acceptedRows = (afterCron.data ?? []).filter((e) => e.status === 'accepted');
    record('worker accepts both recipients synthetically', acceptedRows.length === 2, `accepted=${acceptedRows.length}`);
    record('variant recorded on executions', acceptedRows.length === 2 && acceptedRows.every((e) => Boolean(e.variant_id)));

    const message = await service.from('email_messages').select('subject, body_text').eq('campaign_id', created.campaignId).limit(1).maybeSingle();
    record('unsubscribe footer appended with URL', /unsubscribe/i.test(String(message.data?.body_text ?? '')));
    record('no fabricated RE: prefix', !String(message.data?.subject ?? '').startsWith('RE: '));

    const rawMatch = /https?:\/\/[^\s)]*\/api\/unsubscribe\?token=[^\s)]+/.exec(String(message.data?.body_text ?? ''));
    if (rawMatch) {
      const localPath = new URL(rawMatch[0]).pathname + new URL(rawMatch[0]).search;
      const unsub = await fetch(`${BASE}${localPath}`, { redirect: 'manual' });
      record('one-click unsubscribe processes without login', unsub.status >= 200 && unsub.status < 400, `status=${unsub.status}`);
      const suppressed = await service.from('suppression_entries').select('email_normalized').eq('organization_id', orgId).in('email_normalized', fakeEmails.map((e) => e.toLowerCase()));
      record('recipient suppressed after unsubscribe', (suppressed.data?.length ?? 0) >= 1, `rows=${suppressed.data?.length}`);
    } else {
      record('one-click unsubscribe processes without login', false, 'footer URL not found');
    }

    const relaunch = await api(`/api/campaigns/${created.campaignId}/launch`, { method: 'POST', body: { mode: 'now' } });
    record('re-launch blocked with 409 or 422', relaunch.status === 409 || relaunch.status === 422, `status=${relaunch.status}`);
  }
} finally {
  const id = created.campaignId;
  if (id) {
    await fetch(`${BASE}/api/campaigns/${id}`, { method: 'DELETE', headers: { cookie, origin: BASE }, redirect: 'manual' });
    await service.from('campaign_events').delete().eq('campaign_id', id);
    await service.from('campaign_executions').delete().eq('campaign_id', id);
    await service.from('campaign_leads').delete().eq('campaign_id', id);
    await service.from('campaign_steps').delete().eq('campaign_id', id);
    await service.from('campaign_settings').delete().eq('campaign_id', id);
    await service.from('campaign_schedules').delete().eq('campaign_id', id);
    await service.from('email_messages').delete().eq('campaign_id', id);
    await service.from('campaigns').delete().eq('id', id);
  }
  if (created.leadIds.length) {
    await service.from('unsubscribe_tokens').delete().in('lead_id', created.leadIds);
    await service.from('email_threads').delete().in('lead_id', created.leadIds);
    await service.from('leads').delete().in('id', created.leadIds);
  }
  await service.from('suppression_entries').delete().in('email_normalized', fakeEmails);
  if (created.listId) await service.from('lead_lists').delete().eq('id', created.listId);
  if (created.templateIds.length) {
    await service.from('email_template_variants').delete().in('template_id', created.templateIds);
    await service.from('email_template_versions').delete().in('template_id', created.templateIds);
    await service.from('email_template_variables').delete().in('template_id', created.templateIds);
    await service.from('template_ai_reviews').delete().in('template_id', created.templateIds);
    await service.from('email_templates').delete().in('id', created.templateIds);
  }
  if (created.mailboxId) {
    await service.from('mailbox_credentials').delete().eq('mailbox_id', created.mailboxId);
    await service.from('mailbox_health').delete().eq('mailbox_id', created.mailboxId);
    await service.from('mailbox_daily_usage').delete().eq('mailbox_id', created.mailboxId);
    await service.from('mailbox_sync_state').delete().eq('mailbox_id', created.mailboxId);
    await service.from('mailboxes').delete().eq('id', created.mailboxId);
  }
  await service.from('ai_generations').delete().eq('organization_id', orgId);
  await service.from('ai_usage_records').delete().eq('organization_id', orgId);
  await service.from('usage_records').delete().eq('organization_id', orgId);
  await service.from('subscriptions').delete().eq('organization_id', orgId);
  await service.from('organization_members').delete().eq('organization_id', orgId);
  await service.from('organizations').delete().eq('id', orgId);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}
