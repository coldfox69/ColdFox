# ColdFox Deployment Guide

## Prerequisites

- GitHub account with access to `coldfox69/ColdFox`
- Vercel account (`raihan6962-7823`)
- Supabase project (`acemlzldkitqgvnfqwcw`, ap-northeast-1)
- Domain for production (optional, Vercel provides default)

## Step 1: GitHub Setup

```bash
cd project
git init
git add -A
git commit -m "Initial commit: ColdFox Next.js SaaS platform"
git remote add origin https://github.com/coldfox69/ColdFox.git
git branch -M main
git push -u origin main
```

**Note**: Do not commit `.env.local`. It is gitignored.

## Step 2: Vercel Project Creation

1. Log in to Vercel at https://vercel.com
2. Create new project, import `coldfox69/ColdFox`
3. Framework preset: Next.js
4. Build command: `npm run build`
5. Development command: `npm run dev`
6. Output directory: `.next` (default for Next.js)

## Step 3: Environment Variables

Set the following in Vercel project settings → Environment Variables:

### Required (Application)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Production URL (e.g., https://coldfox.vercel.app) |
| `NODE_ENV` | `production` |

### Required (Supabase)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `SUPABASE_PROJECT_REF` | Supabase project reference |

### Required (AI)
| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | `openai/gpt-oss-120b` |

### Required (Security)
| Variable | Description |
|----------|-------------|
| `MAILBOX_ENCRYPTION_KEY` | 32-byte base64 encryption key |
| `UNSUBSCRIBE_TOKEN_SECRET` | Signing secret for unsubscribe tokens |
| `OAUTH_STATE_SECRET` | Signing secret for OAuth state |
| `CRON_SECRET` | Secret for cron worker authorization |

### Required (Admin)
| Variable | Description |
|----------|-------------|
| `ADMIN_BOOTSTRAP_EMAIL` | Email of first platform admin |

### Optional (Sending)
| Variable | Description |
|----------|-------------|
| `EMAIL_FROM_NAME` | Default sender name |
| `EMAIL_FROM_ADDRESS` | Default sender email |
| `SMTP_TEST_MODE` | `true` for test mode |

### Optional (OAuth - not configured)
| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Gmail OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth client secret |
| `MICROSOFT_CLIENT_ID` | Microsoft Graph client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft Graph client secret |
| `MICROSOFT_TENANT_ID` | `common` |

### Optional (Billing - not configured)
| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `BILLING_PROVIDER` | `stripe` when configured |

## Step 4: Background Worker (scheduled sending)

Campaigns must keep sending when no browser is open, so the worker has to be
called on a schedule. Vercel Hobby only allows daily cron jobs, so ColdFox uses
**Supabase `pg_cron` + `pg_net`**: the database itself calls the endpoint every
minute. No third-party scheduler account is needed.

Migration `0016_background_worker_scheduler.sql` enables both extensions and
creates the `coldfox-worker` job. It reads the shared secret from Supabase Vault
(name `coldfox_cron_secret`), which must equal `CRON_SECRET` in Vercel. Set or
rotate it with:

```sql
delete from vault.secrets where name = 'coldfox_cron_secret';
select vault.create_secret('<CRON_SECRET>', 'coldfox_cron_secret',
  'ColdFox background worker shared secret');
```

What each minute tick does: activates campaigns whose `launch_at` has passed,
sends executions whose jittered time has come, resets mailbox daily counters,
and syncs inbound replies over IMAP (throttled to once every 5 minutes).

Check it is alive:

```sql
select j.jobname, d.status, d.start_time
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
order by d.start_time desc limit 5;

select status_code, error_msg, created from net._http_response
order by created desc limit 5;
```

The app also shows this on `/app/campaigns`: a green "Background sender is
active" line when the worker ran in the last 5 minutes, and an amber warning
when it has gone stale.

Manual endpoint call, useful for debugging:

```
GET https://coldfoxpro.vercel.app/api/cron/worker
Header: x-cron-secret: <CRON_SECRET>
```

`vercel.json` additionally declares one daily cron as a safety net in case the
database scheduler is ever removed.

If you prefer an external scheduler instead (cron-job.org, GitHub Actions, or a
Cloudflare Worker cron trigger), call the same endpoint with the same header
every 1–5 minutes:

```yaml
name: coldfox-worker
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  worker:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" https://coldfoxpro.vercel.app/api/cron/worker
```

On Vercel Pro you can drop the database scheduler and use a native cron instead:

```json
{ "crons": [{ "path": "/api/cron/worker", "schedule": "*/5 * * * *" }] }
```

## Step 5: Database Migrations

Run migrations against Supabase:

```bash
cd project
npm run db:migrate
```

Or use the Supabase Management API with `SUPABASE_ACCESS_TOKEN`.

## Step 6: Admin Bootstrap

After first user signs up, grant platform admin:

```sql
-- Via Supabase SQL editor or Management API
SELECT public.grant_platform_admin('user@example.com', 'super_admin');
```

Or set `ADMIN_BOOTSTRAP_EMAIL` and the system will bootstrap on first access.

## Step 7: Verify Deployment

1. Visit the production URL
2. Sign up and complete onboarding
3. Connect a mailbox (SMTP)
4. Create and launch a campaign
5. Verify emails are sent and received

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Run `npm run typecheck` locally first |
| Cron not running | Verify `CRON_SECRET` is set in Vercel |
| Emails not sending | Check mailbox connection and SMTP credentials |
| RLS errors | Verify `organization_id` is set on all tenant rows |
| AI returns 503 | Verify `GROQ_API_KEY` is set |

## Production URL

After deployment, the production URL will be available at:
https://coldfox.vercel.app (or your custom domain)
