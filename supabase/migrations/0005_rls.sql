-- ============================================================
-- ColdFox — 0005 Row Level Security
-- Every tenant table is protected by organization membership.
-- ============================================================

-- 1) Enable RLS everywhere in public
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- 2) Generic tenant policies for tables that carry organization_id
do $$
declare
  t record;
  v_skip text[] := array[
    'organization_members','invitations','onboarding_responses',
    'subscriptions','billing_customers','invoices','usage_limits','usage_records',
    'mailbox_credentials','mailbox_health','mailbox_daily_usage','mailbox_sync_state',
    'email_threads','email_messages','email_replies','email_events','email_bounces',
    'email_complaints','email_unsubscribes','unsubscribe_tokens',
    'campaign_executions','campaign_events','campaign_schedules',
    'ai_generations','ai_usage_records','ai_model_settings',
    'audit_logs','background_jobs','sender_health_snapshots',
    'domain_authentication_checks','deliverability_events',
    'automation_executions','automation_execution_logs',
    'support_tickets','support_messages','usages'
  ];
begin
  for t in
    select distinct c.table_name
    from information_schema.columns c
    join pg_tables p on p.schemaname = 'public' and p.tablename = c.table_name
    where c.table_schema = 'public' and c.column_name = 'organization_id'
      and not (c.table_name = any(v_skip))
  loop
    execute format('drop policy if exists tenant_select on public.%I', t.table_name);
    execute format('drop policy if exists tenant_insert on public.%I', t.table_name);
    execute format('drop policy if exists tenant_update on public.%I', t.table_name);
    execute format('drop policy if exists tenant_delete on public.%I', t.table_name);

    execute format(
      'create policy tenant_select on public.%I for select to authenticated using (public.is_org_member(organization_id))',
      t.table_name);
    execute format(
      'create policy tenant_insert on public.%I for insert to authenticated with check (public.has_org_role(organization_id, array[''owner'',''admin'',''member'']))',
      t.table_name);
    execute format(
      'create policy tenant_update on public.%I for update to authenticated using (public.has_org_role(organization_id, array[''owner'',''admin'',''member''])) with check (public.has_org_role(organization_id, array[''owner'',''admin'',''member'']))',
      t.table_name);
    execute format(
      'create policy tenant_delete on public.%I for delete to authenticated using (public.has_org_role(organization_id, array[''owner'',''admin'']))',
      t.table_name);
  end loop;
end $$;

-- 3) Read-only tenant tables (writes happen through the trusted server)
do $$
declare
  t text;
  v_read text[] := array[
    'subscriptions','billing_customers','invoices','usage_limits','usage_records',
    'mailbox_health','mailbox_daily_usage','mailbox_sync_state',
    'email_threads','email_messages','email_replies','email_events','email_bounces',
    'email_complaints','email_unsubscribes',
    'campaign_executions','campaign_events','campaign_schedules',
    'ai_generations','ai_usage_records','ai_model_settings',
    'sender_health_snapshots','domain_authentication_checks','deliverability_events',
    'automation_executions','automation_execution_logs'
  ];
begin
  foreach t in array v_read loop
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('create policy tenant_select on public.%I for select to authenticated using (public.is_org_member(organization_id))', t);
  end loop;
end $$;

-- 4) credentials & unsubscribe tokens: service role only (no policies)

-- 5) profiles
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_insert on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- 6) organizations
drop policy if exists orgs_select on public.organizations;
drop policy if exists orgs_update on public.organizations;
create policy orgs_select on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy orgs_update on public.organizations for update to authenticated
  using (public.has_org_role(id, array['owner','admin']))
  with check (public.has_org_role(id, array['owner','admin']));

-- 7) organization_members
drop policy if exists members_select on public.organization_members;
drop policy if exists members_update on public.organization_members;
drop policy if exists members_delete on public.organization_members;
create policy members_select on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id));
create policy members_update on public.organization_members for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) and role <> 'owner')
  with check (public.has_org_role(organization_id, array['owner','admin']) and role <> 'owner');
create policy members_delete on public.organization_members for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) and role <> 'owner' and user_id <> auth.uid());

-- 8) invitations (owner/admin only)
drop policy if exists invitations_select on public.invitations;
drop policy if exists invitations_insert on public.invitations;
drop policy if exists invitations_update on public.invitations;
drop policy if exists invitations_delete on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','admin']));
create policy invitations_update on public.invitations for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']))
  with check (public.has_org_role(organization_id, array['owner','admin']));
create policy invitations_delete on public.invitations for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']));

-- 9) onboarding responses (own row)
drop policy if exists onboarding_select on public.onboarding_responses;
drop policy if exists onboarding_insert on public.onboarding_responses;
drop policy if exists onboarding_update on public.onboarding_responses;
create policy onboarding_select on public.onboarding_responses for select to authenticated
  using (user_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin']));
create policy onboarding_insert on public.onboarding_responses for insert to authenticated
  with check (user_id = auth.uid() and public.is_org_member(organization_id));
create policy onboarding_update on public.onboarding_responses for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 10) public catalogs
drop policy if exists plans_public on public.subscription_plans;
create policy plans_public on public.subscription_plans for select to anon, authenticated using (true);

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated using (true);

drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select to authenticated using (true);

drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);

