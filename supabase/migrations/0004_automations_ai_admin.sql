-- ============================================================
-- ColdFox — 0004 automations, AI, support, administration, jobs
-- ============================================================

-- ── automations ─────────────────────────────────────────────
create table if not exists public.automation_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  trigger_type text not null default 'campaign_reply' check (trigger_type in ('campaign_reply','lead_created','manual','schedule')),
  campaign_id uuid references public.campaigns(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists workflows_updated_at on public.automation_workflows;
create trigger workflows_updated_at before update on public.automation_workflows
  for each row execute function public.set_updated_at();

create table if not exists public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.automation_workflows(id) on delete cascade,
  step_order integer not null default 1,
  step_type text not null check (step_type in ('delay','send_email','condition','stop','manual_review')),
  config jsonb not null default '{}'::jsonb,
  next_step_id uuid references public.automation_steps(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workflow_id, step_order)
);

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.automation_workflows(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  status text not null default 'running' check (status in ('running','waiting','completed','failed','stopped','cancelled')),
  current_step_id uuid references public.automation_steps(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  next_run_at timestamptz,
  error text
);
create index if not exists automation_exec_due_idx on public.automation_executions(status, next_run_at);

create table if not exists public.automation_execution_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null references public.automation_executions(id) on delete cascade,
  step_id uuid references public.automation_steps(id) on delete set null,
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── AI ──────────────────────────────────────────────────────
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('email','rewrite','optimize','subject','column_analysis','support','other')),
  model text,
  prompt_version text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null default 'succeeded' check (status in ('pending','succeeded','failed')),
  error text,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_generations_org_idx on public.ai_generations(organization_id, created_at desc);

create table if not exists public.ai_usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  tokens integer not null default 0,
  cost_micros integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_org_idx on public.ai_usage_records(organization_id, created_at desc);

create table if not exists public.ai_model_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  model text not null default 'llama-3.3-70b-versatile',
  temperature numeric(3,2) not null default 0.6,
  max_tokens integer not null default 1200,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version integer not null default 1,
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (key, version)
);

insert into public.ai_prompt_versions (key, version, content, is_active) values
  ('email_writer', 1,
   'You are a careful B2B outreach writing assistant. Write concise, truthful emails. Never invent facts about the recipient, their company, or a relationship. Use only supplied variables. Avoid exaggerated claims, deceptive subject lines, false urgency, and guaranteed outcomes. Return structured JSON only.',
   true),
  ('email_optimizer', 1,
   'You review outreach emails for clarity, relevance and honesty. Flag unsupported claims, exaggerated promotion, deceptive subject lines, missing sender identity and missing unsubscribe information. Never claim an email is spam-free and never promise inbox placement. Return structured JSON only.',
   true),
  ('column_analysis', 1,
   'You map spreadsheet columns to CRM fields. Do not invent data. Report ambiguity and missing values. Only propose mappings supported by the column name and sample values. Return structured JSON only.',
   true),
  ('support_assistant', 1,
   'You are the ColdFox support assistant. Answer only from the supplied knowledge base. Never invent policies, prices, or actions. If the answer is not in the knowledge base, say so and recommend human support. Return structured JSON only.',
   true)
on conflict (key, version) do nothing;

-- ── support ─────────────────────────────────────────────────
create table if not exists public.support_categories (
  key text primary key,
  name text not null,
  description text
);

insert into public.support_categories (key, name) values
  ('deliverability', 'Deliverability'),
  ('mailbox', 'Mailbox connection'),
  ('billing', 'Billing'),
  ('campaigns', 'Campaigns'),
  ('importing', 'Importing data'),
  ('account', 'Account & access'),
  ('other', 'Other')
on conflict (key) do nothing;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  category_key text references public.support_categories(key),
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open','in_progress','waiting','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists tickets_org_idx on public.support_tickets(organization_id, created_at desc);

drop trigger if exists tickets_updated_at on public.support_tickets;
create trigger tickets_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_type text not null default 'user' check (author_type in ('user','ai','admin')),
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on public.support_messages(ticket_id, created_at);

create table if not exists public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  category text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.kb_articles (slug, title, body, category) values
  ('connect-smtp-mailbox', 'Connect an SMTP mailbox', 'Open Mailboxes, choose "Add mailbox", then SMTP. Enter the host, port (usually 465 for implicit TLS or 587 for STARTTLS), username and app password. ColdFox tests the connection before saving. Use an app password, never your primary account password.', 'mailbox'),
  ('csv-import', 'Import leads from CSV or XLSX', 'Use Leads → Import. Upload a file up to 5 MB and 10,000 rows. ColdFox maps columns to CRM fields, checks email syntax and reports duplicates before anything is saved. Review uncertain mappings before confirming.', 'importing'),
  ('campaign-safety', 'Campaign safety checks', 'Before launch ColdFox validates the mailbox, recipient data, suppression list, unsubscribe status, bounce history and plan limits. Sending is deliberately conservative: respect provider quotas, keep daily volume low, personalise genuinely, and stop follow-ups on reply, unsubscribe or hard bounce.', 'campaigns'),
  ('deliverability-basics', 'Domain authentication basics', 'SPF, DKIM and DMARC are DNS records that help receiving providers verify your mail. A lookup can confirm what is published, but it does not guarantee inbox placement. Publish SPF for your sending provider, enable DKIM signing, and start DMARC with p=none while monitoring.', 'deliverability'),
  ('data-retention', 'What data ColdFox stores', 'ColdFox stores leads, campaign metadata, email bodies needed for the unified inbox, and event logs. Mailbox credentials are encrypted at rest. You can disconnect a mailbox and request workspace deletion at any time.', 'account')
