-- ============================================================
-- ColdFox — 0002 CRM, templates, campaigns
-- ============================================================

-- ── companies ───────────────────────────────────────────────
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  domain text,
  website text,
  industry text,
  size text,
  location text,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists companies_org_idx on public.companies(organization_id, created_at desc);
create unique index if not exists companies_org_domain_unique on public.companies(organization_id, lower(domain)) where domain is not null;

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

-- ── leads ───────────────────────────────────────────────────
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  first_name text,
  last_name text,
  email text not null check (position('@' in email) > 1),
  email_normalized text generated always as (lower(btrim(email))) stored,
  job_title text,
  phone text,
  linkedin_url text,
  website text,
  city text,
  country text,
  industry text,
  company_name text,
  status text not null default 'new' check (status in ('new','contacted','replied','interested','not_interested','bounced','unsubscribed','archived')),
  source text not null default 'manual',
  owner_id uuid references auth.users(id) on delete set null,
  custom_data jsonb not null default '{}'::jsonb,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists leads_org_email_unique on public.leads(organization_id, email_normalized) where deleted_at is null;
create index if not exists leads_org_created_idx on public.leads(organization_id, created_at desc) where deleted_at is null;
create index if not exists leads_org_status_idx on public.leads(organization_id, status) where deleted_at is null;
create index if not exists leads_org_owner_idx on public.leads(organization_id, owner_id) where deleted_at is null;
create index if not exists leads_email_idx on public.leads(email_normalized);

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- ── tags ────────────────────────────────────────────────────
create table if not exists public.lead_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text default '#3b82f6',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.lead_tag_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.lead_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);
create index if not exists lead_tag_assign_org_idx on public.lead_tag_assignments(organization_id, tag_id);

-- ── custom fields ───────────────────────────────────────────
create table if not exists public.lead_custom_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text','number','date','url','boolean','select')),
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.lead_custom_values (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  field_id uuid not null references public.lead_custom_fields(id) on delete cascade,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (lead_id, field_id)
);

-- ── notes & activity ────────────────────────────────────────
create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lead_notes_lead_idx on public.lead_notes(lead_id, created_at desc);

drop trigger if exists lead_notes_updated_at on public.lead_notes;
create trigger lead_notes_updated_at before update on public.lead_notes
  for each row execute function public.set_updated_at();

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists lead_activity_lead_idx on public.lead_activities(lead_id, occurred_at desc);

-- ── email templates ─────────────────────────────────────────
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  subject text not null default '',
  body_html text not null default '',
  body_text text not null default '',
  category text not null default 'General',
  tags text[] not null default '{}',
  is_shared boolean not null default false,
  current_version integer not null default 1,
  usage_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists templates_org_idx on public.email_templates(organization_id, updated_at desc) where archived_at is null;

drop trigger if exists templates_updated_at on public.email_templates;
create trigger templates_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();

create table if not exists public.email_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.email_templates(id) on delete cascade,
  version integer not null,
  subject text not null,
  body_html text not null,
  body_text text not null,
  change_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table if not exists public.email_template_variables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.email_templates(id) on delete cascade,
  name text not null,
  fallback text,
  required boolean not null default false,
  unique (template_id, name)
);

-- ── campaigns ───────────────────────────────────────────────
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  status text not null default 'draft' check (status in ('draft','scheduled','active','paused','completed','cancelled')),
  mailbox_id uuid,
  template_id uuid references public.email_templates(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  timezone text not null default 'UTC',
  daily_limit integer not null default 100 check (daily_limit between 1 and 2000),
  launch_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_leads integer not null default 0,
  emails_sent integer not null default 0,
  replies integer not null default 0,
  bounces integer not null default 0,
  unsubscribes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_org_idx on public.campaigns(organization_id, created_at desc);
create index if not exists campaigns_status_idx on public.campaigns(organization_id, status);

drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

create table if not exists public.campaign_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  track_opens boolean not null default false,
  track_clicks boolean not null default false,
  stop_on_reply boolean not null default true,
  stop_on_bounce boolean not null default true,
  max_followups integer not null default 2 check (max_followups between 0 and 10),
  send_window_start time not null default '09:00',
  send_window_end time not null default '17:00',
  weekdays integer[] not null default '{1,2,3,4,5}',
  min_interval_minutes integer not null default 2,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  template_id uuid not null references public.email_templates(id) on delete cascade,
  variant_label text not null default 'A',
  weight integer not null default 100,
  created_at timestamptz not null default now(),
  unique (campaign_id, template_id)
);

create table if not exists public.campaign_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  step_order integer not null default 1 check (step_order >= 1),
  step_type text not null default 'initial' check (step_type in ('initial','follow_up','manual')),
  delay_days integer not null default 0 check (delay_days between 0 and 60),
  delay_hours integer not null default 0 check (delay_hours between 0 and 23),
  template_id uuid references public.email_templates(id) on delete set null,
  subject_override text,
  body_override text,
  condition jsonb not null default '{"stop_on_reply":true}'::jsonb,
  created_at timestamptz not null default now(),
  unique (campaign_id, step_order)
);

create table if not exists public.campaign_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','active','sent','replied','bounced','unsubscribed','skipped','completed','error')),
  current_step integer not null default 0,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  error text,
  added_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);
create index if not exists campaign_leads_due_idx on public.campaign_leads(campaign_id, status, next_send_at);

create table if not exists public.campaign_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  send_at timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'pending' check (status in ('pending','processing','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists campaign_schedules_due_idx on public.campaign_schedules(status, send_at);

create table if not exists public.campaign_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_lead_id uuid not null references public.campaign_leads(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  step_id uuid references public.campaign_steps(id) on delete set null,
  step_order integer not null default 1,
  status text not null default 'queued' check (status in ('queued','processing','accepted','delivered','failed','skipped','cancelled','replied','bounced','unsubscribed')),
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  attempts integer not null default 0,
  provider_message_id text,
  error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists campaign_exec_due_idx on public.campaign_executions(status, scheduled_for) where status = 'queued';
create index if not exists campaign_exec_campaign_idx on public.campaign_executions(campaign_id, created_at desc);
create index if not exists campaign_exec_lead_idx on public.campaign_executions(lead_id, created_at desc);

create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  execution_id uuid references public.campaign_executions(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists campaign_events_org_idx on public.campaign_events(organization_id, occurred_at desc);
create index if not exists campaign_events_campaign_idx on public.campaign_events(campaign_id, event_type);