drop policy if exists suppression_reasons_read on public.suppression_reasons;
create policy suppression_reasons_read on public.suppression_reasons for select to authenticated using (true);

drop policy if exists support_categories_read on public.support_categories;
create policy support_categories_read on public.support_categories for select to anon, authenticated using (true);

drop policy if exists kb_public on public.kb_articles;
create policy kb_public on public.kb_articles for select to anon, authenticated using (is_published = true);

drop policy if exists flags_public on public.feature_flags;
create policy flags_public on public.feature_flags for select to anon, authenticated using (true);

drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select to anon, authenticated
  using (is_active = true and starts_at <= now() and (ends_at is null or ends_at > now()));

drop policy if exists settings_public_read on public.system_settings;
create policy settings_public_read on public.system_settings for select to anon, authenticated using (is_public = true);

drop policy if exists admin_roles_read on public.admin_roles;
create policy admin_roles_read on public.admin_roles for select to authenticated using (public.is_platform_admin());

drop policy if exists admin_permissions_read on public.admin_permissions;
create policy admin_permissions_read on public.admin_permissions for select to authenticated using (public.is_platform_admin());

-- 11) platform admins can read their own record
drop policy if exists platform_admin_self on public.platform_admins;
create policy platform_admin_self on public.platform_admins for select to authenticated using (user_id = auth.uid());

-- 12) notifications (own)
drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 13) audit logs & jobs (workspace admins)
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (organization_id is not null and public.has_org_role(organization_id, array['owner','admin']));

drop policy if exists jobs_select on public.background_jobs;
create policy jobs_select on public.background_jobs for select to authenticated
  using (organization_id is not null and public.has_org_role(organization_id, array['owner','admin']));

drop policy if exists job_logs_select on public.background_job_logs;
create policy job_logs_select on public.background_job_logs for select to authenticated
  using (exists (
    select 1 from public.background_jobs j
    where j.id = background_job_logs.job_id
      and j.organization_id is not null
      and public.has_org_role(j.organization_id, array['owner','admin'])
  ));

-- 14) support tickets/messages
drop policy if exists tickets_select on public.support_tickets;
drop policy if exists tickets_insert on public.support_tickets;
drop policy if exists tickets_update on public.support_tickets;
create policy tickets_select on public.support_tickets for select to authenticated
  using (public.is_org_member(organization_id));
create policy tickets_insert on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid() and public.is_org_member(organization_id));
create policy tickets_update on public.support_tickets for update to authenticated
  using (user_id = auth.uid() and public.is_org_member(organization_id))
  with check (user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists support_messages_select on public.support_messages;
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_select on public.support_messages for select to authenticated
  using (public.is_org_member(organization_id) and (is_internal = false or public.has_org_role(organization_id, array['owner','admin'])));
create policy support_messages_insert on public.support_messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_org_member(organization_id) and author_type = 'user');

-- 15) email_template_versions: members may create versions
drop policy if exists template_versions_insert on public.email_template_versions;
create policy template_versions_insert on public.email_template_versions for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','admin','member']));

-- 16) ai prompt versions: authenticated read
drop policy if exists prompt_versions_read on public.ai_prompt_versions;
create policy prompt_versions_read on public.ai_prompt_versions for select to authenticated using (is_active);

-- 17) admin read access via platform role to otherwise service-only tables
do $$
declare
  t text;
  v_tables text[] := array[
    'organizations','organization_members','profiles','campaigns','mailboxes',
    'email_messages','audit_logs','background_jobs','error_logs','webhook_events',
    'ai_usage_records','support_tickets','subscriptions','invoices'
  ];
begin
  foreach t in array v_tables loop
    execute format('drop policy if exists platform_admin_read on public.%I', t);
    execute format('create policy platform_admin_read on public.%I for select to authenticated using (public.is_platform_admin())', t);
  end loop;
end $$;

-- Platform admins may read job logs and system settings too
drop policy if exists platform_admin_read on public.background_job_logs;
create policy platform_admin_read on public.background_job_logs for select to authenticated using (public.is_platform_admin());
drop policy if exists platform_admin_settings on public.system_settings;
create policy platform_admin_settings on public.system_settings for select to authenticated using (public.is_platform_admin());
drop policy if exists platform_admin_tickets on public.support_messages;
create policy platform_admin_tickets on public.support_messages for select to authenticated using (public.is_platform_admin());

-- 18) revoke direct execution of privileged functions from end users
revoke all on function public.claim_background_jobs(text, integer) from public, anon, authenticated;
revoke all on function public.finish_background_job(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.enqueue_job(text, jsonb, uuid, timestamptz, integer, text, integer) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.grant_platform_admin(text, text) from public, anon, authenticated;
revoke all on function public.touch_mailbox_sync(uuid) from public, anon, authenticated;
revoke all on function public.record_usage(uuid, text, integer, jsonb) from public, anon;
grant execute on function public.process_unsubscribe(text) to anon, authenticated;
grant execute on function public.is_suppressed(uuid, text) to authenticated;
grant execute on function public.bootstrap_organization(text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.check_org_limit(uuid, text, integer) to authenticated;
grant execute on function public.org_usage(uuid, text, date) to authenticated;
grant execute on function public.record_usage(uuid, text, integer, jsonb) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.is_platform_admin(text[]) to authenticated;
grant execute on function public.has_admin_permission(text) to authenticated;
