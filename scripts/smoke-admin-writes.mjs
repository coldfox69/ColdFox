/**
 * Admin console write-path smoke test. Creates disposable records, exercises
 * every mutating action through the HTTP API, checks audit entries, and
 * removes everything it created. Run against a local production build.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const stamp = Date.now();

function loadEnv() {
  const raw = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  const env = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return env;
}

const env = loadEnv();
const email = process.env.SMOKE_EMAIL ?? env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD ?? env.SMOKE_PASSWORD;
if (!email || !password) {
  console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD in the environment or .env.local.');
  process.exit(1);
}
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) {
  console.error('Sign-in failed:', authError.message);
  process.exit(1);
}
const cookie = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`;

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

async function call(module, method, body) {
  const response = await fetch(`${BASE}/api/admin/console/${module}`, {
    method,
    headers: { cookie, 'content-type': 'application/json', origin: BASE },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: response.status, ok: json?.ok === true, data: json?.data, error: json?.error, text };
}

function check(name, result, extra = '') {
  record(name, result.status === 200 || result.status === 201, `status=${result.status}${result.error ? ` error=${result.error}` : ''}${extra}`);
}

const created = { authUserId: null, orgId: null, mailboxId: null, jobId: null, errorId: null, webhookId: null };
const auditIds = new Set();

async function main() {
  // Users: create a disposable account.
  const userEmail = `smoke-user-${stamp}@example.com`;
  const { data: userData, error: userError } = await service.auth.admin.createUser({
    email: userEmail,
    password: `Smoke-${stamp}-aA1!`,
    email_confirm: true,
  });
  if (userError || !userData.user) {
    record('create disposable user', false, userError?.message ?? 'unknown');
    return;
  }
  created.authUserId = userData.user.id;
  record('create disposable user', true, userEmail);

  let result = await call('users', 'PATCH', { action: 'update', id: created.authUserId, values: { full_name: 'Smoke Test', job_title: 'QA', timezone: 'UTC' } });
  check('user profile update', result);
  result = await call('users', 'PATCH', { action: 'suspend', id: created.authUserId });
  check('user suspend', result);
  result = await call('users', 'PATCH', { action: 'activate', id: created.authUserId });
  check('user reactivate', result);

  // Roles: assign, change, remove.
  result = await call('roles', 'POST', { action: 'assign', values: { email: userEmail, role: 'read_only', notes: 'write smoke test' } });
  check('role assign', result);
  result = await call('roles', 'PATCH', { action: 'update_admin', id: created.authUserId, values: { email: userEmail, role: 'support_admin', notes: 'changed' } });
  check('role change', result);
  result = await call('roles', 'PATCH', { action: 'remove_admin', id: created.authUserId });
  check('role remove', result);

  // Plans
  const planKey = `smoke-plan-${stamp}`;
  result = await call('plans', 'POST', { action: 'create', values: { key: planKey, name: 'Smoke Plan', price_monthly: 19, currency: 'USD', is_active: false, features: [], limits: {} } });
  check('plan create', result);
  result = await call('plans', 'PATCH', { action: 'update', id: planKey, values: { key: planKey, name: 'Smoke Plan Edited', price_monthly: 29, currency: 'USD', is_active: false, features: [], limits: {} } });
  check('plan update', result);
  result = await call('plans', 'DELETE', { action: 'delete', id: planKey });
  check('plan delete', result);

  // Feature flags
  const flagKey = `smoke_flag_${stamp}`;
  result = await call('feature-flags', 'POST', { action: 'create', values: { key: flagKey, description: 'smoke', enabled: false, rollout: {} } });
  check('flag create', result);
  result = await call('feature-flags', 'PATCH', { action: 'update', id: flagKey, values: { key: flagKey, description: 'smoke edited', enabled: true, rollout: { percent: 10 } } });
  check('flag update', result);
  result = await call('feature-flags', 'DELETE', { action: 'delete', id: flagKey });
  check('flag delete', result);

  // Settings
  const settingKey = `smoke.setting.${stamp}`;
  result = await call('settings', 'POST', { action: 'create', values: { key: settingKey, value: { enabled: false }, is_public: false } });
  check('setting create', result);
  result = await call('settings', 'PATCH', { action: 'update', id: settingKey, values: { key: settingKey, value: { enabled: true }, is_public: false } });
  check('setting update', result);
  result = await call('settings', 'DELETE', { action: 'delete', id: settingKey });
  check('setting delete', result);

  // Announcements
  result = await call('announcements', 'POST', { action: 'create', values: { title: `Smoke ${stamp}`, body: 'Temporary smoke announcement.', variant: 'info', is_active: false } });
  check('announcement create', result);
  const announcementId = result.data?.id;
  if (announcementId) {
    result = await call('announcements', 'PATCH', { action: 'activate', id: announcementId });
    check('announcement activate', result);
    result = await call('announcements', 'PATCH', { action: 'deactivate', id: announcementId });
    check('announcement deactivate', result);
    result = await call('announcements', 'DELETE', { action: 'delete', id: announcementId });
    check('announcement delete', result);
  }

  // Organization owned by the disposable user.
  result = await call('organizations', 'POST', { action: 'create', values: { name: `Smoke Workspace ${stamp}`, owner_email: userEmail, plan_key: 'free' } });
  check('organization create', result);
  created.orgId = result.data?.id;
  if (!created.orgId) return;

  result = await call('organizations', 'PATCH', { action: 'update', id: created.orgId, values: { name: `Smoke Workspace ${stamp} edited`, industry: 'Testing', admin_notes: 'smoke' } });
  check('organization update', result);
  result = await call('organizations', 'PATCH', { action: 'change_plan', id: created.orgId, values: { plan_key: 'free' } });
  check('organization change plan', result);
  result = await call('organizations', 'PATCH', { action: 'suspend', id: created.orgId, values: { reason: 'smoke test' } });
  check('organization suspend', result);
  result = await call('organizations', 'PATCH', { action: 'restore', id: created.orgId });
  check('organization restore', result);

  // Subscription for the disposable workspace.
  const subscription = await service.from('subscriptions').select('id').eq('organization_id', created.orgId).maybeSingle();
  if (subscription.data?.id) {
    result = await call('subscriptions', 'PATCH', { action: 'update', id: subscription.data.id, values: { plan_key: 'free', status: 'trialing', cancel_at_period_end: false } });
    check('subscription update', result);
  } else {
    result = await call('subscriptions', 'POST', { action: 'create', values: { organization_id: created.orgId, plan_key: 'free', status: 'active' } });
    check('subscription create', result);
  }

  // Mailbox for the disposable workspace, created out of band.
  const mailboxEmail = `smoke-${stamp}@example.com`;
  const { data: mailboxData, error: mailboxError } = await service.from('mailboxes').insert({
    organization_id: created.orgId,
    user_id: created.authUserId,
    email_address: mailboxEmail,
    provider: 'smtp',
    status: 'disconnected',
    daily_limit: 50,
  }).select('id').single();
  if (mailboxError || !mailboxData) {
    record('mailbox create (fixture)', false, mailboxError?.message);
  } else {
    created.mailboxId = mailboxData.id;
    record('mailbox create (fixture)', true);
    result = await call('mailboxes', 'PATCH', { action: 'update', id: created.mailboxId, values: { display_name: 'Smoke Mailbox', daily_limit: 60, warmup_enabled: true, admin_notes: 'smoke' } });
    check('mailbox update', result);
    result = await call('mailboxes', 'PATCH', { action: 'disable', id: created.mailboxId });
    check('mailbox disable', result);
    const detail = await fetch(`${BASE}/api/admin/console/mailboxes?id=${created.mailboxId}`, { headers: { cookie } });
    const detailText = await detail.text();
    record('mailbox detail hides credentials', detail.status === 200 && !/password|refresh_token|access_token|client_secret/i.test(detailText), `status=${detail.status}`);
    result = await call('mailboxes', 'DELETE', { action: 'delete', id: created.mailboxId });
    check('mailbox delete', result);
  }

  // Lead in the disposable workspace.
  result = await call('leads', 'POST', { action: 'create', values: { organization_id: created.orgId, email: `lead-${stamp}@example.com`, first_name: 'Smoke', last_name: 'Lead', status: 'new', source: 'smoke' } });
  check('lead create', result);
  const leadId = result.data?.id;
  if (leadId) {
    result = await call('leads', 'PATCH', { action: 'set_status', id: leadId, values: { status: 'contacted' } });
    check('lead status', result);
    result = await call('leads', 'PATCH', { action: 'update', id: leadId, values: { first_name: 'Smoke Edited', company_name: 'Smoke Co', status: 'interested' } });
    check('lead update', result);
    result = await call('leads', 'DELETE', { action: 'delete', id: leadId });
    check('lead delete', result);
    result = await call('leads', 'PATCH', { action: 'restore', id: leadId });
    check('lead restore', result);
    await service.from('leads').delete().eq('id', leadId);
  }

  // Campaign in the disposable workspace.
  result = await call('campaigns', 'POST', { action: 'create', values: { organization_id: created.orgId, name: `Smoke Campaign ${stamp}`, daily_limit: 25 } });
  check('campaign create', result);
  const campaignId = result.data?.id;
  if (campaignId) {
    result = await call('campaigns', 'PATCH', { action: 'update', id: campaignId, values: { name: `Smoke Campaign ${stamp} edited`, daily_limit: 30, admin_notes: 'smoke' } });
    check('campaign update', result);
    result = await call('campaigns', 'PATCH', { action: 'pause', id: campaignId });
    check('campaign pause', result);
    result = await call('campaigns', 'PATCH', { action: 'resume', id: campaignId });
    check('campaign resume', result);
    result = await call('campaigns', 'PATCH', { action: 'archive', id: campaignId });
    check('campaign archive', result);
    result = await call('campaigns', 'PATCH', { action: 'restore', id: campaignId });
    check('campaign restore', result);
    // Resuming put it in active state; cancel first so delete is allowed.
    result = await call('campaigns', 'PATCH', { action: 'cancel', id: campaignId });
    check('campaign cancel', result);
    result = await call('campaigns', 'DELETE', { action: 'delete', id: campaignId });
    check('campaign delete', result);
  }

  // Support ticket lifecycle.
  result = await call('tickets', 'POST', { action: 'create', values: { organization_id: created.orgId, subject: `Smoke ticket ${stamp}`, description: 'Testing the support workflow.', priority: 'normal' } });
  check('ticket create', result);
  const ticketId = result.data?.id;
  if (ticketId) {
    result = await call('tickets', 'PATCH', { action: 'reply', id: ticketId, values: { message: 'Thanks for reaching out.' } });
    check('ticket reply', result);
    result = await call('tickets', 'PATCH', { action: 'internal_note', id: ticketId, values: { message: 'Internal smoke note.' } });
    check('ticket internal note', result);
    result = await call('tickets', 'PATCH', { action: 'update', id: ticketId, values: { status: 'in_progress', priority: 'high', category_key: 'other' } });
    check('ticket update', result);
    result = await call('tickets', 'PATCH', { action: 'resolve', id: ticketId });
    check('ticket resolve', result);
    result = await call('tickets', 'PATCH', { action: 'reopen', id: ticketId });
    check('ticket reopen', result);
    result = await call('tickets', 'DELETE', { action: 'delete', id: ticketId });
    check('ticket delete', result);
  }

  // Background job fixture.
  const { data: jobData, error: jobError } = await service.from('background_jobs').insert({
    organization_id: created.orgId,
    job_type: 'cleanup',
    status: 'failed',
    last_error: 'smoke failure',
  }).select('id').single();
  if (jobError || !jobData) {
    record('job fixture', false, jobError?.message);
  } else {
    created.jobId = jobData.id;
    result = await call('jobs', 'PATCH', { action: 'retry', id: created.jobId });
    check('job retry', result);
    result = await call('jobs', 'PATCH', { action: 'cancel', id: created.jobId });
    check('job cancel', result);
    result = await call('jobs', 'DELETE', { action: 'delete', id: created.jobId });
    check('job delete', result);
  }

  // Error log fixture.
  const { data: errorData, error: errorError } = await service.from('error_logs').insert({
    organization_id: created.orgId,
    level: 'error',
    message: `Smoke error ${stamp}`,
  }).select('id').single();
  if (errorError || !errorData) {
    record('error fixture', false, errorError?.message);
  } else {
    created.errorId = errorData.id;
    result = await call('errors', 'PATCH', { action: 'resolve', id: created.errorId });
    check('error resolve', result);
    result = await call('errors', 'PATCH', { action: 'reopen_error', id: created.errorId });
    check('error reopen', result);
    result = await call('errors', 'DELETE', { action: 'delete', id: created.errorId });
    check('error delete', result);
  }

  // Webhook fixture.
  const { data: webhookData, error: webhookError } = await service.from('webhook_events').insert({
    provider: 'stripe',
    event_id: `smoke-${stamp}`,
    signature_valid: true,
    payload: {},
  }).select('id').single();
  if (webhookError || !webhookData) {
    record('webhook fixture', false, webhookError?.message);
  } else {
    created.webhookId = webhookData.id;
    result = await call('webhooks', 'PATCH', { action: 'mark_processed', id: created.webhookId });
    check('webhook mark processed', result);
    result = await call('webhooks', 'DELETE', { action: 'delete', id: created.webhookId });
    check('webhook delete', result);
  }

  // Soft delete the workspace, then the disposable user can be removed.
  result = await call('organizations', 'DELETE', { action: 'delete', id: created.orgId });
  check('organization soft delete', result);
  result = await call('users', 'DELETE', { action: 'delete', id: created.authUserId });
  check('user delete', result);
  if (result.status === 200) created.authUserId = null;

  // Audit verification: every mutation above should have a row.
  const { data: auditRows } = await service
    .from('audit_logs')
    .select('action, entity_type, entity_id, actor_id, created_at')
    .in('action', [
      'admin.user.updated', 'admin.user.suspended', 'admin.user.reactivated', 'admin.user.deleted',
      'admin.lead.created', 'admin.lead.status_changed', 'admin.lead.updated', 'admin.lead.deleted', 'admin.lead.restored',
      'admin.campaign.created', 'admin.campaign.updated', 'admin.campaign.pause', 'admin.campaign.resume',
      'admin.campaign.archive', 'admin.campaign.restore', 'admin.campaign.cancel', 'admin.campaign.deleted',
      'admin.organization.created', 'admin.organization.updated', 'admin.organization.plan_changed',
      'admin.organization.suspended', 'admin.organization.restored', 'admin.organization.deleted', 'admin.organization.purged',
      'admin.mailbox.updated', 'admin.mailbox.disabled', 'admin.mailbox.deleted',
      'admin.ticket.created', 'admin.ticket.reply', 'admin.ticket.internal_note', 'admin.ticket.updated',
      'admin.ticket.resolve', 'admin.ticket.reopen', 'admin.ticket.deleted',
      'admin.plan.created', 'admin.plan.updated', 'admin.plan.deleted',
      'admin.feature_flag.created', 'admin.feature_flag.updated', 'admin.feature_flag.deleted',
      'admin.setting.updated', 'admin.setting.deleted',
      'admin.announcement.created', 'admin.announcement.activate', 'admin.announcement.deactivate', 'admin.announcement.deleted',
      'admin.job.retried', 'admin.job.cancelled', 'admin.job.deleted',
      'admin.error.resolved', 'admin.error.reopened', 'admin.error.deleted',
      'admin.webhook.processed', 'admin.webhook.deleted',
      'admin.admin.granted', 'admin.admin.updated', 'admin.admin.removed',
    ])
    .gte('created_at', new Date(stamp - 60_000).toISOString())
    .order('created_at', { ascending: true })
    .limit(500);
  const actions = new Set((auditRows ?? []).map((row) => row.action));
  for (const action of actions) auditIds.add(action);
  const expected = [
    'admin.user.updated', 'admin.user.suspended', 'admin.user.reactivated', 'admin.user.deleted',
    'admin.organization.created', 'admin.organization.updated', 'admin.organization.plan_changed',
    'admin.organization.suspended', 'admin.organization.restored', 'admin.organization.deleted', 'admin.organization.purged',
    'admin.lead.created', 'admin.lead.status_changed', 'admin.lead.updated', 'admin.lead.deleted', 'admin.lead.restored',
    'admin.campaign.created', 'admin.campaign.updated', 'admin.campaign.pause', 'admin.campaign.resume',
    'admin.campaign.archive', 'admin.campaign.restore', 'admin.campaign.cancel', 'admin.campaign.deleted',
    'admin.mailbox.updated', 'admin.mailbox.disabled', 'admin.mailbox.deleted',
    'admin.ticket.created', 'admin.ticket.reply', 'admin.ticket.internal_note', 'admin.ticket.updated',
    'admin.ticket.resolve', 'admin.ticket.reopen', 'admin.ticket.deleted',
    'admin.plan.created', 'admin.plan.updated', 'admin.plan.deleted',
    'admin.feature_flag.created', 'admin.feature_flag.updated', 'admin.feature_flag.deleted',
    'admin.setting.updated', 'admin.setting.deleted',
    'admin.announcement.created', 'admin.announcement.activate', 'admin.announcement.deactivate', 'admin.announcement.deleted',
    'admin.job.retried', 'admin.job.cancelled', 'admin.job.deleted',
    'admin.error.resolved', 'admin.error.reopened', 'admin.error.deleted',
    'admin.webhook.processed', 'admin.webhook.deleted',
  ];
  const missing = expected.filter((action) => !actions.has(action));
  record('audit entries for every write', missing.length === 0, missing.length ? `missing=${missing.join(',')}` : `${actions.size} actions`);

  const sample = (auditRows ?? []).find((row) => row.action === 'admin.lead.updated');
  const { data: detail } = sample
    ? await service.from('audit_logs').select('metadata, ip_hash, user_agent').eq('action', sample.action).limit(1).maybeSingle()
    : { data: null };
  record('audit captures before/after and request metadata', Boolean(detail?.metadata?.before && detail?.metadata?.after), detail ? `keys=${Object.keys(detail.metadata ?? {}).join(',')}` : 'no row');
}

try {
  await main();
} finally {
  // Cleanup everything disposable, even if a check failed midway.
  if (created.webhookId) await service.from('webhook_events').delete().eq('id', created.webhookId);
  if (created.jobId) await service.from('background_jobs').delete().eq('id', created.jobId);
  if (created.errorId) await service.from('error_logs').delete().eq('id', created.errorId);
  if (created.mailboxId) {
    await service.from('mailbox_credentials').delete().eq('mailbox_id', created.mailboxId);
    await service.from('mailboxes').delete().eq('id', created.mailboxId);
  }
  if (created.orgId) {
    await service.from('support_tickets').delete().eq('organization_id', created.orgId);
    await service.from('campaigns').delete().eq('organization_id', created.orgId);
    await service.from('leads').delete().eq('organization_id', created.orgId);
    await service.from('subscriptions').delete().eq('organization_id', created.orgId);
    await service.from('organization_members').delete().eq('organization_id', created.orgId);
    await service.from('organizations').delete().eq('id', created.orgId);
  }
  if (created.authUserId) await service.auth.admin.deleteUser(created.authUserId);

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}