on conflict (slug) do nothing;

-- ── platform administration ─────────────────────────────────
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('super_admin','admin','support','billing')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  notes text
);

create table if not exists public.admin_roles (
  key text primary key,
  name text not null,
  permissions text[] not null default '{}'
);

insert into public.admin_roles (key, name, permissions) values
  ('super_admin', 'Super admin', array['*']),
  ('admin', 'Admin', array['users.view','users.manage','orgs.view','orgs.manage','billing.view','campaigns.view','mailboxes.view','ai.view','support.manage','announcements.manage','flags.manage','settings.manage','jobs.manage','audit.view','abuse.view']),
  ('support', 'Support', array['users.view','orgs.view','campaigns.view','mailboxes.view','support.manage','audit.view']),
  ('billing', 'Billing', array['users.view','orgs.view','billing.view','billing.manage','audit.view'])
on conflict (key) do nothing;

create table if not exists public.admin_permissions (
  key text primary key,
  description text
);

insert into public.admin_permissions (key, description) values
  ('users.view','View platform users'), ('users.manage','Suspend or reactivate users'),
  ('orgs.view','View organizations'), ('orgs.manage','Suspend organizations'),
  ('billing.view','View subscriptions and invoices'), ('billing.manage','Change plans'),
  ('campaigns.view','View campaign monitoring'), ('mailboxes.view','View mailbox monitoring'),
  ('ai.view','View AI usage'), ('support.manage','Manage support tickets'),
  ('announcements.manage','Manage announcements'), ('flags.manage','Manage feature flags'),
  ('settings.manage','Manage system settings'), ('jobs.manage','Manage background jobs'),
  ('audit.view','View audit and security logs'), ('abuse.view','View abuse signals')
on conflict (key) do nothing;

create or replace function public.is_platform_admin(p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid()
      and (p_roles is null or pa.role = any(p_roles))
  );
$$;

create or replace function public.has_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    join public.admin_roles ar on ar.key = pa.role
    where pa.user_id = auth.uid()
      and ('*' = any(ar.permissions) or p_permission = any(ar.permissions))
  );
$$;

-- ── audit & security ────────────────────────────────────────
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_org_idx on public.audit_logs(organization_id, created_at desc);
create index if not exists audit_actor_idx on public.audit_logs(actor_id, created_at desc);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  level text not null default 'error' check (level in ('debug','info','warn','error','fatal')),
  message text not null,
  stack text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists error_logs_idx on public.error_logs(created_at desc);

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else public.rate_limits.count + 1 end,
    window_start = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else public.rate_limits.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

-- ── notifications / announcements / flags / settings ───────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  variant text not null default 'info' check (variant in ('info','warning','success')),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  description text,
  enabled boolean not null default false,
  rollout jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, description, enabled) values
  ('ai_email_writer', 'AI email writer and optimizer', true),
  ('unified_inbox', 'Unified inbox synchronisation', true),
  ('automations', 'Follow-up automation engine', true),
  ('gmail_oauth', 'Gmail OAuth connections', false),
  ('microsoft_oauth', 'Microsoft Graph connections', false),
  ('billing', 'Paid subscriptions and checkout', false)
on conflict (key) do nothing;

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.system_settings (key, value, is_public) values
  ('maintenance_mode', '{"enabled": false}'::jsonb, true),
  ('signups_enabled', '{"enabled": true}'::jsonb, true),
  ('sending_defaults', '{"daily_limit": 100, "min_interval_minutes": 2}'::jsonb, false),
  ('support_email', '{"address": "support@coldfox.app"}'::jsonb, true)
on conflict (key) do nothing;

-- ── background jobs ─────────────────────────────────────────
create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  priority integer not null default 0,
  run_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists jobs_due_idx on public.background_jobs(status, run_at) where status = 'queued';
create index if not exists jobs_org_idx on public.background_jobs(organization_id, created_at desc);

create table if not exists public.background_job_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.background_jobs(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  signature_valid boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

create or replace function public.claim_background_jobs(p_worker text, p_limit integer default 10)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select id from public.background_jobs
    where status = 'queued' and run_at <= now()
    order by priority desc, run_at asc
    limit greatest(1, least(p_limit, 50))
    for update skip locked
  )
  update public.background_jobs j
  set status = 'processing', locked_at = now(), locked_by = p_worker,
      attempts = j.attempts + 1, updated_at = now()
  from candidate c
  where j.id = c.id
  returning j.*;
