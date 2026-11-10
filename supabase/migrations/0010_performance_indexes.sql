-- ============================================================
-- ColdFox — 0010 performance: query indexes, cache store, RUM store
-- ============================================================

-- ── indexes for the queries the app actually runs ─────────────
-- Tag lookups by lead (batch import + per-lead tag sync).
create index if not exists lead_tag_assign_lead_idx
  on public.lead_tag_assignments (lead_id, tag_id);

-- Threads looked up by lead and by provider thread id during inbox sync.
create index if not exists threads_lead_idx
  on public.email_threads (organization_id, lead_id);
create index if not exists threads_provider_thread_idx
  on public.email_threads (mailbox_id, provider_thread_id)
  where provider_thread_id is not null;

-- Messages fetched for a set of threads.
create index if not exists messages_org_thread_idx
  on public.email_messages (organization_id, thread_id);

-- Replies joined per lead.
create index if not exists email_replies_lead_idx
  on public.email_replies (organization_id, lead_id);

-- Campaign leads listed per campaign / organisation.
create index if not exists campaign_leads_org_campaign_idx
  on public.campaign_leads (organization_id, campaign_id);
create index if not exists campaign_leads_lead_idx
  on public.campaign_leads (lead_id);

-- Executions listed per organisation with a status filter.
create index if not exists campaign_exec_org_status_idx
  on public.campaign_executions (organization_id, status);
create index if not exists automation_exec_org_status_idx
  on public.automation_executions (organization_id, status);

-- Name sorting and text search on the lists the UI exposes.
create index if not exists leads_org_name_idx
  on public.leads (organization_id, last_name, first_name) where deleted_at is null;
create index if not exists campaigns_org_name_idx
  on public.campaigns (organization_id, name);
create index if not exists templates_org_name_idx
  on public.email_templates (organization_id, name) where archived_at is null;
create index if not exists suppression_org_email_idx
  on public.suppression_entries (organization_id, email_normalized);
create index if not exists tickets_org_status_idx
  on public.support_tickets (organization_id, status);

-- Mailboxes and sending domains are read on nearly every screen.
create index if not exists sending_domains_org_idx
  on public.sending_domains (organization_id);

-- ── shared cache store ────────────────────────────────────────
-- Used by the server cache layer so every app instance shares
-- cached aggregates. Rows expire on their own; a periodic sweep is
-- optional.
create table if not exists public.cache_entries (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now()
);

create index if not exists cache_entries_expires_idx
  on public.cache_entries (expires_at);

alter table public.cache_entries enable row level security;

drop policy if exists cache_entries_service_all on public.cache_entries;
create policy cache_entries_service_all on public.cache_entries
  for all to service_role using (true) with check (true);

-- ── real user performance store ───────────────────────────────
-- Web vitals reported from the browser so we can see how the app
-- actually feels on real devices and networks.
create table if not exists public.web_vitals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  path text not null,
  metric text not null,
  value double precision not null,
  rating text,
  navigation_type text,
  user_agent text,
  country text,
  device_type text,
  connection_type text,
  created_at timestamptz not null default now()
);

create index if not exists web_vitals_metric_idx
  on public.web_vitals (metric, created_at desc);
create index if not exists web_vitals_path_idx
  on public.web_vitals (path, created_at desc);

alter table public.web_vitals enable row level security;

drop policy if exists web_vitals_service_all on public.web_vitals;
create policy web_vitals_service_all on public.web_vitals
  for all to service_role using (true) with check (true);

-- ── cleanup helper for expired cache rows ─────────────────────
create or replace function public.prune_cache_entries()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removed integer;
begin
  delete from public.cache_entries where expires_at < now();
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;
