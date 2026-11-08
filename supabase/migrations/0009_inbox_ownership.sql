-- ============================================================
-- ColdFox — 0009 inbox ownership
-- Adds thread assignment so the unified inbox can route work.
-- ============================================================

alter table public.email_threads
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

create index if not exists threads_assigned_idx
  on public.email_threads(organization_id, assigned_to)
  where assigned_to is not null;
