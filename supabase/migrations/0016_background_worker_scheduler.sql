-- Background sending must keep running when no browser is open. Vercel Hobby
-- only allows daily cron jobs, so the database itself drives the worker every
-- minute with pg_cron -> pg_net -> the Vercel endpoint.
--
-- Prerequisite: the shared secret lives in Supabase Vault under the name
-- 'coldfox_cron_secret' and must equal CRON_SECRET in the Vercel environment.
-- Create or rotate it with:
--   delete from vault.secrets where name = 'coldfox_cron_secret';
--   select vault.create_secret('<CRON_SECRET>', 'coldfox_cron_secret',
--     'ColdFox background worker shared secret');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('coldfox-worker')
where exists (select 1 from cron.job where jobname = 'coldfox-worker');

select cron.schedule(
  'coldfox-worker',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://coldfoxpro.vercel.app/api/cron/worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'coldfox_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  ) as request_id;
  $job$
);
