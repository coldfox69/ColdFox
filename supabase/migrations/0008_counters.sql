-- ============================================================
-- ColdFox — 0008 atomic counters used by the sending engine
-- ============================================================
create or replace function public.increment_campaign_stat(p_campaign uuid, p_stat text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_stat not in ('emails_sent','replies','bounces','unsubscribes') then
    raise exception 'invalid_stat';
  end if;
  execute format('update public.campaigns set %I = %I + 1, updated_at = now() where id = $1', p_stat, p_stat)
  using p_campaign;
end;
$$;

create or replace function public.record_mailbox_send(p_mailbox uuid, p_org uuid, p_success boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_success then
    update public.mailboxes set sent_today = sent_today + 1 where id = p_mailbox and organization_id = p_org;
  end if;
  insert into public.mailbox_daily_usage (organization_id, mailbox_id, usage_date, sent, failed)
  values (p_org, p_mailbox, current_date, case when p_success then 1 else 0 end, case when p_success then 0 else 1 end)
  on conflict (mailbox_id, usage_date) do update set
    sent = public.mailbox_daily_usage.sent + case when p_success then 1 else 0 end,
    failed = public.mailbox_daily_usage.failed + case when p_success then 0 else 1 end;
end;
$$;

create or replace function public.reset_mailbox_daily_counters()
returns void
language sql
security definer
set search_path = public
as $$
  update public.mailboxes
  set sent_today = coalesce((select sent from public.mailbox_daily_usage u where u.mailbox_id = mailboxes.id and u.usage_date = current_date), 0);
$$;

revoke all on function public.increment_campaign_stat(uuid, text) from public, anon, authenticated;
grant execute on function public.increment_campaign_stat(uuid, text) to service_role;
revoke all on function public.record_mailbox_send(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.record_mailbox_send(uuid, uuid, boolean) to service_role;
revoke all on function public.reset_mailbox_daily_counters() from public, anon, authenticated;
grant execute on function public.reset_mailbox_daily_counters() to service_role;
