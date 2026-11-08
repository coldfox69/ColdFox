-- ============================================================
-- ColdFox — 0001 core: extensions, identity, organizations, billing
-- ============================================================
create extension if not exists pgcrypto;

-- ── shared updated_at trigger ───────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  job_title text,
  department text,
  timezone text not null default 'UTC',
  avatar_url text,
  phone text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── subscription plans (global catalog) ─────────────────────
create table if not exists public.subscription_plans (
  key text primary key,
  name text not null,
  description text,
  price_monthly integer not null default 0,
  currency text not null default 'USD',
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (key, name, description, price_monthly, limits, features, sort_order)
values
  ('free', 'Free', 'Explore ColdFox with a single mailbox.', 0,
    '{"leads":100,"campaigns":2,"mailboxes":1,"ai_credits":20,"team_members":1,"emails_per_month":500,"automations":false}',
    '["1 mailbox","100 leads","500 emails/mo","Basic templates","Community support"]', 1),
  ('starter', 'Starter', 'For solo founders starting outbound.', 49,
    '{"leads":2500,"campaigns":10,"mailboxes":3,"ai_credits":100,"team_members":2,"emails_per_month":10000,"automations":true}',
    '["3 mailboxes","2,500 leads","10,000 emails/mo","AI email writer","Unified inbox","Email support"]', 2),
  ('growth', 'Growth', 'For small teams running consistent outreach.', 89,
    '{"leads":10000,"campaigns":30,"mailboxes":6,"ai_credits":300,"team_members":5,"emails_per_month":30000,"automations":true}',
    '["6 mailboxes","10,000 leads","30,000 emails/mo","AI email optimizer","Automations","Analytics"]', 3),
  ('pro', 'Pro', 'For agencies and sales teams scaling carefully.', 199,
    '{"leads":50000,"campaigns":100,"mailboxes":15,"ai_credits":1000,"team_members":15,"emails_per_month":100000,"automations":true}',
    '["15 mailboxes","50,000 leads","100,000 emails/mo","Advanced AI","Priority support","Deliverability center"]', 4),
  ('agency', 'Agency', 'Multi-workspace outreach with advanced controls.', 399,
    '{"leads":-1,"campaigns":-1,"mailboxes":-1,"ai_credits":-1,"team_members":-1,"emails_per_month":-1,"automations":true}',
    '["Unlimited leads","Unlimited mailboxes","Custom AI settings","Dedicated support","SLA","SSO/SAML (roadmap)"]', 5)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, price_monthly = excluded.price_monthly,
  limits = excluded.limits, features = excluded.features, sort_order = excluded.sort_order;

-- ── organizations ───────────────────────────────────────────
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique,
  website text,
  industry text,
  company_size text,
  owner_id uuid not null references auth.users(id) on delete restrict,
  plan_key text not null default 'free' references public.subscription_plans(key),
  timezone text not null default 'UTC',
  settings jsonb not null default '{}'::jsonb,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists organizations_owner_idx on public.organizations(owner_id);

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- ── roles catalog ───────────────────────────────────────────
create table if not exists public.roles (
  key text primary key,
  name text not null,
  description text,
  permissions text[] not null default '{}',
  is_system boolean not null default true
);

insert into public.roles (key, name, description, permissions) values
  ('owner', 'Owner', 'Full control of the workspace, billing and members.', array['org.manage','billing.manage','members.manage','campaigns.manage','leads.manage','mailboxes.manage','templates.manage','ai.use','analytics.view','admin.view']),
  ('admin', 'Admin', 'Manage members and all outreach resources.', array['members.manage','campaigns.manage','leads.manage','mailboxes.manage','templates.manage','ai.use','analytics.view']),
  ('member', 'Member', 'Create and manage own outreach resources.', array['campaigns.manage','leads.manage','templates.manage','ai.use','analytics.view']),
  ('viewer', 'Viewer', 'Read-only access to workspace data.', array['analytics.view'])
on conflict (key) do nothing;

create table if not exists public.permissions (
  key text primary key,
  description text
);

insert into public.permissions (key, description) values
  ('org.manage', 'Edit organization settings'),
  ('billing.manage', 'Manage subscription and billing'),
  ('members.manage', 'Invite and remove members'),
  ('campaigns.manage', 'Create, edit and launch campaigns'),
  ('leads.manage', 'Create, import and delete leads'),
  ('mailboxes.manage', 'Connect and remove mailboxes'),
  ('templates.manage', 'Create and edit email templates'),
  ('ai.use', 'Use AI features'),
  ('analytics.view', 'View analytics'),
  ('admin.view', 'Access platform administration')
on conflict (key) do nothing;

create table if not exists public.role_permissions (
  role_key text not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

insert into public.role_permissions (role_key, permission_key)
select r.key, p.key from public.roles r cross join public.permissions p
where p.key = any(r.permissions)
on conflict do nothing;

-- ── organization members ────────────────────────────────────
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' references public.roles(key),
  status text not null default 'active' check (status in ('active','suspended','removed')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists org_members_user_idx on public.organization_members(user_id, status);
create index if not exists org_members_org_idx on public.organization_members(organization_id, status);

-- ── invitations ─────────────────────────────────────────────
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  role text not null default 'member' references public.roles(key),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (organization_id, email_normalized)
);

-- ── onboarding ──────────────────────────────────────────────
create table if not exists public.onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  job_title text,
  department text,
  company_name text,
  website text,
  industry text,
  company_size text,
  intended_usage text,
  expected_sending_volume text,
  completed_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ── billing & usage ─────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_key text not null references public.subscription_plans(key),
  status text not null default 'active' check (status in ('trialing','active','past_due','canceled','paused')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '1 month'),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  provider text not null,
  external_id text not null,
  billing_email text,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text,
  provider_invoice_id text,
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  status text not null default 'open' check (status in ('draft','open','paid','void','uncollectible')),
  hosted_url text,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_limits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,
  limit_value integer not null,
  period text not null default 'monthly' check (period in ('daily','monthly','total')),
  created_at timestamptz not null default now(),
  unique (organization_id, metric, period)
);

create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,
  quantity integer not null default 1,
  recorded_at timestamptz not null default now(),
  period_start date not null default date_trunc('month', now())::date,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists usage_records_org_metric_idx on public.usage_records(organization_id, metric, period_start);

-- ── tenant helpers (security definer avoids recursive RLS) ──
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.deleted_at is null
      and o.is_suspended = false
  );
