-- ============================================================
-- ColdFox — 0012 admin control center
-- Adds the role catalog, safe admin-only columns and the aggregate
-- functions the owner console needs. Additive and reversible.
-- ============================================================

-- ── platform admin roles ────────────────────────────────────
alter table public.platform_admins
  drop constraint if exists platform_admins_role_check;
alter table public.platform_admins
  add constraint platform_admins_role_check
  check (role in (
    'super_admin', 'admin', 'support_admin', 'finance_admin',
    'campaign_manager', 'read_only', 'support', 'billing'
  ));

insert into public.admin_roles (key, name, permissions) values
  ('super_admin', 'Owner / Super admin', array['*']),
  ('admin', 'Admin', array[
    'analytics.view','users.view','users.manage','users.delete',
    'orgs.view','orgs.manage','orgs.delete','leads.view','leads.manage',
    'campaigns.view','campaigns.manage','mailboxes.view','mailboxes.manage',
    'billing.view','billing.manage','plans.manage','ai.view','ai.manage',
    'support.manage','announcements.manage','flags.manage','settings.manage',
    'jobs.manage','audit.view','abuse.view','integrations.view'
  ]),
  ('support_admin', 'Support admin', array[
    'analytics.view','users.view','orgs.view','leads.view','campaigns.view',
    'mailboxes.view','support.manage','audit.view','abuse.view','announcements.manage'
  ]),
  ('finance_admin', 'Finance admin', array[
    'analytics.view','users.view','orgs.view','billing.view','billing.manage',
    'plans.manage','audit.view'
  ]),
  ('campaign_manager', 'Campaign manager', array[
    'analytics.view','leads.view','leads.manage','campaigns.view','campaigns.manage',
    'mailboxes.view','mailboxes.manage'
  ]),
  ('read_only', 'Read-only admin', array[
    'analytics.view','users.view','orgs.view','leads.view','campaigns.view',
    'mailboxes.view','billing.view','ai.view','support.manage','audit.view',
    'abuse.view','integrations.view'
  ])
on conflict (key) do update set
  name = excluded.name,
  permissions = excluded.permissions;

insert into public.admin_permissions (key, description) values
  ('analytics.view','View platform analytics and trends'),
  ('users.delete','Delete platform user accounts'),
  ('orgs.delete','Soft delete organizations'),
  ('leads.view','View leads across organizations'),
  ('leads.manage','Edit, restore and delete leads'),
  ('campaigns.manage','Pause, resume, edit and archive campaigns'),
  ('mailboxes.manage','Enable, disable and disconnect mailboxes'),
  ('plans.manage','Create and edit subscription plans'),
  ('ai.manage','Configure AI models and usage limits'),
  ('integrations.view','View integration configuration status'),
  ('admins.manage','Create and manage administrator accounts')
on conflict (key) do update set description = excluded.description;

-- ── additive admin columns ──────────────────────────────────
alter table public.organizations add column if not exists suspended_reason text;
alter table public.organizations add column if not exists admin_notes text;
alter table public.campaigns add column if not exists archived_at timestamptz;
alter table public.campaigns add column if not exists admin_notes text;
alter table public.mailboxes add column if not exists admin_notes text;
alter table public.subscriptions add column if not exists trial_ends_at timestamptz;
alter table public.error_logs add column if not exists resolved_at timestamptz;
alter table public.announcements add column if not exists updated_at timestamptz not null default now();

create index if not exists leads_admin_status_idx on public.leads(status, created_at desc);
create index if not exists campaigns_archived_idx on public.campaigns(archived_at) where archived_at is null;
create index if not exists audit_action_idx on public.audit_logs(action, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status, created_at desc);

