-- ============================================================
-- ColdFox — 0007 security hardening for service-side helpers
-- ============================================================
create or replace function public.record_usage(p_org uuid, p_metric text, p_quantity integer default 1, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_org_member(p_org) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  insert into public.usage_records (organization_id, metric, quantity, metadata)
  values (p_org, p_metric, greatest(p_quantity, 0), p_metadata);
end;
$$;

create or replace function public.org_usage(p_org uuid, p_metric text, p_period_start date default date_trunc('month', now())::date)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_org_member(p_org) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select coalesce(sum(quantity), 0)::int into v_total from public.usage_records
  where organization_id = p_org and metric = p_metric and period_start = p_period_start;
  return v_total;
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
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_org_member(p_org) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  v_limit := public.plan_limit(p_org, p_metric);
  if v_limit = -1 then return true; end if;
  v_used := public.org_usage(p_org, p_metric);
  return (v_used + p_increment) <= v_limit;
end;
$$;

revoke all on function public.is_suppressed(uuid, text) from public, anon, authenticated;
grant execute on function public.is_suppressed(uuid, text) to service_role;

revoke all on function public.org_usage(uuid, text, date) from public, anon;
grant execute on function public.org_usage(uuid, text, date) to authenticated, service_role;
revoke all on function public.check_org_limit(uuid, text, integer) from public, anon;
grant execute on function public.check_org_limit(uuid, text, integer) to authenticated, service_role;
revoke all on function public.record_usage(uuid, text, integer, jsonb) from public, anon;
grant execute on function public.record_usage(uuid, text, integer, jsonb) to authenticated, service_role;

-- Enforce that a user can only read the orgs they belong to through the join table.
-- (organizations RLS already does this; helper functions now do too.)
