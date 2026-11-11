-- ============================================================
-- ColdFox — 0015 campaign engine
-- Lead lists, dynamic placeholders, template variants, AI review
-- history and jittered send scheduling. Additive and reversible.
-- ============================================================

-- ── lead lists ──────────────────────────────────────────────
create table if not exists public.lead_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  filename text,
  columns jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  source text not null default 'import' check (source in ('import', 'manual', 'copy_paste')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists lead_lists_org_idx on public.lead_lists(organization_id, created_at desc) where archived_at is null;
drop trigger if exists lead_lists_updated_at on public.lead_lists;
create trigger lead_lists_updated_at before update on public.lead_lists
  for each row execute function public.set_updated_at();

alter table public.leads add column if not exists lead_list_id uuid references public.lead_lists(id) on delete set null;
create index if not exists leads_list_idx on public.leads(lead_list_id) where deleted_at is null;

-- ── templates: single vs group modes + AI toggles ───────────
alter table public.email_templates add column if not exists mode text not null default 'single' check (mode in ('single', 'group'));
alter table public.email_templates add column if not exists ai_personalization boolean not null default false;
alter table public.email_templates add column if not exists ai_personalization_notes text;
alter table public.email_templates add column if not exists ai_review jsonb;

create table if not exists public.email_template_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.email_templates(id) on delete cascade,
  variant_order integer not null default 1 check (variant_order >= 1),
  subject text not null,
  body_text text not null,
  body_html text not null default '',
  approved boolean not null default true,
  ai_review jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, variant_order)
);
create index if not exists email_template_variants_template_idx on public.email_template_variants(template_id, variant_order);
drop trigger if exists email_template_variants_updated_at on public.email_template_variants;
create trigger email_template_variants_updated_at before update on public.email_template_variants
  for each row execute function public.set_updated_at();

create table if not exists public.template_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.email_templates(id) on delete cascade,
  variant_id uuid references public.email_template_variants(id) on delete cascade,
  kind text not null default 'deliverability_review' check (kind in ('deliverability_review', 'personalization')),
  subject_before text,
  body_before text,
  subject_after text,
  body_after text,
  explanation jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists template_ai_reviews_template_idx on public.template_ai_reviews(template_id, created_at desc);

-- ── campaigns: prerequisites, interval, personalization ─────
alter table public.campaigns add column if not exists lead_list_id uuid references public.lead_lists(id) on delete set null;
alter table public.campaigns add column if not exists interval_min_seconds integer not null default 30 check (interval_min_seconds between 1 and 3600);
alter table public.campaigns add column if not exists interval_max_seconds integer not null default 70 check (interval_max_seconds between 1 and 3600);
alter table public.campaigns add column if not exists ai_personalization boolean not null default false;
create index if not exists campaigns_lead_list_idx on public.campaigns(lead_list_id);

-- ── executions: which variant / was personalized ────────────
alter table public.campaign_executions add column if not exists variant_id uuid references public.email_template_variants(id) on delete set null;
alter table public.campaign_executions add column if not exists personalized boolean not null default false;
alter table public.campaign_executions add column if not exists personalized_subject text;
alter table public.campaign_executions add column if not exists personalized_body text;

-- ============================================================
-- Row Level Security for the new tables
-- ============================================================
do $$
declare
  t text;
  v_tables text[] := array['lead_lists', 'email_template_variants', 'template_ai_reviews'];
begin
  foreach t in array v_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);
    execute format('create policy tenant_select on public.%I for select to authenticated using (public.is_org_member(organization_id))', t);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (public.has_org_role(organization_id, array[''owner'',''admin'',''member'']))', t);
    execute format('create policy tenant_update on public.%I for update to authenticated using (public.has_org_role(organization_id, array[''owner'',''admin'',''member''])) with check (public.has_org_role(organization_id, array[''owner'',''admin'',''member'']))', t);
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (public.has_org_role(organization_id, array[''owner'',''admin'']))', t);
  end loop;
end $$;
