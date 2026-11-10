-- ============================================================
-- ColdFox — 0011 grouped counts in a single round trip
-- ============================================================

-- The dashboard used to fire one count query per status value. With several
-- statuses that is several round trips, and the parallel requests put
-- pressure on the database connection pool. This function does the grouping
-- inside Postgres and returns one small jsonb document instead.
--
-- The table and column names are checked against a whitelist, so the
-- function cannot be used to read an arbitrary column.

create or replace function public.count_statuses(
  p_table text,
  p_column text,
  p_org uuid default null,
  p_exclude_deleted boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_org_clause text := '';
  v_deleted_clause text := '';
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

  if p_org is not null then
    v_org_clause := ' and organization_id = $1';
  end if;

  if p_exclude_deleted and exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = p_table
       and column_name = 'deleted_at'
  ) then
    v_deleted_clause := ' and deleted_at is null';
  end if;

  execute format(
    'select coalesce(jsonb_object_agg(%1$I, n), ''{}''::jsonb)
       from (select %1$I as status, count(*)::int as n
               from public.%2$I
              where true%3$s%4$s
              group by %1$I) s',
    p_column, p_table, v_org_clause, v_deleted_clause
  ) into v_result using p_org;

  return v_result;
end;
$$;

revoke all on function public.count_statuses(text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.count_statuses(text, text, uuid, boolean) to service_role;
