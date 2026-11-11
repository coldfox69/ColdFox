-- ============================================================
-- ColdFox — 0014 role permission separation
-- Support had a single permission for reading and writing tickets,
-- which gave the read-only role write access. Split the read
-- permission out and narrow read-only back to viewing.
-- ============================================================

insert into public.admin_permissions (key, description) values
  ('support.view', 'View support tickets and conversations'),
  ('users.manage', 'Edit user profiles and suspend or reactivate accounts'),
  ('orgs.manage', 'Edit organizations, change plan and suspend or restore'),
  ('billing.manage', 'Edit subscriptions and administrative billing records'),
  ('settings.manage', 'Manage feature flags, settings, jobs and error logs')
on conflict (key) do update set description = excluded.description;

-- Every role that can read support needs the view permission.
update public.admin_roles
set permissions = (
  select array_agg(distinct permission order by permission)
  from unnest(permissions || array['support.view']) as permission
)
where key in ('super_admin', 'admin', 'support_admin', 'read_only');

-- The read-only role must never hold a write permission.
update public.admin_roles
set permissions = (
  select array_agg(permission order by permission)
  from unnest(permissions) as permission
  where permission <> 'support.manage'
)
where key = 'read_only';
