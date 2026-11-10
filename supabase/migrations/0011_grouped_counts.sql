-- ============================================================
-- ColdFox — 0011 grouped counts in a single round trip
-- ============================================================

-- The dashboard used to fire one count query per status value. With eight
-- statuses that is eight round trips, and on a cold function the parallel
-- requests saturate the connection pool and the page takes seconds to
-- render. These functions do the grouping inside Postgres and return one
-- small jsonb document instead.
--
-- The table and column names are checked against a whitelist, so the
-- function cannot be used to read an arbitrary column.

create or replace function public.count_statuses(
  p_table text,
  p_column text,
  p_org uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_table not in (
    'campaigns', 'leads', 'mailboxes', 'support_tickets',
    'automation_executions', 'campaign_executions', 'background_jobs'
  ) then
    raise exception 'unsupported table: %', p_table;
  end if;

  if p_column not in ('status', 'state') then
    raise exception 'unsupported column: %', p_column;
  end if;

  if p_org is null then
    execute format(
      'select coalesce(jsonb_object_agg(%1$I, n), ''{}''::jsonb)
         from (select %1$I as status, count(*)::int as n
                 from public.%2$I group by %1$I) s',
      p_column, p_table
    ) into v_result;
  else
    execute format(
      'select coalesce(jsonb_object_agg(%1$I, n), ''{}''::jsonb)
         from (select %1$I as status, count(*)::int as n
                 from public.%2$I where organization_id = $1 group by %1$I) s',
      p_column, p_table
    ) into v_result using p_org;
  end if;

  return v_result;
end;
$$;

revoke all on function public.count_statuses(text, text, uuid) from public, anon, authenticated;
grant execute on function public.count_statuses(text, text, uuid) to service_role;
