import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { countByValue } from '@/lib/data/app';
import {
  ADMIN_MODULES,
  safeSearch,
  type AdminDetailResponse,
  type AdminListResponse,
} from '@/lib/admin/shared';
import {
  CAMPAIGN_STATUSES,
  JOB_STATUSES,
  LEAD_STATUSES,
  MAILBOX_STATUSES,
  TICKET_STATUSES,
} from '@/lib/validation';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const USER_SCAN_LIMIT = 5_000;

export interface ListParams {
  page: number;
  pageSize: number;
  q: string;
  status: string;
  sort: string;
  dir: 'asc' | 'desc';
  filter: string;
  includeDeleted: boolean;
  includeArchived: boolean;
}

export function readListParams(url: URL): ListParams {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const pageSizeRaw = Number(url.searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  return {
    page,
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw)),
    q: safeSearch(url.searchParams.get('q')),
    status: safeSearch(url.searchParams.get('status')),
    sort: safeSearch(url.searchParams.get('sort')),
    dir: url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc',
    filter: safeSearch(url.searchParams.get('filter')),
    includeDeleted: url.searchParams.get('includeDeleted') === '1',
    includeArchived: url.searchParams.get('includeArchived') === '1',
  };
}

function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

function startOfDaysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function emailMap(users: Array<{ id: string; email?: string | null }>) {
  return new Map(users.map((user) => [user.id, user.email ?? '']));
}

async function listAllAuthUsers(db: SupabaseClient) {
  const all: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    all.push(...(data.users as unknown as Array<Record<string, unknown>>));
    if (data.users.length < 1000 || all.length >= USER_SCAN_LIMIT) break;
  }
  return all;
}

async function organizationIdsFor(db: SupabaseClient, q: string) {
  const { data } = await db
    .from('organizations')
    .select('id')
    .or(`name.ilike.%${q}%,slug.ilike.%${q}%,website.ilike.%${q}%`)
    .limit(200);
  return (data ?? []).map((row) => String(row.id));
}

async function orgFacet(db: SupabaseClient) {
  const { data } = await db
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')
    .limit(300);
  return (data ?? []).map((row) => ({ value: String(row.id), label: String(row.name) }));
}

async function planFacet(db: SupabaseClient) {
  const { data } = await db.from('subscription_plans').select('key, name').order('sort_order');
  return (data ?? []).map((row) => ({ value: String(row.key), label: String(row.name) }));
}

async function categoryFacet(db: SupabaseClient) {
  const { data } = await db.from('support_categories').select('key, name').order('name');
  return (data ?? []).map((row) => ({ value: String(row.key), label: String(row.name) }));
}

function emptyPage(params: ListParams, summary?: Record<string, string | number | null>): AdminListResponse {
  return { rows: [], ...pageMeta(params.page, params.pageSize, 0), summary };
}

