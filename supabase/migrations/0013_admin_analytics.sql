-- ============================================================
-- ColdFox — 0013 admin analytics helpers
-- Small, read-only aggregates for the owner console.
-- ============================================================

create or replace function public.admin_top_organizations(p_limit integer default 12)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'name', x.name,
    'plan_key', x.plan_key,
    'is_suspended', x.is_suspended,
    'leads', x.leads,
    'campaigns', x.campaigns,
    'mailboxes', x.mailboxes
  ) order by x.leads desc, x.campaigns desc), '[]'::jsonb)
  from (
    select o.id, o.name, o.plan_key, o.is_suspended,
           (select count(*) from public.leads l where l.organization_id = o.id and l.deleted_at is null)::int as leads,
           (select count(*) from public.campaigns c where c.organization_id = o.id and c.archived_at is null)::int as campaigns,
           (select count(*) from public.mailboxes m where m.organization_id = o.id)::int as mailboxes
    from public.organizations o
    where o.deleted_at is null
    order by leads desc, campaigns desc
    limit greatest(1, least(p_limit, 100))
  ) x;
$$;

create or replace function public.admin_revenue_series(p_months integer default 6)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with span as (
    select generate_series(
      date_trunc('month', current_date) - make_interval(months => greatest(p_months, 1) - 1),
      date_trunc('month', current_date),
      interval '1 month'
    ) as month
  ),
  paid as (
    select date_trunc('month', paid_at) as month,
           coalesce(sum(amount_cents), 0)::bigint as cents,
           count(*)::int as invoices
    from public.invoices
    where status = 'paid' and paid_at is not null
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'month', to_char(s.month, 'YYYY-MM'),
    'label', to_char(s.month, 'Mon YY'),
    'cents', coalesce(p.cents, 0),
    'invoices', coalesce(p.invoices, 0)
  ) order by s.month), '[]'::jsonb)
  from span s left join paid p on p.month = s.month;
$$;

revoke all on function public.admin_top_organizations(integer) from public, anon, authenticated;
revoke all on function public.admin_revenue_series(integer) from public, anon, authenticated;
grant execute on function public.admin_top_organizations(integer) to service_role;
grant execute on function public.admin_revenue_series(integer) to service_role;
