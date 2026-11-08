-- ============================================================
-- ColdFox — 0003 mailboxes, messaging, suppression, deliverability
-- ============================================================

-- ── mailboxes ───────────────────────────────────────────────
create table if not exists public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email_address text not null check (position('@' in email_address) > 1),
  display_name text,
  provider text not null check (provider in ('gmail','outlook','smtp')),
  status text not null default 'disconnected' check (status in ('connected','error','syncing','disconnected')),
  daily_limit integer not null default 100 check (daily_limit between 1 and 2000),
  sent_today integer not null default 0,
  warmup_enabled boolean not null default false,
  reputation text not null default 'good' check (reputation in ('excellent','good','fair','poor','unknown')),
  last_sync_at timestamptz,
  last_error text,
  is_default boolean not null default false,
  provider_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email_address)
);
create index if not exists mailboxes_org_idx on public.mailboxes(organization_id, created_at desc);

drop trigger if exists mailboxes_updated_at on public.mailboxes;
create trigger mailboxes_updated_at before update on public.mailboxes
  for each row execute function public.set_updated_at();

alter table public.campaigns
  drop constraint if exists campaigns_mailbox_fk;
alter table public.campaigns
  add constraint campaigns_mailbox_fk foreign key (mailbox_id) references public.mailboxes(id) on delete set null;

create table if not exists public.mailbox_credentials (
  mailbox_id uuid primary key references public.mailboxes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  encrypted_payload text not null,
  key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.mailbox_health (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mailbox_id uuid not null references public.mailboxes(id) on delete cascade,
  status text not null,
  score integer check (score between 0 and 100),
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);
create index if not exists mailbox_health_idx on public.mailbox_health(mailbox_id, checked_at desc);

create table if not exists public.mailbox_daily_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mailbox_id uuid not null references public.mailboxes(id) on delete cascade,
  usage_date date not null default current_date,
  sent integer not null default 0,
  received integer not null default 0,
  failed integer not null default 0,
  primary key (mailbox_id, usage_date)
);

create table if not exists public.mailbox_sync_state (
  mailbox_id uuid primary key references public.mailboxes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  last_uid text,
  history_id text,
  delta_token text,
  last_sync_at timestamptz,
  last_error text
);

-- ── threads & messages ──────────────────────────────────────
create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mailbox_id uuid references public.mailboxes(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  provider_thread_id text,
  subject text,
  last_message_at timestamptz not null default now(),
  unread_count integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists threads_org_idx on public.email_threads(organization_id, last_message_at desc) where is_archived = false;
create unique index if not exists threads_provider_unique on public.email_threads(organization_id, mailbox_id, provider_thread_id) where provider_thread_id is not null;

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  mailbox_id uuid references public.mailboxes(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  direction text not null check (direction in ('inbound','outbound')),
  from_email text not null,
  from_name text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text,
  body_text text,
  body_html text,
  snippet text,
  provider_message_id text,
  in_reply_to text,
  references_ids text[] not null default '{}',
  sent_at timestamptz,
  received_at timestamptz,
  is_read boolean not null default false,
  is_draft boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.email_messages(thread_id, created_at);
create index if not exists messages_org_idx on public.email_messages(organization_id, created_at desc);
create unique index if not exists messages_provider_unique on public.email_messages(provider_message_id) where provider_message_id is not null;

create table if not exists public.email_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  message_id uuid not null references public.email_messages(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  execution_id uuid references public.campaign_executions(id) on delete set null,
  classification text not null default 'other' check (classification in ('interested','not_interested','out_of_office','unsubscribe','question','other')),
  received_at timestamptz not null default now()
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid references public.email_messages(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  event_type text not null check (event_type in ('queued','processing','accepted','delivered','bounced','complained','opened','clicked','replied','unsubscribed','failed')),
  provider_event_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists email_events_org_idx on public.email_events(organization_id, occurred_at desc);
create unique index if not exists email_events_provider_unique on public.email_events(provider_event_id) where provider_event_id is not null;

create table if not exists public.email_bounces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid references public.email_messages(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  email text not null,
  bounce_type text not null check (bounce_type in ('hard','soft','unknown')),
  reason text,
  provider text,
  occurred_at timestamptz not null default now()
);

create table if not exists public.email_complaints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid references public.email_messages(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  email text not null,
  provider text,
  reason text,
  occurred_at timestamptz not null default now()
);

create table if not exists public.email_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  email text not null,
  email_normalized text not null,
  source text not null default 'link',
  ip_hash text,
  user_agent text,
  occurred_at timestamptz not null default now()
);
create index if not exists unsubscribes_org_idx on public.email_unsubscribes(organization_id, occurred_at desc);

-- ── suppression ─────────────────────────────────────────────
create table if not exists public.suppression_reasons (
  key text primary key,
  label text not null,
  description text
);

insert into public.suppression_reasons (key, label, description) values
  ('unsubscribed', 'Unsubscribed', 'Contact opted out of commercial email'),
  ('hard_bounce', 'Hard bounce', 'Mailbox permanently rejected delivery'),
  ('complaint', 'Complaint', 'Recipient marked a message as spam'),
  ('manual', 'Manual suppression', 'Added by a workspace member'),
  ('invalid_address', 'Invalid address', 'Address failed syntax or mailbox validation'),
  ('global_block', 'Global block', 'Blocked by ColdFox abuse controls')
on conflict (key) do nothing;

create table if not exists public.suppression_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  email_normalized text not null,
  reason_key text not null default 'manual' references public.suppression_reasons(key),
  source text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (organization_id, email_normalized)
);
create index if not exists suppression_org_idx on public.suppression_entries(organization_id, created_at desc);

create or replace function public.is_suppressed(p_org uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.suppression_entries
    where organization_id = p_org
      and email_normalized = lower(btrim(p_email))
      and (expires_at is null or expires_at > now())
  );
$$;

-- ── unsubscribe tokens ──────────────────────────────────────
create table if not exists public.unsubscribe_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  token_hash text not null unique,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists unsubscribe_tokens_org_idx on public.unsubscribe_tokens(organization_id);

-- ── deliverability ──────────────────────────────────────────
create table if not exists public.sending_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null,
  status text not null default 'not_configured' check (status in ('verified','not_configured','invalid','unable_to_verify','needs_attention')),
  spf_status text not null default 'not_configured',
  dkim_status text not null default 'not_configured',
  dmarc_status text not null default 'not_configured',
  dkim_selector text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists sending_domains_org_domain_unique on public.sending_domains(organization_id, lower(domain));

create table if not exists public.domain_authentication_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain_id uuid not null references public.sending_domains(id) on delete cascade,
  check_type text not null check (check_type in ('spf','dkim','dmarc','mx')),
  status text not null check (status in ('verified','not_configured','invalid','unable_to_verify','needs_attention')),
  record_found text,
  expected text,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);
create index if not exists domain_checks_idx on public.domain_authentication_checks(domain_id, checked_at desc);

create table if not exists public.deliverability_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain_id uuid references public.sending_domains(id) on delete cascade,
  mailbox_id uuid references public.mailboxes(id) on delete cascade,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists deliverability_events_idx on public.deliverability_events(organization_id, created_at desc);

create table if not exists public.sender_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mailbox_id uuid references public.mailboxes(id) on delete cascade,
  score integer check (score between 0 and 100),
  bounce_rate numeric(5,2),
  complaint_rate numeric(5,2),
  sent integer not null default 0,
  captured_at timestamptz not null default now()
);