$$;

create or replace function public.has_org_role(p_org uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(p_roles)
      and o.deleted_at is null
      and o.is_suspended = false
  );
$$;

create or replace function public.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members them on them.organization_id = me.organization_id
    where me.user_id = auth.uid() and me.status = 'active'
      and them.user_id = p_user and them.status = 'active'
  );
$$;

create or replace function public.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.organization_members
  where user_id = auth.uid() and status = 'active';
$$;

-- ── plan limit helper ───────────────────────────────────────
create or replace function public.plan_limit(p_org uuid, p_metric text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (sp.limits->>p_metric)::int
     from public.organizations o
     join public.subscription_plans sp on sp.key = o.plan_key
     where o.id = p_org),
    -1
  );
$$;

create or replace function public.org_usage(p_org uuid, p_metric text, p_period_start date default date_trunc('month', now())::date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(quantity), 0)::int from public.usage_records
  where organization_id = p_org and metric = p_metric and period_start = p_period_start;
$$;

create or replace function public.record_usage(p_org uuid, p_metric text, p_quantity integer default 1, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_org) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  insert into public.usage_records (organization_id, metric, quantity, metadata)
  values (p_org, p_metric, greatest(p_quantity, 0), p_metadata);
end;
$$;

create or replace function public.check_org_limit(p_org uuid, p_metric text, p_increment integer default 1)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
begin
  v_limit := public.plan_limit(p_org, p_metric);
  if v_limit = -1 then return true; end if;
  v_used := public.org_usage(p_org, p_metric);
  return (v_used + p_increment) <= v_limit;
end;
$$;

-- ── organization bootstrap (called from trusted server) ─────
create or replace function public.bootstrap_organization(
  p_company_name text,
  p_website text default null,
  p_industry text default null,
  p_company_size text default null,
  p_full_name text default null,
  p_job_title text default null,
  p_department text default null,
  p_intended_usage text default null,
  p_expected_volume text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_slug text;
  v_existing uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_company_name is null or char_length(btrim(p_company_name)) < 2 then
    raise exception 'invalid_company_name' using errcode = '22023';
  end if;

  select m.organization_id into v_existing
  from public.organization_members m
  where m.user_id = v_user and m.status = 'active'
  order by m.created_at asc limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  v_slug := regexp_replace(lower(btrim(p_company_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'workspace'; end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations (name, slug, website, industry, company_size, owner_id)
  values (btrim(p_company_name), v_slug, p_website, p_industry, p_company_size, v_user)
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role, status, invited_by)
  values (v_org, v_user, 'owner', 'active', v_user)
  on conflict (organization_id, user_id) do update set role = 'owner', status = 'active';

  insert into public.subscriptions (organization_id, plan_key, status)
  values (v_org, 'free', 'active')
  on conflict (organization_id) do nothing;

  insert into public.onboarding_responses
    (organization_id, user_id, full_name, job_title, department, company_name, website, industry, company_size, intended_usage, expected_sending_volume)
  values
    (v_org, v_user, p_full_name, p_job_title, p_department, btrim(p_company_name), p_website, p_industry, p_company_size, p_intended_usage, p_expected_volume)
  on conflict (organization_id, user_id) do update set
    full_name = excluded.full_name, job_title = excluded.job_title, department = excluded.department,
    company_name = excluded.company_name, website = excluded.website, industry = excluded.industry,
    company_size = excluded.company_size, intended_usage = excluded.intended_usage,
    expected_sending_volume = excluded.expected_sending_volume, completed_at = now();

  update public.profiles
  set full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
      job_title = coalesce(p_job_title, job_title),
      department = coalesce(p_department, department),
      onboarding_completed = true
  where id = v_user;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_org, v_user, 'organization.created', 'organization', v_org, jsonb_build_object('name', p_company_name));

  return v_org;
end;
$$;

-- ── admin bootstrap (explicit, never first-user) ────────────
create or replace function public.grant_platform_admin(p_email text, p_role text default 'admin')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  insert into public.platform_admins (user_id, role, notes)
  values (v_user, p_role, 'granted via grant_platform_admin')
  on conflict (user_id) do update set role = excluded.role;
  return v_user;
end;
$$;