-- ── aggregate helpers (service role only) ───────────────────
create or replace function public.admin_growth_series(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  with span as (
    select generate_series(
      (current_date - (greatest(p_days, 1) - 1)),
      current_date,
      interval '1 day'
    )::date as day
  ),
  signups as (
    select created_at::date as day, count(*)::int as count
    from auth.users
    where created_at >= current_date - (greatest(p_days, 1) - 1)
    group by 1
  ),
  organizations as (
    select created_at::date as day, count(*)::int as count
    from public.organizations
    where created_at >= current_date - (greatest(p_days, 1) - 1)
    group by 1
  ),
  emails as (
    select occurred_at::date as day, count(*)::int as count
    from public.email_events
    where occurred_at >= current_date - (greatest(p_days, 1) - 1)
    group by 1
  ),
  campaigns as (
    select created_at::date as day, count(*)::int as count
    from public.campaigns
    where created_at >= current_date - (greatest(p_days, 1) - 1)
    group by 1
  ),
  revenue as (
    select paid_at::date as day, coalesce(sum(amount_cents), 0)::bigint as cents
    from public.invoices
    where status = 'paid' and paid_at is not null
      and paid_at >= current_date - (greatest(p_days, 1) - 1)
    group by 1
  )
  select jsonb_build_object(
    'days', p_days,
    'signups', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'count', coalesce(x.count, 0)) order by s.day) from span s left join signups x on x.day = s.day), '[]'::jsonb),
    'organizations', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'count', coalesce(x.count, 0)) order by s.day) from span s left join organizations x on x.day = s.day), '[]'::jsonb),
    'emails', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'count', coalesce(x.count, 0)) order by s.day) from span s left join emails x on x.day = s.day), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'count', coalesce(x.count, 0)) order by s.day) from span s left join campaigns x on x.day = s.day), '[]'::jsonb),
    'revenue', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'cents', coalesce(x.cents, 0)) order by s.day) from span s left join revenue x on x.day = s.day), '[]'::jsonb)
  );
$$;

create or replace function public.admin_ai_usage_summary(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with window_rows as (
    select kind, tokens, cost_micros
    from public.ai_usage_records
    where created_at >= now() - make_interval(days => greatest(p_days, 1))
  ),
  by_kind as (
    select kind, count(*)::int as requests, coalesce(sum(tokens), 0)::bigint as tokens,
           coalesce(sum(cost_micros), 0)::bigint as cost_micros
    from window_rows
    group by kind
  )
  select jsonb_build_object(
    'requests', coalesce((select count(*) from window_rows), 0),
    'tokens', coalesce((select sum(tokens) from window_rows), 0),
    'costMicros', coalesce((select sum(cost_micros) from window_rows), 0),
    'byKind', coalesce((select jsonb_object_agg(kind, jsonb_build_object('requests', requests, 'tokens', tokens, 'costMicros', cost_micros)) from by_kind), '{}'::jsonb)
  );
$$;

create or replace function public.admin_billing_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with plan_counts as (
    select o.plan_key as key, count(*)::int as count
    from public.organizations o
    where o.deleted_at is null
    group by o.plan_key
  ),
  status_counts as (
    select s.status as key, count(*)::int as count
    from public.subscriptions s
    group by s.status
  )
  select jsonb_build_object(
    'mrr', coalesce((
      select sum(p.price_monthly)
      from public.subscriptions s
      join public.subscription_plans p on p.key = s.plan_key
      where s.status in ('active', 'trialing')
    ), 0),
    'planCounts', coalesce((select jsonb_object_agg(key, count) from plan_counts), '{}'::jsonb),
    'statusCounts', coalesce((select jsonb_object_agg(key, count) from status_counts), '{}'::jsonb),
    'activeSubscriptions', coalesce((select count(*) from public.subscriptions where status = 'active'), 0),
    'trialing', coalesce((select count(*) from public.subscriptions where status = 'trialing'), 0),
    'pastDue', coalesce((select count(*) from public.subscriptions where status = 'past_due'), 0),
    'failedPayments', coalesce((select count(*) from public.invoices where status = 'uncollectible'), 0),
    'openInvoices', coalesce((select count(*) from public.invoices where status in ('open', 'draft')), 0)
  );
$$;

revoke all on function public.admin_growth_series(integer) from public, anon, authenticated;
revoke all on function public.admin_ai_usage_summary(integer) from public, anon, authenticated;
revoke all on function public.admin_billing_summary() from public, anon, authenticated;
grant execute on function public.admin_growth_series(integer) to service_role;
grant execute on function public.admin_ai_usage_summary(integer) to service_role;
grant execute on function public.admin_billing_summary() to service_role;