export async function listModule(
  db: SupabaseClient,
  module: string,
  params: ListParams,
): Promise<AdminListResponse> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  switch (module) {
    case 'users': {
      const users = await listAllAuthUsers(db);
      const ids = users.map((user) => String(user.id));
      const profiles: Array<{ id: string; full_name: string | null; job_title: string | null; onboarding_completed: boolean }> = [];
      for (let i = 0; i < ids.length; i += 500) {
        const { data } = await db
          .from('profiles')
          .select('id, full_name, job_title, onboarding_completed')
          .in('id', ids.slice(i, i + 500));
        profiles.push(...((data ?? []) as typeof profiles));
      }
      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      const needle = params.q.toLowerCase();
      let rows = users.map((user) => {
        const profile = profileMap.get(String(user.id));
        const bannedUntil = user.banned_until ? String(user.banned_until) : '';
        return {
          id: String(user.id),
          email: String(user.email ?? ''),
          full_name: profile?.full_name ?? String((user.user_metadata as Record<string, unknown> | undefined)?.full_name ?? ''),
          job_title: profile?.job_title ?? '',
          created_at: user.created_at ?? null,
          last_sign_in_at: user.last_sign_in_at ?? null,
          confirmed: Boolean(user.email_confirmed_at),
          terminated: Boolean(bannedUntil && new Date(bannedUntil) > new Date()),
        };
      });
      rows = rows.filter((row) => {
        if (needle && !`${row.email} ${row.full_name} ${row.job_title}`.toLowerCase().includes(needle)) return false;
        if (params.status === 'suspended') return row.terminated;
        if (params.status === 'active') return !row.terminated;
        if (params.status === 'unconfirmed') return !row.confirmed;
        return true;
      });
      rows.sort((a, b) => {
        const key = params.sort === 'email' ? 'email' : params.sort === 'last_sign_in_at' ? 'last_sign_in_at' : 'created_at';
        const av = String(a[key as keyof typeof a] ?? '');
        const bv = String(b[key as keyof typeof b] ?? '');
        return params.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      const thirtyDays = Date.now() - 30 * 86_400_000;
      return {
        rows: rows.slice(from, to + 1),
        ...pageMeta(params.page, params.pageSize, rows.length),
        summary: {
          total: users.length,
          active30d: rows.filter((row) => row.last_sign_in_at && new Date(String(row.last_sign_in_at)).getTime() >= thirtyDays).length,
          new30d: rows.filter((row) => row.created_at && new Date(String(row.created_at)).getTime() >= thirtyDays).length,
          suspended: rows.filter((row) => row.terminated).length,
        },
      };
    }

    case 'organizations': {
      let query = db
        .from('organizations')
        .select('id, name, slug, plan_key, website, industry, company_size, timezone, is_suspended, suspended_reason, created_at, deleted_at, owner_id, plan:subscription_plans(name, price_monthly)', { count: 'exact' });
      if (params.q) query = query.or(`name.ilike.%${params.q}%,slug.ilike.%${params.q}%,website.ilike.%${params.q}%`);
      if (params.status === 'suspended') query = query.eq('is_suspended', true);
      if (params.status === 'active') query = query.eq('is_suspended', false).is('deleted_at', null);
      if (params.status === 'deleted') query = query.not('deleted_at', 'is', null);
      if (!params.status && !params.includeDeleted) query = query.is('deleted_at', null);
      const sort = ['created_at', 'name', 'plan_key'].includes(params.sort) ? params.sort : 'created_at';
      const { data, count, error } = await query.order(sort, { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params, { total: 0 });
      const rows = (data ?? []).map((row) => {
        const plan = row.plan as { name?: string; price_monthly?: number } | null;
        return {
          ...row,
          plan_name: plan?.name ?? row.plan_key,
          price_monthly: plan?.price_monthly ?? 0,
        };
      });
      const [total, suspended, free, paid] = await Promise.all([
        db.from('organizations').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        db.from('organizations').select('id', { count: 'exact', head: true }).eq('is_suspended', true).is('deleted_at', null),
        db.from('organizations').select('id', { count: 'exact', head: true }).eq('plan_key', 'free').is('deleted_at', null),
        db.from('organizations').select('id', { count: 'exact', head: true }).neq('plan_key', 'free').is('deleted_at', null),
      ]);
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: {
          total: total.count ?? 0,
          suspended: suspended.count ?? 0,
          free: free.count ?? 0,
          paid: paid.count ?? 0,
        },
        facets: { plan_key: await planFacet(db) },
      };
    }

    case 'leads': {
      let query = db
        .from('leads')
        .select('id, first_name, last_name, email, company_name, job_title, status, source, organization_id, last_contacted_at, created_at, deleted_at, organization:organizations(name)', { count: 'exact' });
      if (params.q) query = query.or(`email.ilike.%${params.q}%,first_name.ilike.%${params.q}%,last_name.ilike.%${params.q}%,company_name.ilike.%${params.q}%`);
      if (params.status) query = query.eq('status', params.status);
      if (params.filter) query = query.eq('organization_id', params.filter);
      if (!params.includeDeleted) query = query.is('deleted_at', null);
      else if (params.filter === '__deleted') query = query.not('deleted_at', 'is', null);
      const sort = ['created_at', 'email', 'company_name', 'last_contacted_at'].includes(params.sort) ? params.sort : 'created_at';
      const { data, count, error } = await query.order(sort, { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const rows = (data ?? []).map((row) => ({
        ...row,
        organization_name: (row.organization as { name?: string } | null)?.name ?? '',
      }));
      const [total, statusCounts] = await Promise.all([
        db.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        countByValue(db, 'leads', 'status', LEAD_STATUSES, { excludeDeleted: true }),
      ]);
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: {
          total: total.count ?? 0,
          ...statusCounts,
        },
        facets: { organization_id: await orgFacet(db) },
      };
    }

    case 'campaigns': {
      let query = db
        .from('campaigns')
        .select('id, name, description, status, total_leads, emails_sent, replies, bounces, unsubscribes, daily_limit, organization_id, launch_at, created_at, archived_at, admin_notes, organization:organizations(name)', { count: 'exact' });
      if (params.q) query = query.ilike('name', `%${params.q}%`);
      if (params.status) query = query.eq('status', params.status);
      if (params.filter) query = query.eq('organization_id', params.filter);
      if (!params.includeArchived) query = query.is('archived_at', null);
      const sort = ['created_at', 'name', 'emails_sent', 'replies', 'status'].includes(params.sort) ? params.sort : 'created_at';
      const { data, count, error } = await query.order(sort, { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const rows = (data ?? []).map((row) => ({
        ...row,
        organization_name: (row.organization as { name?: string } | null)?.name ?? '',
      }));
      const [total, statusCounts] = await Promise.all([
        db.from('campaigns').select('id', { count: 'exact', head: true }).is('archived_at', null),
        countByValue(db, 'campaigns', 'status', CAMPAIGN_STATUSES),
      ]);
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: { total: total.count ?? 0, ...statusCounts },
        facets: { organization_id: await orgFacet(db) },
      };
    }

    case 'mailboxes': {
      let query = db
        .from('mailboxes')
        .select('id, email_address, display_name, provider, status, daily_limit, sent_today, warmup_enabled, reputation, last_sync_at, last_error, organization_id, created_at, admin_notes, organization:organizations(name)', { count: 'exact' });
      if (params.q) query = query.ilike('email_address', `%${params.q}%`);
      if (params.status) query = query.eq('status', params.status);
      if (params.filter) query = query.eq('organization_id', params.filter);
      const sort = ['created_at', 'email_address', 'status', 'sent_today'].includes(params.sort) ? params.sort : 'created_at';
      const { data, count, error } = await query.order(sort, { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const rows = (data ?? []).map((row) => ({
        ...row,
        organization_name: (row.organization as { name?: string } | null)?.name ?? '',
      }));
      const [total, statusCounts] = await Promise.all([
        db.from('mailboxes').select('id', { count: 'exact', head: true }),
        countByValue(db, 'mailboxes', 'status', MAILBOX_STATUSES),
      ]);
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: { total: total.count ?? 0, ...statusCounts },
        facets: { organization_id: await orgFacet(db) },
      };
    }

    case 'subscriptions': {
      let orgIds: string[] | null = null;
      if (params.q) orgIds = await organizationIdsFor(db, params.q);
      let query = db
        .from('subscriptions')
        .select('id, status, plan_key, provider, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at, created_at, organization_id, plan:subscription_plans(name, price_monthly, currency), organization:organizations(id, name, slug)', { count: 'exact' });
      if (params.status) query = query.eq('status', params.status);
      if (params.filter) query = query.eq('plan_key', params.filter);
      if (orgIds) {
        if (!orgIds.length) return emptyPage(params);
        query = query.in('organization_id', orgIds);
      }
      const { data, count, error } = await query.order('created_at', { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const rows = (data ?? []).map((row) => {
        const org = row.organization as { name?: string } | null;
        const plan = row.plan as { name?: string; price_monthly?: number; currency?: string } | null;
        return {
          ...row,
          organization_name: org?.name ?? '',
          plan_name: plan?.name ?? row.plan_key,
          price_monthly: plan?.price_monthly ?? 0,
          currency: plan?.currency ?? 'USD',
        };
      });
      const [total, statusCounts, billing] = await Promise.all([
        db.from('subscriptions').select('id', { count: 'exact', head: true }),
        countByValue(db, 'subscriptions', 'status', ['trialing', 'active', 'past_due', 'canceled', 'paused']),
        db.rpc('admin_billing_summary'),
      ]);
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: {
          total: total.count ?? 0,
          ...statusCounts,
          mrr: (billing.data as { mrr?: number } | null)?.mrr ?? 0,
        },
        facets: { plan_key: await planFacet(db), organization_id: await orgFacet(db) },
      };
    }

    case 'plans': {
      const { data } = await db.from('subscription_plans').select('*').order('sort_order');
      const rows = data ?? [];
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, rows.length),
        summary: {
          total: rows.length,
          active: rows.filter((row) => row.is_active).length,
          paid: rows.filter((row) => Number(row.price_monthly) > 0).length,
        },
      };
    }

    case 'billing': {
      let orgIds: string[] | null = null;
      if (params.q) orgIds = await organizationIdsFor(db, params.q);
      let query = db
        .from('invoices')
        .select('id, organization_id, provider, provider_invoice_id, amount_cents, currency, status, hosted_url, issued_at, paid_at, created_at, organization:organizations(name)', { count: 'exact' });
      if (params.status) query = query.eq('status', params.status);
      if (orgIds) {
        if (!orgIds.length) return emptyPage(params);
        query = query.in('organization_id', orgIds);
      }
      const { data, count, error } = await query.order(params.sort || 'created_at', { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const rows = (data ?? []).map((row) => ({
        ...row,
        organization_name: (row.organization as { name?: string } | null)?.name ?? '',
      }));
      const { data: amounts } = await db.from('invoices').select('amount_cents, status');
      const paidCents = (amounts ?? []).filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.amount_cents ?? 0), 0);
      const [total, paid, open, failed] = await Promise.all([
        db.from('invoices').select('id', { count: 'exact', head: true }),
        db.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
        db.from('invoices').select('id', { count: 'exact', head: true }).in('status', ['open', 'draft']),
        db.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'uncollectible'),
      ]);
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: {
          total: total.count ?? 0,
          paid: paid.count ?? 0,
          open: open.count ?? 0,
          failed: failed.count ?? 0,
          paidAmountCents: paidCents,
        },
      };
    }

    case 'tickets': {
      let orgIds: string[] | null = null;
      if (params.q) orgIds = await organizationIdsFor(db, params.q);
      let query = db
        .from('support_tickets')
        .select('id, subject, description, status, priority, category_key, organization_id, user_id, assigned_to, created_at, updated_at, resolved_at, organization:organizations(name)', { count: 'exact' });
      if (params.q) query = query.or(`subject.ilike.%${params.q}%,description.ilike.%${params.q}%`);
      if (params.status) query = query.eq('status', params.status);
      if (params.filter) query = query.eq('priority', params.filter);
      if (orgIds?.length) query = query.in('organization_id', orgIds);
      const { data, count, error } = await query.order(params.sort || 'created_at', { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const rows = (data ?? []).map((row) => ({
        ...row,
        organization_name: (row.organization as { name?: string } | null)?.name ?? '',
      }));
      const [total, statusCounts] = await Promise.all([
        db.from('support_tickets').select('id', { count: 'exact', head: true }),
        countByValue(db, 'support_tickets', 'status', TICKET_STATUSES),
      ]);
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: { total: total.count ?? 0, ...statusCounts },
        facets: { organization_id: await orgFacet(db), category_key: await categoryFacet(db) },
      };
    }

    case 'announcements': {
      const { data } = await db.from('announcements').select('*').order('created_at', { ascending: false }).limit(200);
      const all = (data ?? []).filter((row) => {
        if (params.q && !`${row.title} ${row.body}`.toLowerCase().includes(params.q.toLowerCase())) return false;
        if (params.status === 'active') return Boolean(row.is_active);
        if (params.status === 'inactive') return !row.is_active;
        return true;
      });
      return {
        rows: all.slice(from, to + 1),
        ...pageMeta(params.page, params.pageSize, all.length),
        summary: { total: all.length, active: all.filter((row) => row.is_active).length },
      };
    }

    case 'ai-usage': {
      let query = db
        .from('ai_usage_records')
        .select('id, kind, tokens, cost_micros, organization_id, user_id, created_at, organization:organizations(name)', { count: 'exact' });
      if (params.filter) query = query.eq('kind', params.filter);
      if (params.q) {
        const orgIds = await organizationIdsFor(db, params.q);
        if (!orgIds.length) return emptyPage(params);
        query = query.in('organization_id', orgIds);
      }
      const { data, count, error } = await query.order('created_at', { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const rows = (data ?? []).map((row) => ({
        ...row,
        organization_name: (row.organization as { name?: string } | null)?.name ?? '',
      }));
      const [summary, models] = await Promise.all([
        db.rpc('admin_ai_usage_summary', { p_days: 30 }),
        db.from('ai_model_settings').select('*').order('updated_at', { ascending: false }).limit(20),
      ]);
      const ai = (summary.data ?? {}) as { requests?: number; tokens?: number; costMicros?: number };
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: {
          requests30d: ai.requests ?? 0,
          tokens30d: ai.tokens ?? 0,
          costMicros30d: ai.costMicros ?? 0,
          records: count ?? 0,
        },
        facets: { kind: (models.data ?? []).map((row) => ({ value: String(row.model), label: String(row.model) })) },
      };
    }

    case 'api-usage': {
      const { data } = await db.from('rate_limits').select('*').order('window_start', { ascending: false }).limit(500);
      const all = (data ?? []).filter((row) => (params.q ? String(row.key).toLowerCase().includes(params.q.toLowerCase()) : true));
      return {
        rows: all.slice(from, to + 1),
        ...pageMeta(params.page, params.pageSize, all.length),
        summary: {
          buckets: all.length,
          requests: all.reduce((sum, row) => sum + Number(row.count ?? 0), 0),
        },
      };
    }

    case 'feature-flags': {
      const { data } = await db.from('feature_flags').select('*').order('key');
      const all = (data ?? []).filter((row) => (params.q ? String(row.key).toLowerCase().includes(params.q.toLowerCase()) : true));
      return {
        rows: all.slice(from, to + 1),
        ...pageMeta(params.page, params.pageSize, all.length),
        summary: { total: all.length, enabled: all.filter((row) => row.enabled).length },
      };
    }

    case 'settings': {
      const { data } = await db.from('system_settings').select('*').order('key');
      const all = (data ?? []).filter((row) => (params.q ? String(row.key).toLowerCase().includes(params.q.toLowerCase()) : true));
      return { rows: all.slice(from, to + 1), ...pageMeta(params.page, params.pageSize, all.length), summary: { total: all.length } };
    }

    case 'integrations': {
      const rows = [
        { key: 'supabase', label: 'Supabase', configured: true, detail: 'Database, authentication and storage' },
        { key: 'groq', label: 'Groq AI', configured: Boolean(process.env.GROQ_API_KEY), detail: 'Email writing and column analysis' },
        { key: 'gmail', label: 'Gmail OAuth', configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), detail: 'Send and read through the Gmail API' },
        { key: 'microsoft', label: 'Microsoft Graph', configured: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET), detail: 'Send and read through Outlook' },
        { key: 'smtp', label: 'SMTP and IMAP', configured: true, detail: 'Workspace supplied mailbox credentials' },
        { key: 'cron', label: 'Background worker', configured: Boolean(process.env.CRON_SECRET), detail: 'Scheduled worker for campaigns and inbox sync' },
        { key: 'billing', label: 'Billing provider', configured: Boolean(process.env.BILLING_PROVIDER), detail: 'Checkout and subscription sync' },
      ].filter((row) => (params.q ? `${row.label} ${row.detail}`.toLowerCase().includes(params.q.toLowerCase()) : true));
      return {
        rows: rows.slice(from, to + 1),
        ...pageMeta(params.page, params.pageSize, rows.length),
        summary: { total: rows.length, configured: rows.filter((row) => row.configured).length },
      };
    }

    case 'jobs': {
      let query = db.from('background_jobs').select('*', { count: 'exact' });
      if (params.status) query = query.eq('status', params.status);
      if (params.filter) query = query.eq('job_type', params.filter);
      if (params.q) query = query.or(`job_type.ilike.%${params.q}%,last_error.ilike.%${params.q}%`);
      const { data, count, error } = await query.order(params.sort || 'created_at', { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const [total, statusCounts] = await Promise.all([
        db.from('background_jobs').select('id', { count: 'exact', head: true }),
        countByValue(db, 'background_jobs', 'status', JOB_STATUSES),
      ]);
      return {
        rows: data ?? [],
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: { total: total.count ?? 0, ...statusCounts },
      };
    }

    case 'errors': {
      let query = db.from('error_logs').select('*', { count: 'exact' });
      if (params.status === 'resolved') query = query.not('resolved_at', 'is', null);
      if (params.status === 'unresolved') query = query.is('resolved_at', null);
      if (params.filter) query = query.eq('level', params.filter);
      if (params.q) query = query.or(`message.ilike.%${params.q}%,stack.ilike.%${params.q}%`);
      const { data, count, error } = await query.order(params.sort || 'created_at', { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const [total, last24h, unresolved] = await Promise.all([
        db.from('error_logs').select('id', { count: 'exact', head: true }),
        db.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', startOfDaysAgo(1)),
        db.from('error_logs').select('id', { count: 'exact', head: true }).is('resolved_at', null),
      ]);
      return {
        rows: data ?? [],
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: { total: total.count ?? 0, last24h: last24h.count ?? 0, unresolved: unresolved.count ?? 0 },
        facets: {
          level: ['debug', 'info', 'warn', 'error', 'fatal'].map((value) => ({ value, label: value })),
        },
      };
    }

    case 'audit': {
      let query = db
        .from('audit_logs')
        .select('id, action, entity_type, entity_id, actor_id, actor_email, ip_hash, metadata, created_at, organization:organizations(name)', { count: 'exact' });
      if (params.q) query = query.or(`action.ilike.%${params.q}%,actor_email.ilike.%${params.q}%,entity_type.ilike.%${params.q}%`);
      if (params.filter) query = query.eq('action', params.filter);
      if (params.status) query = query.eq('entity_type', params.status);
      const { data, count, error } = await query.order('created_at', { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const rows = (data ?? []).map((row) => ({
        ...row,
        organization_name: (row.organization as { name?: string } | null)?.name ?? '',
      }));
      const [last24h, actions] = await Promise.all([
        db.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', startOfDaysAgo(1)),
        db.from('audit_logs').select('action').order('created_at', { ascending: false }).limit(1000),
      ]);
      const uniqueActions = [...new Set((actions.data ?? []).map((row) => String(row.action)))].slice(0, 100);
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: { total: count ?? 0, last24h: last24h.count ?? 0, distinctActions: uniqueActions.length },
        facets: { action: uniqueActions.map((value) => ({ value, label: value })) },
      };
    }

    case 'roles': {
      const [roles, admins, permissions] = await Promise.all([
        db.from('admin_roles').select('*').order('key'),
        db.from('platform_admins').select('user_id, role, granted_at, granted_by, notes').order('granted_at', { ascending: false }),
        db.from('admin_permissions').select('*').order('key'),
      ]);
      const users = await listAllAuthUsers(db);
      const emails = emailMap(users as Array<{ id: string; email?: string | null }>);
      const adminRows = (admins.data ?? []).map((row) => ({
        ...row,
        email: emails.get(String(row.user_id)) ?? '',
      }));
      return {
        rows: adminRows.slice(from, to + 1),
        ...pageMeta(params.page, params.pageSize, adminRows.length),
        summary: { admins: adminRows.length, roles: (roles.data ?? []).length, permissions: (permissions.data ?? []).length },
        secondary: {
          label: 'Role catalog',
          columns: [
            { key: 'key', label: 'Key' },
            { key: 'name', label: 'Name' },
            { key: 'permissions', label: 'Permissions', type: 'json' },
          ],
          rows: roles.data ?? [],
        },
      };
    }

    case 'webhooks': {
      let query = db.from('webhook_events').select('id, provider, event_id, signature_valid, processed_at, error, received_at', { count: 'exact' });
      if (params.q) query = query.or(`provider.ilike.%${params.q}%,event_id.ilike.%${params.q}%`);
      if (params.status === 'processed') query = query.not('processed_at', 'is', null);
      if (params.status === 'pending') query = query.is('processed_at', null);
      const { data, count, error } = await query.order('received_at', { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const [valid, invalid, processed] = await Promise.all([
        db.from('webhook_events').select('id', { count: 'exact', head: true }).eq('signature_valid', true),
        db.from('webhook_events').select('id', { count: 'exact', head: true }).eq('signature_valid', false),
        db.from('webhook_events').select('id', { count: 'exact', head: true }).not('processed_at', 'is', null),
      ]);
      return {
        rows: data ?? [],
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: { total: count ?? 0, valid: valid.count ?? 0, invalid: invalid.count ?? 0, processed: processed.count ?? 0 },
      };
    }

    case 'abuse': {
      const [complaints, bounces] = await Promise.all([
        db.from('email_complaints').select('id, email, provider, reason, occurred_at, organization:organizations(name)').order('occurred_at', { ascending: false }).limit(200),
        db.from('email_bounces').select('id, email, bounce_type, reason, provider, occurred_at, organization:organizations(name)').order('occurred_at', { ascending: false }).limit(200),
      ]);
      const complaintRows = (complaints.data ?? []).map((row) => ({ ...row, organization_name: (row.organization as { name?: string } | null)?.name ?? '' }));
      const bounceRows = (bounces.data ?? []).map((row) => ({ ...row, organization_name: (row.organization as { name?: string } | null)?.name ?? '' }));
      const filteredComplaints = complaintRows.filter((row) => (params.q ? String(row.email).toLowerCase().includes(params.q.toLowerCase()) : true));
      return {
        rows: filteredComplaints.slice(from, to + 1),
        ...pageMeta(params.page, params.pageSize, filteredComplaints.length),
        summary: { complaints: complaintRows.length, bounces: bounceRows.length },
        secondary: {
          label: 'Bounce records',
          columns: [
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'bounce_type', label: 'Type', type: 'status' },
            { key: 'reason', label: 'Reason' },
            { key: 'organization_name', label: 'Organization' },
            { key: 'occurred_at', label: 'Occurred', type: 'datetime' },
          ],
          rows: bounceRows,
        },
      };
    }

    case 'email-activity': {
      let query = db
        .from('email_events')
        .select('id, event_type, occurred_at, campaign_id, lead_id, organization_id, metadata, organization:organizations(name)', { count: 'exact' });
      if (params.status) query = query.eq('event_type', params.status);
      if (params.q) {
        const orgIds = await organizationIdsFor(db, params.q);
        if (!orgIds.length) return emptyPage(params);
        query = query.in('organization_id', orgIds);
      }
      const { data, count, error } = await query.order('occurred_at', { ascending: params.dir === 'asc' }).range(from, to);
      if (error) return emptyPage(params);
      const rows = (data ?? []).map((row) => ({
        ...row,
        organization_name: (row.organization as { name?: string } | null)?.name ?? '',
      }));
      const statusCounts = await countByValue(db, 'email_events', 'event_type', ['queued', 'processing', 'accepted', 'delivered', 'bounced', 'complained', 'opened', 'clicked', 'replied', 'unsubscribed', 'failed']);
      return {
        rows,
        ...pageMeta(params.page, params.pageSize, count ?? 0),
        summary: { total: count ?? 0, ...statusCounts },
      };
    }

    default:
      throw new Error(`Unknown admin module: ${module}`);
  }
}

// ── detail payloads ─────────────────────────────────────────

export async function getModuleDetail(
  db: SupabaseClient,
  module: string,
  id: string,
): Promise<AdminDetailResponse> {
  switch (module) {
    case 'users': {
      const [{ data: authUser }, { data: profile }, { data: memberships }, { data: mailboxes }, { data: campaigns }, { data: tickets }] = await Promise.all([
        db.auth.admin.getUserById(id),
        db.from('profiles').select('*').eq('id', id).maybeSingle(),
        db.from('organization_members').select('role, status, joined_at, organization:organizations(id, name, plan_key, is_suspended)').eq('user_id', id).limit(50),
        db.from('mailboxes').select('id, email_address, provider, status, daily_limit, sent_today, last_sync_at').eq('user_id', id).limit(50),
        db.from('campaigns').select('id, name, status, emails_sent, replies, created_at').eq('created_by', id).limit(50),
        db.from('support_tickets').select('id, subject, status, priority, created_at').eq('user_id', id).limit(50),
      ]);
      if (!authUser.user) throw new Error('User not found.');
      const user = authUser.user;
      const bannedUntil = (user as unknown as { banned_until?: string }).banned_until;
      return {
        title: user.email ?? id,
        subtitle: profile?.full_name ?? 'Platform user',
        fields: [
          { key: 'email', label: 'Email', type: 'email', value: user.email },
          { key: 'full_name', label: 'Full name', value: profile?.full_name },
          { key: 'job_title', label: 'Job title', value: profile?.job_title },
          { key: 'phone', label: 'Phone', value: profile?.phone },
          { key: 'timezone', label: 'Timezone', value: profile?.timezone },
          { key: 'created_at', label: 'Registered', type: 'datetime', value: user.created_at },
          { key: 'last_sign_in_at', label: 'Last sign in', type: 'datetime', value: user.last_sign_in_at },
          { key: 'email_confirmed_at', label: 'Email confirmed', type: 'bool', value: Boolean(user.email_confirmed_at) },
          { key: 'status', label: 'Account status', type: 'status', value: bannedUntil && new Date(bannedUntil) > new Date() ? 'suspended' : 'active' },
        ],
        sections: [
          {
            title: 'Workspaces',
            columns: [{ key: 'organization_name', label: 'Organization' }, { key: 'role', label: 'Role', type: 'status' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'joined_at', label: 'Joined', type: 'date' }],
            rows: (memberships ?? []).map((row) => ({ ...row, organization_name: (row.organization as { name?: string } | null)?.name ?? '' })),
          },
          {
            title: 'Mailboxes',
            columns: [{ key: 'email_address', label: 'Email', type: 'email' }, { key: 'provider', label: 'Provider' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'sent_today', label: 'Sent today' }, { key: 'last_sync_at', label: 'Last sync', type: 'datetime' }],
            rows: mailboxes ?? [],
          },
          {
            title: 'Campaigns',
            columns: [{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'emails_sent', label: 'Sent' }, { key: 'replies', label: 'Replies' }, { key: 'created_at', label: 'Created', type: 'date' }],
            rows: campaigns ?? [],
          },
          {
            title: 'Support tickets',
            columns: [{ key: 'subject', label: 'Subject' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'priority', label: 'Priority', type: 'status' }, { key: 'created_at', label: 'Created', type: 'date' }],
            rows: tickets ?? [],
          },
        ],
      };
    }

    case 'organizations': {
      const { data: org } = await db.from('organizations').select('*, plan:subscription_plans(name, price_monthly, currency)').eq('id', id).maybeSingle();
      if (!org) throw new Error('Organization not found.');
      const [owner, members, subscription, invoices, mailboxes, campaigns] = await Promise.all([
        db.auth.admin.getUserById(String(org.owner_id)),
        db.from('organization_members').select('user_id, role, status, joined_at').eq('organization_id', id).limit(200),
        db.from('subscriptions').select('*, plan:subscription_plans(name, price_monthly, currency)').eq('organization_id', id).maybeSingle(),
        db.from('invoices').select('id, amount_cents, currency, status, issued_at, paid_at').eq('organization_id', id).order('issued_at', { ascending: false }).limit(50),
        db.from('mailboxes').select('id, email_address, provider, status, sent_today, daily_limit').eq('organization_id', id).limit(100),
        db.from('campaigns').select('id, name, status, emails_sent, replies, created_at').eq('organization_id', id).limit(100),
      ]);
      return {
        title: String(org.name),
        subtitle: `${org.slug} · ${(org.plan as { name?: string } | null)?.name ?? org.plan_key}`,
        fields: [
          { key: 'id', label: 'Organization ID', value: org.id },
          { key: 'slug', label: 'Slug', value: org.slug },
          { key: 'website', label: 'Website', value: org.website },
          { key: 'industry', label: 'Industry', value: org.industry },
          { key: 'company_size', label: 'Company size', value: org.company_size },
          { key: 'timezone', label: 'Timezone', value: org.timezone },
          { key: 'plan_key', label: 'Plan', type: 'status', value: org.plan_key },
          { key: 'owner_email', label: 'Owner email', type: 'email', value: owner.data.user?.email },
          { key: 'created_at', label: 'Created', type: 'datetime', value: org.created_at },
          { key: 'is_suspended', label: 'Suspended', type: 'bool', value: org.is_suspended },
          { key: 'suspended_reason', label: 'Suspension reason', value: org.suspended_reason },
          { key: 'admin_notes', label: 'Internal notes', value: org.admin_notes },
        ],
        sections: [
          {
            title: 'Members',
            columns: [{ key: 'user_id', label: 'User ID' }, { key: 'role', label: 'Role', type: 'status' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'joined_at', label: 'Joined', type: 'date' }],
            rows: members.data ?? [],
          },
          {
            title: 'Subscription',
            columns: [{ key: 'plan_name', label: 'Plan' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'current_period_end', label: 'Period end', type: 'date' }, { key: 'cancel_at_period_end', label: 'Cancels', type: 'bool' }],
            rows: subscription.data ? [{ ...subscription.data, plan_name: (subscription.data.plan as { name?: string } | null)?.name ?? subscription.data.plan_key }] : [],
          },
          {
            title: 'Invoices',
            columns: [{ key: 'id', label: 'Invoice' }, { key: 'amount_cents', label: 'Amount', type: 'money' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'issued_at', label: 'Issued', type: 'date' }, { key: 'paid_at', label: 'Paid', type: 'date' }],
            rows: invoices.data ?? [],
          },
          {
            title: 'Mailboxes',
            columns: [{ key: 'email_address', label: 'Email', type: 'email' }, { key: 'provider', label: 'Provider' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'sent_today', label: 'Sent today' }, { key: 'daily_limit', label: 'Limit' }],
            rows: mailboxes.data ?? [],
          },
          {
            title: 'Campaigns',
            columns: [{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'emails_sent', label: 'Sent' }, { key: 'replies', label: 'Replies' }, { key: 'created_at', label: 'Created', type: 'date' }],
            rows: campaigns.data ?? [],
          },
        ],
      };
    }

    case 'leads': {
      const { data: lead } = await db.from('leads').select('*, organization:organizations(name)').eq('id', id).maybeSingle();
      if (!lead) throw new Error('Lead not found.');
      const [notes, activities, tags, campaigns] = await Promise.all([
        db.from('lead_notes').select('id, body, created_at, author_id').eq('lead_id', id).order('created_at', { ascending: false }).limit(50),
        db.from('lead_activities').select('id, activity_type, description, occurred_at').eq('lead_id', id).order('occurred_at', { ascending: false }).limit(50),
        db.from('lead_tag_assignments').select('tag:lead_tags(name)').eq('lead_id', id),
        db.from('campaign_leads').select('status, current_step, last_sent_at, campaign:campaigns(name, status)').eq('lead_id', id).limit(50),
      ]);
      return {
        title: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || String(lead.email),
        subtitle: String(lead.email),
        fields: [
          { key: 'email', label: 'Email', type: 'email', value: lead.email },
          { key: 'company_name', label: 'Company', value: lead.company_name },
          { key: 'job_title', label: 'Job title', value: lead.job_title },
          { key: 'phone', label: 'Phone', value: lead.phone },
          { key: 'status', label: 'Status', type: 'status', value: lead.status },
          { key: 'source', label: 'Source', value: lead.source },
          { key: 'organization_name', label: 'Organization', value: (lead.organization as { name?: string } | null)?.name ?? lead.organization_id },
          { key: 'tags', label: 'Tags', value: (tags.data ?? []).map((row) => (row.tag as { name?: string } | null)?.name).filter(Boolean).join(', ') },
          { key: 'last_contacted_at', label: 'Last contacted', type: 'datetime', value: lead.last_contacted_at },
          { key: 'created_at', label: 'Created', type: 'datetime', value: lead.created_at },
          { key: 'deleted_at', label: 'Deleted', type: 'bool', value: Boolean(lead.deleted_at) },
        ],
        sections: [
          { title: 'Campaigns', columns: [{ key: 'campaign_name', label: 'Campaign' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'current_step', label: 'Step' }, { key: 'last_sent_at', label: 'Last sent', type: 'datetime' }], rows: (campaigns.data ?? []).map((row) => ({ ...row, campaign_name: (row.campaign as { name?: string } | null)?.name ?? '' })) },
          { title: 'Notes', columns: [{ key: 'body', label: 'Note' }, { key: 'created_at', label: 'Created', type: 'datetime' }], rows: notes.data ?? [] },
          { title: 'Activity', columns: [{ key: 'activity_type', label: 'Type' }, { key: 'description', label: 'Description' }, { key: 'occurred_at', label: 'When', type: 'datetime' }], rows: activities.data ?? [] },
        ],
      };
    }

    case 'campaigns': {
      const { data: campaign } = await db.from('campaigns').select('*, organization:organizations(name), mailbox:mailboxes(email_address, status)').eq('id', id).maybeSingle();
      if (!campaign) throw new Error('Campaign not found.');
      const [executions, settings, leads] = await Promise.all([
        db.from('campaign_executions').select('id, step_order, status, scheduled_for, finished_at, error, lead:leads(email)').eq('campaign_id', id).order('created_at', { ascending: false }).limit(120),
        db.from('campaign_settings').select('*').eq('campaign_id', id).maybeSingle(),
        db.from('campaign_leads').select('status, current_step, last_sent_at, lead:leads(email)').eq('campaign_id', id).limit(200),
      ]);
      return {
        title: String(campaign.name),
        subtitle: String((campaign.organization as { name?: string } | null)?.name ?? ''),
        fields: [
          { key: 'status', label: 'Status', type: 'status', value: campaign.status },
          { key: 'organization_name', label: 'Organization', value: (campaign.organization as { name?: string } | null)?.name ?? campaign.organization_id },
          { key: 'mailbox_email', label: 'Mailbox', type: 'email', value: (campaign.mailbox as { email_address?: string } | null)?.email_address },
          { key: 'daily_limit', label: 'Daily limit', value: campaign.daily_limit },
          { key: 'total_leads', label: 'Total leads', value: campaign.total_leads },
          { key: 'emails_sent', label: 'Emails sent', value: campaign.emails_sent },
          { key: 'replies', label: 'Replies', value: campaign.replies },
          { key: 'bounces', label: 'Bounces', value: campaign.bounces },
          { key: 'unsubscribes', label: 'Unsubscribes', value: campaign.unsubscribes },
          { key: 'launch_at', label: 'Launch at', type: 'datetime', value: campaign.launch_at },
          { key: 'created_at', label: 'Created', type: 'datetime', value: campaign.created_at },
          { key: 'archived_at', label: 'Archived', type: 'datetime', value: campaign.archived_at },
          { key: 'admin_notes', label: 'Internal notes', value: campaign.admin_notes },
        ],
        sections: [
          { title: 'Recent executions', columns: [{ key: 'lead_email', label: 'Lead', type: 'email' }, { key: 'step_order', label: 'Step' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'scheduled_for', label: 'Scheduled', type: 'datetime' }, { key: 'error', label: 'Error' }], rows: (executions.data ?? []).map((row) => ({ ...row, lead_email: (row.lead as { email?: string } | null)?.email ?? '' })) },
          { title: 'Settings', fields: settings.data ? [
            { key: 'track_opens', label: 'Track opens', type: 'bool', value: settings.data.track_opens },
            { key: 'track_clicks', label: 'Track clicks', type: 'bool', value: settings.data.track_clicks },
            { key: 'stop_on_reply', label: 'Stop on reply', type: 'bool', value: settings.data.stop_on_reply },
            { key: 'stop_on_bounce', label: 'Stop on bounce', type: 'bool', value: settings.data.stop_on_bounce },
            { key: 'max_followups', label: 'Max follow-ups', value: settings.data.max_followups },
            { key: 'send_window_start', label: 'Window start', value: settings.data.send_window_start },
            { key: 'send_window_end', label: 'Window end', value: settings.data.send_window_end },
          ] : [] },
          { title: 'Recipients', columns: [{ key: 'lead_email', label: 'Lead', type: 'email' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'current_step', label: 'Step' }, { key: 'last_sent_at', label: 'Last sent', type: 'datetime' }], rows: (leads.data ?? []).map((row) => ({ ...row, lead_email: (row.lead as { email?: string } | null)?.email ?? '' })) },
        ],
        actions: [
          { key: 'pause', label: 'Pause campaign' },
          { key: 'resume', label: 'Resume campaign' },
          { key: 'archive', label: 'Archive campaign', tone: 'danger', confirm: 'Archive this campaign? Sending stops immediately.' },
        ],
      };
    }

    case 'mailboxes': {
      const { data: mailbox } = await db.from('mailboxes').select('*, organization:organizations(name)').eq('id', id).maybeSingle();
      if (!mailbox) throw new Error('Mailbox not found.');
      const [health, usage, credentials] = await Promise.all([
        db.from('mailbox_health').select('status, score, details, checked_at').eq('mailbox_id', id).order('checked_at', { ascending: false }).limit(20),
        db.from('mailbox_daily_usage').select('usage_date, sent, received, failed').eq('mailbox_id', id).order('usage_date', { ascending: false }).limit(30),
        db.from('mailbox_credentials').select('key_version, updated_at').eq('mailbox_id', id).maybeSingle(),
      ]);
      return {
        title: String(mailbox.email_address),
        subtitle: String((mailbox.organization as { name?: string } | null)?.name ?? ''),
        fields: [
          { key: 'provider', label: 'Provider', value: mailbox.provider },
          { key: 'status', label: 'Status', type: 'status', value: mailbox.status },
          { key: 'display_name', label: 'Display name', value: mailbox.display_name },
          { key: 'daily_limit', label: 'Daily limit', value: mailbox.daily_limit },
          { key: 'sent_today', label: 'Sent today', value: mailbox.sent_today },
          { key: 'warmup_enabled', label: 'Warmup', type: 'bool', value: mailbox.warmup_enabled },
          { key: 'reputation', label: 'Reputation', type: 'status', value: mailbox.reputation },
          { key: 'last_sync_at', label: 'Last sync', type: 'datetime', value: mailbox.last_sync_at },
          { key: 'last_error', label: 'Last error', value: mailbox.last_error },
          { key: 'credentials', label: 'Credentials stored', type: 'bool', value: Boolean(credentials) },
          { key: 'admin_notes', label: 'Internal notes', value: mailbox.admin_notes },
        ],
        sections: [
          { title: 'Health checks', columns: [{ key: 'status', label: 'Status', type: 'status' }, { key: 'score', label: 'Score' }, { key: 'checked_at', label: 'Checked', type: 'datetime' }], rows: health.data ?? [] },
          { title: 'Daily usage', columns: [{ key: 'usage_date', label: 'Date', type: 'date' }, { key: 'sent', label: 'Sent' }, { key: 'received', label: 'Received' }, { key: 'failed', label: 'Failed' }], rows: usage.data ?? [] },
        ],
        actions: [
          { key: 'enable', label: 'Enable mailbox' },
          { key: 'disable', label: 'Disable mailbox' },
          { key: 'disconnect', label: 'Disconnect credentials', tone: 'danger', confirm: 'Delete the stored credentials? The mailbox stays in the list but cannot send until reconnected.' },
        ],
      };
    }

    case 'subscriptions': {
      const { data: subscription } = await db.from('subscriptions').select('*, plan:subscription_plans(*), organization:organizations(id, name, slug, plan_key)').eq('id', id).maybeSingle();
      if (!subscription) throw new Error('Subscription not found.');
      const invoices = await db.from('invoices').select('id, amount_cents, currency, status, issued_at, paid_at').eq('organization_id', String(subscription.organization_id)).order('issued_at', { ascending: false }).limit(50);
      return {
        title: String((subscription.organization as { name?: string } | null)?.name ?? 'Subscription'),
        subtitle: String(subscription.plan_key),
        fields: [
          { key: 'plan_key', label: 'Plan', type: 'status', value: subscription.plan_key },
          { key: 'status', label: 'Status', type: 'status', value: subscription.status },
          { key: 'provider', label: 'Provider', value: subscription.provider },
          { key: 'current_period_start', label: 'Period start', type: 'date', value: subscription.current_period_start },
          { key: 'current_period_end', label: 'Period end', type: 'date', value: subscription.current_period_end },
          { key: 'cancel_at_period_end', label: 'Cancels at period end', type: 'bool', value: subscription.cancel_at_period_end },
          { key: 'trial_ends_at', label: 'Trial ends', type: 'datetime', value: subscription.trial_ends_at },
        ],
        sections: [{ title: 'Invoices', columns: [{ key: 'id', label: 'Invoice' }, { key: 'amount_cents', label: 'Amount', type: 'money' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'issued_at', label: 'Issued', type: 'date' }, { key: 'paid_at', label: 'Paid', type: 'date' }], rows: invoices.data ?? [] }],
      };
    }

    case 'tickets': {
      const { data: ticket } = await db.from('support_tickets').select('*, organization:organizations(name)').eq('id', id).maybeSingle();
      if (!ticket) throw new Error('Ticket not found.');
      const messages = await db.from('support_messages').select('id, body, author_type, is_internal, created_at, author_id').eq('ticket_id', id).order('created_at');
      return {
        title: String(ticket.subject),
        subtitle: String((ticket.organization as { name?: string } | null)?.name ?? ''),
        fields: [
          { key: 'status', label: 'Status', type: 'status', value: ticket.status },
          { key: 'priority', label: 'Priority', type: 'status', value: ticket.priority },
          { key: 'category_key', label: 'Category', value: ticket.category_key },
          { key: 'assigned_to', label: 'Assigned to', value: ticket.assigned_to },
          { key: 'created_at', label: 'Created', type: 'datetime', value: ticket.created_at },
          { key: 'resolved_at', label: 'Resolved', type: 'datetime', value: ticket.resolved_at },
          { key: 'description', label: 'Description', value: ticket.description },
        ],
        sections: [{ title: 'Conversation', columns: [{ key: 'author_type', label: 'From', type: 'status' }, { key: 'body', label: 'Message' }, { key: 'is_internal', label: 'Internal', type: 'bool' }, { key: 'created_at', label: 'When', type: 'datetime' }], rows: messages.data ?? [] }],
        actions: [
          { key: 'reply', label: 'Reply to customer' },
          { key: 'internal_note', label: 'Add internal note' },
          { key: 'resolve', label: 'Mark resolved' },
          { key: 'reopen', label: 'Reopen ticket' },
        ],
      };
    }

    case 'plans': {
      const { data: plan } = await db.from('subscription_plans').select('*').eq('key', id).maybeSingle();
      if (!plan) throw new Error('Plan not found.');
      const subscriptions = await db.from('subscriptions').select('id, status, organization:organizations(name)').eq('plan_key', id).limit(100);
      return {
        title: String(plan.name),
        subtitle: String(plan.key),
        fields: [
          { key: 'key', label: 'Key', value: plan.key },
          { key: 'description', label: 'Description', value: plan.description },
          { key: 'price_monthly', label: 'Monthly price', type: 'money', value: Number(plan.price_monthly) * 100 },
          { key: 'currency', label: 'Currency', value: plan.currency },
          { key: 'is_active', label: 'Active', type: 'bool', value: plan.is_active },
          { key: 'limits', label: 'Limits', type: 'json', value: plan.limits },
          { key: 'features', label: 'Features', type: 'json', value: plan.features },
        ],
        sections: [{ title: 'Subscribers', columns: [{ key: 'organization_name', label: 'Organization' }, { key: 'status', label: 'Status', type: 'status' }], rows: (subscriptions.data ?? []).map((row) => ({ ...row, organization_name: (row.organization as { name?: string } | null)?.name ?? '' })) }],
      };
    }

    case 'billing': {
      const { data: invoice } = await db.from('invoices').select('*, organization:organizations(name)').eq('id', id).maybeSingle();
      if (!invoice) throw new Error('Invoice not found.');
      return {
        title: String(invoice.provider_invoice_id ?? invoice.id),
        subtitle: String((invoice.organization as { name?: string } | null)?.name ?? ''),
        fields: [
          { key: 'amount_cents', label: 'Amount', type: 'money', value: invoice.amount_cents },
          { key: 'currency', label: 'Currency', value: invoice.currency },
          { key: 'status', label: 'Status', type: 'status', value: invoice.status },
          { key: 'provider', label: 'Provider', value: invoice.provider },
          { key: 'issued_at', label: 'Issued', type: 'datetime', value: invoice.issued_at },
          { key: 'paid_at', label: 'Paid', type: 'datetime', value: invoice.paid_at },
          { key: 'hosted_url', label: 'Hosted invoice', value: invoice.hosted_url },
        ],
        sections: [],
        actions: invoice.status === 'open' ? [{ key: 'void_invoice', label: 'Void invoice', tone: 'danger', confirm: 'Void this invoice? This is an administrative record change only.' }] : [],
      };
    }

    case 'announcements': {
      const { data: announcement } = await db.from('announcements').select('*').eq('id', id).maybeSingle();
      if (!announcement) throw new Error('Announcement not found.');
      return {
        title: String(announcement.title),
        subtitle: String(announcement.variant),
        fields: [
          { key: 'body', label: 'Body', value: announcement.body },
          { key: 'variant', label: 'Variant', type: 'status', value: announcement.variant },
          { key: 'is_active', label: 'Active', type: 'bool', value: announcement.is_active },
          { key: 'starts_at', label: 'Starts', type: 'datetime', value: announcement.starts_at },
          { key: 'ends_at', label: 'Ends', type: 'datetime', value: announcement.ends_at },
        ],
        sections: [],
      };
    }

    case 'feature-flags': {
      const { data: flag } = await db.from('feature_flags').select('*').eq('key', id).maybeSingle();
      if (!flag) throw new Error('Feature flag not found.');
      return {
        title: String(flag.key),
        subtitle: flag.description ?? '',
        fields: [
          { key: 'enabled', label: 'Enabled', type: 'bool', value: flag.enabled },
          { key: 'description', label: 'Description', value: flag.description },
          { key: 'rollout', label: 'Rollout', type: 'json', value: flag.rollout },
          { key: 'updated_at', label: 'Updated', type: 'datetime', value: flag.updated_at },
        ],
        sections: [],
      };
    }

    case 'settings': {
      const { data: setting } = await db.from('system_settings').select('*').eq('key', id).maybeSingle();
      if (!setting) throw new Error('Setting not found.');
      return {
        title: String(setting.key),
        subtitle: 'System setting',
        fields: [
          { key: 'value', label: 'Value', type: 'json', value: setting.value },
          { key: 'is_public', label: 'Public', type: 'bool', value: setting.is_public },
          { key: 'updated_at', label: 'Updated', type: 'datetime', value: setting.updated_at },
        ],
        sections: [],
      };
    }

    case 'jobs': {
      const { data: job } = await db.from('background_jobs').select('*').eq('id', id).maybeSingle();
      if (!job) throw new Error('Job not found.');
      const logs = await db.from('background_job_logs').select('id, level, message, metadata, created_at').eq('job_id', id).order('created_at').limit(100);
      return {
        title: `${job.job_type} job`,
        subtitle: String(job.id),
        fields: [
          { key: 'status', label: 'Status', type: 'status', value: job.status },
          { key: 'priority', label: 'Priority', value: job.priority },
          { key: 'attempts', label: 'Attempts', value: `${job.attempts}/${job.max_attempts}` },
          { key: 'run_at', label: 'Run at', type: 'datetime', value: job.run_at },
          { key: 'last_error', label: 'Last error', value: job.last_error },
          { key: 'payload', label: 'Payload', type: 'json', value: job.payload },
          { key: 'created_at', label: 'Created', type: 'datetime', value: job.created_at },
        ],
        sections: [{ title: 'Job logs', columns: [{ key: 'level', label: 'Level', type: 'status' }, { key: 'message', label: 'Message' }, { key: 'created_at', label: 'When', type: 'datetime' }], rows: logs.data ?? [] }],
        actions: [{ key: 'retry', label: 'Retry job' }, { key: 'cancel', label: 'Cancel job', tone: 'danger', confirm: 'Cancel this background job?' }],
      };
    }

    case 'errors': {
      const { data: log } = await db.from('error_logs').select('*').eq('id', id).maybeSingle();
      if (!log) throw new Error('Error log not found.');
      return {
        title: String(log.message).slice(0, 80),
        subtitle: String(log.level),
        fields: [
          { key: 'level', label: 'Level', type: 'status', value: log.level },
          { key: 'message', label: 'Message', value: log.message },
          { key: 'stack', label: 'Stack', value: log.stack },
          { key: 'context', label: 'Context', type: 'json', value: log.context },
          { key: 'resolved_at', label: 'Resolved', type: 'datetime', value: log.resolved_at },
          { key: 'created_at', label: 'Created', type: 'datetime', value: log.created_at },
        ],
        sections: [],
        actions: log.resolved_at ? [{ key: 'reopen_error', label: 'Mark unresolved' }] : [{ key: 'resolve', label: 'Mark resolved' }],
      };
    }

    case 'audit': {
      const { data: log } = await db.from('audit_logs').select('*').eq('id', id).maybeSingle();
      if (!log) throw new Error('Audit entry not found.');
      return {
        title: String(log.action),
        subtitle: String(log.created_at),
        fields: [
          { key: 'actor_email', label: 'Actor', type: 'email', value: log.actor_email },
          { key: 'action', label: 'Action', value: log.action },
          { key: 'entity_type', label: 'Entity type', value: log.entity_type },
          { key: 'entity_id', label: 'Entity ID', value: log.entity_id },
          { key: 'ip_hash', label: 'IP hash', value: log.ip_hash },
          { key: 'user_agent', label: 'User agent', value: log.user_agent },
          { key: 'metadata', label: 'Metadata', type: 'json', value: log.metadata },
          { key: 'created_at', label: 'When', type: 'datetime', value: log.created_at },
        ],
        sections: [],
      };
    }

    case 'webhooks': {
      const { data: event } = await db.from('webhook_events').select('*').eq('id', id).maybeSingle();
      if (!event) throw new Error('Webhook event not found.');
      return {
        title: String(event.event_id),
        subtitle: String(event.provider),
        fields: [
          { key: 'signature_valid', label: 'Signature valid', type: 'bool', value: event.signature_valid },
          { key: 'processed_at', label: 'Processed', type: 'datetime', value: event.processed_at },
          { key: 'error', label: 'Error', value: event.error },
          { key: 'payload', label: 'Payload', type: 'json', value: event.payload },
          { key: 'received_at', label: 'Received', type: 'datetime', value: event.received_at },
        ],
        sections: [],
        actions: event.processed_at ? [] : [{ key: 'mark_processed', label: 'Mark processed' }],
      };
    }

    default:
      throw new Error(`Detail view is not available for ${module}.`);
  }
}

export function moduleReadPermission(module: string) {
  return ADMIN_MODULES[module]?.read;
}
