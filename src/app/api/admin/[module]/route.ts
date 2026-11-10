import { withApi, ok, requirePlatformAdmin, ApiError, writeAudit } from '@/lib/http';
import { countByValue } from '@/lib/data/app';
import { CAMPAIGN_STATUSES, JOB_STATUSES, MAILBOX_STATUSES } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/** Upper bound for a table style admin module. */
const TABLE_LIMIT = 200;

const PERMISSIONS: Record<string, string> = {
  users: 'users.view',
  organizations: 'orgs.view',
  subscriptions: 'billing.view',
  plans: 'billing.view',
  campaigns: 'campaigns.view',
  mailboxes: 'mailboxes.view',
  'email-activity': 'campaigns.view',
  'ai-usage': 'ai.view',
  'api-usage': 'users.view',
  tickets: 'support.manage',
  announcements: 'announcements.manage',
  'feature-flags': 'flags.manage',
  'system-health': 'settings.manage',
  jobs: 'jobs.manage',
  errors: 'settings.manage',
  audit: 'audit.view',
  roles: 'users.view',
  webhooks: 'settings.manage',
  abuse: 'abuse.view',
  integrations: 'settings.manage',
  settings: 'settings.manage',
};

export async function GET(_request: Request, { params }: { params: Promise<{ module: string }> }) {
  return withApi({ route: '/api/admin/[module]', method: 'GET' }, async () => {
    const { module } = await params;
    const permission = PERMISSIONS[module];
    if (!permission) throw new ApiError(404, 'Unknown admin module.');
    await requirePlatformAdmin(permission);
    const db = createServiceClient();

    switch (module) {
      case 'users': {
        const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (error) throw new ApiError(500, 'Could not load users.');
        const ids = data.users.map((u) => u.id);
        const { data: profiles } = ids.length ? await db.from('profiles').select('id, full_name, onboarding_completed').in('id', ids) : { data: [] };
        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
        return ok(
          data.users.map((user) => ({
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            confirmed: Boolean(user.email_confirmed_at),
            banned_until: (user as unknown as { banned_until?: string }).banned_until ?? null,
            profile: profileMap.get(user.id) ?? null,
          })),
        );
      }
      case 'organizations': {
        const { data, error } = await db.from('organizations').select('*, plan:subscription_plans(name)').order('created_at', { ascending: false }).limit(TABLE_LIMIT);
        if (error) throw new ApiError(500, 'Could not load organizations.');
        return ok(data ?? []);
      }
      case 'subscriptions': {
        const { data, error } = await db.from('subscriptions').select('*, organization:organizations(name, slug)').order('created_at', { ascending: false }).limit(TABLE_LIMIT);
        if (error) throw new ApiError(500, 'Could not load subscriptions.');
        return ok(data ?? []);
      }
      case 'plans': {
        const { data } = await db.from('subscription_plans').select('*').order('sort_order');
        return ok(data ?? []);
      }
      case 'campaigns': {
        const { data } = await db.from('campaigns').select('id, name, status, total_leads, emails_sent, replies, bounces, created_at, organization:organizations(name)').order('created_at', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'mailboxes': {
        const { data } = await db.from('mailboxes').select('id, email_address, provider, status, daily_limit, sent_today, reputation, last_sync_at, last_error, created_at, organization:organizations(name)').order('created_at', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'email-activity': {
        const { data } = await db.from('email_events').select('*').order('occurred_at', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'ai-usage': {
        const { data } = await db.from('ai_usage_records').select('*, organization:organizations(name)').order('created_at', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'api-usage': {
        const { data } = await db.from('rate_limits').select('*').order('window_start', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'tickets': {
        const { data } = await db.from('support_tickets').select('*, organization:organizations(name)').order('created_at', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'announcements': {
        const { data } = await db.from('announcements').select('*').order('created_at', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'feature-flags': {
        const { data } = await db.from('feature_flags').select('*').order('key');
        return ok(data ?? []);
      }
      case 'system-health': {
        // Exact per status counts with head requests: no row payloads are
        // transferred for the platform wide health breakdown.
        const [jobs, mailboxes, campaigns, errors] = await Promise.all([
          countByValue(db, 'background_jobs', 'status', JOB_STATUSES),
          countByValue(db, 'mailboxes', 'status', MAILBOX_STATUSES),
          countByValue(db, 'campaigns', 'status', CAMPAIGN_STATUSES),
          db.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
        ]);
        return ok({
          jobs,
          mailboxes,
          campaigns,
          errorsLast24h: errors.count ?? 0,
          integrations: {
            supabase: true,
            ai: Boolean(process.env.GROQ_API_KEY),
            gmail: Boolean(process.env.GOOGLE_CLIENT_ID),
            microsoft: Boolean(process.env.MICROSOFT_CLIENT_ID),
            cron: Boolean(process.env.CRON_SECRET),
            billing: Boolean(process.env.BILLING_PROVIDER),
          },
        });
      }
      case 'jobs': {
        const { data } = await db.from('background_jobs').select('*').order('created_at', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'errors': {
        const { data } = await db.from('error_logs').select('id, level, message, context, created_at').order('created_at', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'audit': {
        const { data } = await db.from('audit_logs').select('id, action, entity_type, entity_id, actor_email, ip_hash, metadata, created_at, organization:organizations(name)').order('created_at', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'roles': {
        const [roles, admins] = await Promise.all([
          db.from('admin_roles').select('*').order('key'),
          db.from('platform_admins').select('user_id, role, granted_at').limit(TABLE_LIMIT),
        ]);
        return ok({ roles: roles.data ?? [], admins: admins.data ?? [] });
      }
      case 'webhooks': {
        const { data } = await db.from('webhook_events').select('id, provider, event_id, signature_valid, processed_at, error, received_at').order('received_at', { ascending: false }).limit(TABLE_LIMIT);
        return ok(data ?? []);
      }
      case 'abuse': {
        const [complaints, bounces] = await Promise.all([
          db.from('email_complaints').select('*').order('occurred_at', { ascending: false }).limit(TABLE_LIMIT),
          db.from('email_bounces').select('*').order('occurred_at', { ascending: false }).limit(TABLE_LIMIT),
        ]);
        return ok({ complaints: complaints.data ?? [], bounces: bounces.data ?? [] });
      }
      case 'integrations': {
        return ok([
          { key: 'supabase', label: 'Supabase', configured: true, detail: 'Database and authentication' },
          { key: 'groq', label: 'Groq AI', configured: Boolean(process.env.GROQ_API_KEY), detail: 'Email and column analysis' },
          { key: 'gmail', label: 'Gmail OAuth', configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), detail: 'Send and read via Gmail API' },
          { key: 'microsoft', label: 'Microsoft Graph', configured: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET), detail: 'Send and read via Outlook' },
          { key: 'smtp', label: 'SMTP / IMAP', configured: true, detail: 'User-supplied mailbox credentials' },
          { key: 'cron', label: 'Background worker', configured: Boolean(process.env.CRON_SECRET), detail: 'Vercel cron invokes /api/cron/worker' },
          { key: 'billing', label: 'Billing provider', configured: Boolean(process.env.BILLING_PROVIDER), detail: 'Checkout and subscription sync' },
        ]);
      }
      case 'settings': {
        const { data } = await db.from('system_settings').select('*').order('key');
        return ok(data ?? []);
      }
      default:
        throw new ApiError(404, 'Unknown admin module.');
    }
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ module: string }> }) {
  return withApi({ route: '/api/admin/[module]', method: 'PATCH' }, async () => {
    const { module } = await params;
    const permission = PERMISSIONS[module];
    if (!permission) throw new ApiError(404, 'Unknown admin module.');
    const { session } = await requirePlatformAdmin(permission);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = createServiceClient();

    if (module === 'feature-flags') {
      const key = String(body.key ?? '');
      if (!key) throw new ApiError(422, 'Missing feature flag key.');
      const { data, error } = await db.from('feature_flags').update({ enabled: Boolean(body.enabled), updated_at: new Date().toISOString() }).eq('key', key).select('*').maybeSingle();
      if (error || !data) throw new ApiError(404, 'Feature flag not found.');
      await writeAudit({ actorId: session.userId, actorEmail: session.email, action: 'admin.feature_flag.updated', entityType: 'feature_flag', entityId: key, request, metadata: { enabled: Boolean(body.enabled) } });
      return ok(data);
    }

    if (module === 'settings') {
      const key = String(body.key ?? '');
      if (!key) throw new ApiError(422, 'Missing setting key.');
      const { data, error } = await db.from('system_settings').upsert({ key, value: body.value ?? {}, is_public: Boolean(body.is_public), updated_at: new Date().toISOString() }, { onConflict: 'key' }).select('*').single();
      if (error || !data) throw new ApiError(500, 'Could not update the setting.');
      await writeAudit({ actorId: session.userId, actorEmail: session.email, action: 'admin.setting.updated', entityType: 'system_setting', entityId: key, request });
      return ok(data);
    }

    throw new ApiError(405, 'This admin module is read-only in the console.');
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ module: string }> }) {
  return withApi({ route: '/api/admin/[module]', method: 'POST' }, async () => {
    const { module } = await params;
    const permission = PERMISSIONS[module];
    if (!permission) throw new ApiError(404, 'Unknown admin module.');
    const { session } = await requirePlatformAdmin(permission);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = createServiceClient();

    if (module === 'announcements') {
      const title = String(body.title ?? '').trim();
      const bodyText = String(body.body ?? '').trim();
      if (title.length < 2 || bodyText.length < 2) throw new ApiError(422, 'Provide a title and announcement body.');
      const { data, error } = await db.from('announcements').insert({ title, body: bodyText, variant: ['info', 'warning', 'success'].includes(String(body.variant)) ? body.variant : 'info', is_active: true, created_by: session.userId }).select('*').single();
      if (error || !data) throw new ApiError(500, 'Could not publish the announcement.');
      return ok(data, { status: 201 });
    }

    throw new ApiError(405, 'This admin module does not support creating records here.');
  });
}