end;
$$;

create or replace function public.enqueue_job(
  p_job_type text,
  p_payload jsonb default '{}'::jsonb,
  p_organization_id uuid default null,
  p_run_at timestamptz default now(),
  p_priority integer default 0,
  p_idempotency_key text default null,
  p_max_attempts integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.background_jobs (job_type, payload, organization_id, run_at, priority, idempotency_key, max_attempts)
  values (p_job_type, p_payload, p_organization_id, p_run_at, p_priority, p_idempotency_key, p_max_attempts)
  on conflict (idempotency_key) do update set updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.finish_background_job(p_job_id uuid, p_success boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.background_jobs;
begin
  select * into v_job from public.background_jobs where id = p_job_id for update;
  if v_job.id is null then return; end if;

  if p_success then
    update public.background_jobs
    set status = 'completed', completed_at = now(), last_error = null, locked_at = null, locked_by = null, updated_at = now()
    where id = p_job_id;
    insert into public.background_job_logs (job_id, level, message) values (p_job_id, 'info', 'job completed');
  else
    if v_job.attempts >= v_job.max_attempts then
      update public.background_jobs
      set status = 'failed', last_error = p_error, locked_at = null, locked_by = null, updated_at = now()
      where id = p_job_id;
      insert into public.background_job_logs (job_id, level, message) values (p_job_id, 'error', coalesce(p_error, 'job failed'));
    else
      update public.background_jobs
      set status = 'queued', last_error = p_error, locked_at = null, locked_by = null,
          run_at = now() + make_interval(secs => (power(2, v_job.attempts) * 60)::int), updated_at = now()
      where id = p_job_id;
      insert into public.background_job_logs (job_id, level, message) values (p_job_id, 'warn', coalesce(p_error, 'job failed; will retry'));
    end if;
  end if;
end;
$$;

-- ── unsubscribe processing (public, token based) ────────────
create or replace function public.process_unsubscribe(p_token_hash text)
returns table (result text, organization_name text, lead_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.unsubscribe_tokens;
  v_lead public.leads;
  v_org_name text;
begin
  select * into v_token from public.unsubscribe_tokens where token_hash = p_token_hash limit 1;
  if v_token.id is null then
    return query select 'invalid'::text, null::text, null::text;
    return;
  end if;

  select name into v_org_name from public.organizations where id = v_token.organization_id;

  if v_token.expires_at is not null and v_token.expires_at < now() then
    return query select 'expired'::text, v_org_name, null::text;
    return;
  end if;

  if v_token.used_at is not null then
    return query select 'already_unsubscribed'::text, v_org_name, null::text;
    return;
  end if;

  select * into v_lead from public.leads where id = v_token.lead_id;

  insert into public.suppression_entries (organization_id, email, email_normalized, reason_key, source, notes)
  values (v_token.organization_id, coalesce(v_lead.email, 'unknown'), lower(btrim(coalesce(v_lead.email, 'unknown'))), 'unsubscribed', 'unsubscribe_link', 'Public unsubscribe request')
  on conflict (organization_id, email_normalized) do update set reason_key = 'unsubscribed', source = 'unsubscribe_link';

  if v_lead.id is not null then
    update public.leads set status = 'unsubscribed', next_follow_up_at = null where id = v_lead.id;

    insert into public.email_unsubscribes (organization_id, lead_id, campaign_id, email, email_normalized, source)
    values (v_token.organization_id, v_lead.id, v_token.campaign_id, v_lead.email, lower(btrim(v_lead.email)), 'link');

    update public.campaign_leads
    set status = 'unsubscribed', next_send_at = null
    where lead_id = v_lead.id and status in ('queued','active');

    update public.campaign_executions
    set status = 'cancelled', finished_at = now()
    where lead_id = v_lead.id and status in ('queued','processing');

    if v_token.campaign_id is not null then
      update public.campaigns set unsubscribes = unsubscribes + 1 where id = v_token.campaign_id;
      insert into public.campaign_events (organization_id, campaign_id, lead_id, event_type)
      values (v_token.organization_id, v_token.campaign_id, v_lead.id, 'unsubscribed');
    end if;

    insert into public.email_events (organization_id, campaign_id, lead_id, event_type)
    values (v_token.organization_id, v_token.campaign_id, v_lead.id, 'unsubscribed');
  end if;

  update public.unsubscribe_tokens set used_at = now() where id = v_token.id;

  return query select 'unsubscribed'::text, v_org_name, null::text;
end;
$$;

-- ── API key-less internal helpers ───────────────────────────
create or replace function public.touch_mailbox_sync(p_mailbox_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.mailboxes set last_sync_at = now(), status = 'connected', last_error = null where id = p_mailbox_id;
$$;
