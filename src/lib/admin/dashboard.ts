import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { countByValue } from '@/lib/data/app';
import {
  CAMPAIGN_STATUSES,
  JOB_STATUSES,
  MAILBOX_STATUSES,
  TICKET_STATUSES,
} from '@/lib/validation';

const USER_SCAN_LIMIT = 5_000;

async function loadUsers(db: SupabaseClient) {
  const users: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 5; page += 1) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    users.push(...(data.users as unknown as Array<Record<string, unknown>>));
    if (data.users.length < 1000 || users.length >= USER_SCAN_LIMIT) break;
  }
  return users;
}

function integrationStatus() {
  return [
    { key: 'supabase', label: 'Supabase', configured: true, detail: 'Database and authentication' },
    { key: 'groq', label: 'Groq AI', configured: Boolean(process.env.GROQ_API_KEY), detail: 'Email writing and column analysis' },
    { key: 'gmail', label: 'Gmail OAuth', configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), detail: 'Send and read through the Gmail API' },
    { key: 'microsoft', label: 'Microsoft Graph', configured: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET), detail: 'Send and read through Outlook' },
    { key: 'smtp', label: 'SMTP / IMAP', configured: true, detail: 'Workspace supplied mailbox credentials' },
    { key: 'cron', label: 'Background worker', configured: Boolean(process.env.CRON_SECRET), detail: 'Vercel cron invokes /api/cron/worker' },
    { key: 'billing', label: 'Billing provider', configured: Boolean(process.env.BILLING_PROVIDER), detail: 'Checkout and subscription sync' },
  ];
}

export async function getPlatformOverview(db: SupabaseClient) {
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    users,
    orgTotal,
    orgSuspended,
    planRows,
    campaignCounts,
    campaignTotal,
    leadTotal,
    mailboxCounts,
    eventCounts,
    jobCounts,
    ticketCounts,
    aiSummary,
    billingSummary,
    growth,
    recentOrganizations,
    recentAudit,
    recentErrors,
    rateLimits,
  ] = await Promise.all([
    loadUsers(db),
    db.from('organizations').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('organizations').select('id', { count: 'exact', head: true }).eq('is_suspended', true).is('deleted_at', null),
    db.from('organizations').select('plan_key').is('deleted_at', null).limit(5000),
    countByValue(db, 'campaigns', 'status', CAMPAIGN_STATUSES, { excludeDeleted: true }),
    db.from('campaigns').select('id', { count: 'exact', head: true }).is('archived_at', null),
    db.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    countByValue(db, 'mailboxes', 'status', MAILBOX_STATUSES),
    countByValue(db, 'email_events', 'event_type', ['queued', 'processing', 'accepted', 'delivered', 'bounced', 'complained', 'opened', 'clicked', 'replied', 'unsubscribed', 'failed']),
    countByValue(db, 'background_jobs', 'status', JOB_STATUSES),
    countByValue(db, 'support_tickets', 'status', TICKET_STATUSES),
    db.rpc('admin_ai_usage_summary', { p_days: 30 }),
    db.rpc('admin_billing_summary'),
    db.rpc('admin_growth_series', { p_days: 30 }),
    db.from('organizations').select('id, name, plan_key, is_suspended, created_at, plan:subscription_plans(name)').is('deleted_at', null).order('created_at', { ascending: false }).limit(8),
    db.from('audit_logs').select('id, action, entity_type, actor_email, created_at').order('created_at', { ascending: false }).limit(12),
    db.from('error_logs').select('id, level, message, created_at').order('created_at', { ascending: false }).limit(8),
    db.from('rate_limits').select('count').order('window_start', { ascending: false }).limit(500),
  ]);

  const planCounts: Record<string, number> = {};
  for (const row of planRows.data ?? []) {
    const key = String(row.plan_key ?? 'free');
    planCounts[key] = (planCounts[key] ?? 0) + 1;
  }

  const now = Date.now();
  const activeUsers = users.filter((user) => user.last_sign_in_at && new Date(String(user.last_sign_in_at)).getTime() >= now - 30 * 86_400_000).length;
  const newUsers = users.filter((user) => user.created_at && new Date(String(user.created_at)).getTime() >= now - 30 * 86_400_000).length;
  const suspendedUsers = users.filter((user) => {
    const banned = user.banned_until ? String(user.banned_until) : '';
    return Boolean(banned && new Date(banned).getTime() > now);
  }).length;

  const ai = (aiSummary.data ?? {}) as { requests?: number; tokens?: number; costMicros?: number };
  const billing = (billingSummary.data ?? {}) as {
    mrr?: number;
    activeSubscriptions?: number;
    trialing?: number;
    pastDue?: number;
    failedPayments?: number;
    openInvoices?: number;
  };

  return {
    totals: {
      users: users.length,
      activeUsers,
      newUsers,
      suspendedUsers,
      organizations: orgTotal.count ?? 0,
      suspendedOrganizations: orgSuspended.count ?? 0,
      freePlan: planCounts.free ?? 0,
      paidSubscribers: Object.entries(planCounts).reduce((sum, [key, count]) => sum + (key === 'free' ? 0 : count), 0),
      mrr: billing.mrr ?? 0,
      activeSubscriptions: billing.activeSubscriptions ?? 0,
      trialing: billing.trialing ?? 0,
      pastDue: billing.pastDue ?? 0,
      failedPayments: billing.failedPayments ?? 0,
      openInvoices: billing.openInvoices ?? 0,
      campaigns: campaignTotal.count ?? 0,
      activeCampaigns: campaignCounts.active ?? 0,
      pausedCampaigns: campaignCounts.paused ?? 0,
      completedCampaigns: campaignCounts.completed ?? 0,
      leads: leadTotal.count ?? 0,
      mailboxes: Object.values(mailboxCounts).reduce((sum, count) => sum + count, 0),
      connectedMailboxes: mailboxCounts.connected ?? 0,
      emailsAccepted: eventCounts.accepted ?? 0,
      delivered: eventCounts.delivered ?? 0,
      bounces: eventCounts.bounced ?? 0,
      replies: eventCounts.replied ?? 0,
      unsubscribes: eventCounts.unsubscribed ?? 0,
      complaints: eventCounts.complained ?? 0,
      aiRequests: ai.requests ?? 0,
      aiTokens: ai.tokens ?? 0,
      aiCostMicros: ai.costMicros ?? 0,
      apiRequests: (rateLimits.data ?? []).reduce((sum, row) => sum + Number(row.count ?? 0), 0),
    },
    planCounts,
    campaignStatuses: campaignCounts,
    jobStatuses: jobCounts,
    ticketStatuses: ticketCounts,
    mailboxStatuses: mailboxCounts,
    eventCounts,
    ai,
    billing,
    growth: growth.data ?? { signups: [], organizations: [], emails: [], campaigns: [], revenue: [] },
    integrations: integrationStatus(),
    recentOrganizations: (recentOrganizations.data ?? []).map((row) => ({
      ...row,
      plan_name: (row.plan as { name?: string } | null)?.name ?? row.plan_key,
    })),
    recentAudit: recentAudit.data ?? [],
    recentErrors: recentErrors.data ?? [],
  };
}

