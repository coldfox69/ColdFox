-- AI Agents.
--
-- A platform level catalog of agents that admins configure once and users
-- then run from their workspace. Three tables:
--
--   ai_agents            the catalog: description, input schema, API wiring
--   ai_agent_credentials the API key of an agent, encrypted at rest
--   ai_agent_runs        one row per run started by a user or an automation
--
-- The agents are shared by every workspace, so these tables are not scoped by
-- organization_id. Runs are, because they belong to the workspace that asked
-- for them and may contain customer data.

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  purpose text,
  icon text not null default 'bot',
  category text not null default 'general',
  status text not null default 'draft' check (status in ('draft', 'published', 'disabled')),
  agent_type text not null default 'external' check (agent_type in ('builtin', 'external')),
  -- The input fields a user has to fill in, rendered dynamically.
  input_schema jsonb not null default '[]'::jsonb,
  -- How to reach the agent API. Never holds a secret; the secret lives in
  -- ai_agent_credentials.
  api_config jsonb not null default '{}'::jsonb,
  -- Whether the agent can hand its result to the email outreach pipeline.
  supports_outreach boolean not null default false,
  outreach_defaults jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.ai_agent_credentials (
  agent_id uuid primary key references public.ai_agents(id) on delete cascade,
  encrypted_payload text not null,
  key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'awaiting_api', 'failed', 'cancelled')),
  source text not null default 'manual' check (source in ('manual', 'automation')),
  inputs jsonb not null default '{}'::jsonb,
  outreach jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  lead_list_id uuid references public.lead_lists(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  automation_id uuid references public.automation_workflows(id) on delete set null,
  automation_execution_id uuid references public.automation_executions(id) on delete set null,
  scheduled_for timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_agent_runs_org_created_idx
  on public.ai_agent_runs (organization_id, created_at desc);
create index if not exists ai_agent_runs_agent_idx
  on public.ai_agent_runs (agent_id, created_at desc);

-- Automation workflows can be bound to an agent, which is what makes an agent
-- task show up in the Automation page.
alter table public.automation_workflows
  add column if not exists agent_id uuid references public.ai_agents(id) on delete set null;

-- A new step type so a workflow can describe "run this agent".
alter table public.automation_steps drop constraint if exists automation_steps_step_type_check;
alter table public.automation_steps
  add constraint automation_steps_step_type_check
  check (step_type in ('delay', 'send_email', 'condition', 'stop', 'manual_review', 'agent_run'));

-- Lead lists created by an agent are tagged as such.
alter table public.lead_lists drop constraint if exists lead_lists_source_check;
alter table public.lead_lists
  add constraint lead_lists_source_check
  check (source in ('import', 'manual', 'copy_paste', 'agent'));

drop trigger if exists ai_agents_updated_at on public.ai_agents;
create trigger ai_agents_updated_at before update on public.ai_agents
  for each row execute function public.set_updated_at();

-- Row level security. Everything is read and written through the service role
-- in the API layer, so these policies only keep the tables closed if the
-- anon key is ever used directly from the browser.
alter table public.ai_agents enable row level security;
alter table public.ai_agent_credentials enable row level security;
alter table public.ai_agent_runs enable row level security;

drop policy if exists ai_agents_published_read on public.ai_agents;
create policy ai_agents_published_read on public.ai_agents
  for select to authenticated using (status = 'published');

-- Credentials have no policy on purpose: only the service role may read them.
drop policy if exists ai_agent_runs_select on public.ai_agent_runs;
create policy ai_agent_runs_select on public.ai_agent_runs
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists ai_agent_runs_insert on public.ai_agent_runs;
create policy ai_agent_runs_insert on public.ai_agent_runs
  for insert to authenticated with check (public.has_org_role(organization_id, array['owner', 'admin', 'member']));

drop policy if exists ai_agent_runs_update on public.ai_agent_runs;
create policy ai_agent_runs_update on public.ai_agent_runs
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin', 'member']))
  with check (public.has_org_role(organization_id, array['owner', 'admin', 'member']));

-- Seed one example agent so the feature is visible before an administrator
-- creates the real ones. It is published but has no API, so running it stops
-- with a clear "not connected yet" message instead of inventing data.
insert into public.ai_agents (
  slug, name, description, purpose, icon, category, status, agent_type,
  input_schema, api_config, supports_outreach, sort_order
) values (
  'shopify-lead-generation',
  'Shopify lead generation',
  'Find Shopify store owners in a target market and hand them to the email outreach pipeline.',
  'Collect the target country, niche and audience, then build a list of Shopify store owners for a cold email campaign.',
  'shopping-bag',
  'lead generation',
  'published',
  'external',
  '[
    {"key":"country","label":"Target country","type":"text","required":true,"placeholder":"United States"},
    {"key":"niche","label":"Store niche","type":"text","required":true,"placeholder":"Apparel, home goods, beauty"},
    {"key":"audience","label":"Audience","type":"textarea","placeholder":"Store owners who sell premium products"},
    {"key":"keywords","label":"Keywords","type":"text","placeholder":"shopify store, shopify apps"},
    {"key":"lead_limit","label":"Maximum leads","type":"number","default":50,"min":1,"max":500}
  ]'::jsonb,
  '{"base_url":"","path":"","method":"POST","auth_type":"bearer","body_mode":"inputs"}'::jsonb,
  true,
  10
) on conflict (slug) do nothing;