export async function getPlatformAnalytics(db: SupabaseClient, days = 30) {
  const [growth, billing, campaignCounts, eventCounts, jobCounts, mailboxCounts, ai, topOrganizations] = await Promise.all([
    db.rpc('admin_growth_series', { p_days: days }),
    db.rpc('admin_billing_summary'),
    countByValue(db, 'campaigns', 'status', CAMPAIGN_STATUSES, { excludeDeleted: true }),
    countByValue(db, 'email_events', 'event_type', ['accepted', 'delivered', 'bounced', 'complained', 'replied', 'unsubscribed', 'failed']),
    countByValue(db, 'background_jobs', 'status', JOB_STATUSES),
    countByValue(db, 'mailboxes', 'status', MAILBOX_STATUSES),
    db.rpc('admin_ai_usage_summary', { p_days: days }),
    db.rpc('admin_top_organizations', { p_limit: 12 }),
  ]);

  return {
    days,
    growth: growth.data ?? { signups: [], organizations: [], emails: [], campaigns: [], revenue: [] },
    billing: billing.data ?? {},
    campaignStatuses: campaignCounts,
    eventCounts,
    jobStatuses: jobCounts,
    mailboxStatuses: mailboxCounts,
    ai: ai.data ?? {},
    topOrganizations: topOrganizations.data ?? [],
  };
}

export async function getSystemHealth(db: SupabaseClient) {
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const [jobs, mailboxes, campaigns, errors24h, jobsFailed, mailboxesError, recentErrors, audit] = await Promise.all([
    countByValue(db, 'background_jobs', 'status', JOB_STATUSES),
    countByValue(db, 'mailboxes', 'status', MAILBOX_STATUSES),
    countByValue(db, 'campaigns', 'status', CAMPAIGN_STATUSES),
    db.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', since24),
    db.from('background_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    db.from('mailboxes').select('id', { count: 'exact', head: true }).eq('status', 'error'),
    db.from('error_logs').select('id, level, message, created_at').order('created_at', { ascending: false }).limit(10),
    db.from('audit_logs').select('id, action, actor_email, created_at').order('created_at', { ascending: false }).limit(10),
  ]);

  return {
    jobs,
    mailboxes,
    campaigns,
    errorsLast24h: errors24h.count ?? 0,
    failedJobs: jobsFailed.count ?? 0,
    mailboxErrors: mailboxesError.count ?? 0,
    integrations: integrationStatus(),
    recentErrors: recentErrors.data ?? [],
    recentAudit: audit.data ?? [],
  };
}

export async function getRevenue(db: SupabaseClient, days = 30) {
  const [billing, growth, monthly, invoices, subscriptions] = await Promise.all([
    db.rpc('admin_billing_summary'),
    db.rpc('admin_growth_series', { p_days: days }),
    db.rpc('admin_revenue_series', { p_months: 6 }),
    db.from('invoices').select('id, amount_cents, currency, status, issued_at, paid_at, organization:organizations(name)').order('issued_at', { ascending: false }).limit(50),
    db.from('subscriptions').select('plan_key, status, plan:subscription_plans(name, price_monthly)'),
  ]);
  return {
    days,
    billing: billing.data ?? {},
    growth: growth.data ?? { revenue: [] },
    monthly: monthly.data ?? [],
    invoices: (invoices.data ?? []).map((row) => ({
      ...row,
      organization_name: (row.organization as { name?: string } | null)?.name ?? '',
    })),
    subscriptions: (subscriptions.data ?? []).map((row) => ({
      ...row,
      plan_name: (row.plan as { name?: string } | null)?.name ?? row.plan_key,
      price_monthly: (row.plan as { price_monthly?: number } | null)?.price_monthly ?? 0,
    })),
  };
}
