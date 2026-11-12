/**
 * Verifies that background sending is actually running in production:
 * the scheduler secret is accepted, an unauthenticated call is rejected,
 * and the heartbeat the UI reads is fresh.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE_URL ?? 'https://coldfoxpro.vercel.app';

function loadEnv() {
  const raw = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}

const env = loadEnv();
const failures = [];
const check = (ok, label, detail = '') => {
  if (!ok) failures.push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const health = await fetch(`${BASE}/api/health`);
check(health.status === 200, 'health endpoint', `status=${health.status}`);

const unauthorized = await fetch(`${BASE}/api/cron/worker`);
check(unauthorized.status === 401, 'worker rejects a call without the secret', `status=${unauthorized.status}`);

const wrongSecret = await fetch(`${BASE}/api/cron/worker`, { headers: { 'x-cron-secret': 'not-the-secret' } });
check(wrongSecret.status === 401, 'worker rejects a wrong secret', `status=${wrongSecret.status}`);

if (env.CRON_SECRET) {
  const worker = await fetch(`${BASE}/api/cron/worker`, { headers: { 'x-cron-secret': env.CRON_SECRET } });
  const body = await worker.json().catch(() => ({}));
  check(worker.status === 200 && body.ok === true, 'worker runs with the real secret', `status=${worker.status}`);
  if (body.data) console.log(`      summary: activated=${body.data.activated} sent=${body.data.sent} synced=${body.data.mailboxesSynced}`);
}

const statusUnauth = await fetch(`${BASE}/api/cron/status`);
check(statusUnauth.status === 401, 'scheduler status needs a session', `status=${statusUnauth.status}`);

if (env.SMOKE_EMAIL && env.SMOKE_PASSWORD) {
  const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD });
  if (error || !auth.session) {
    console.log(`SKIP  authenticated scheduler status (sign-in failed: ${error?.message})`);
  } else {
    const cookie = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`;
    const status = await fetch(`${BASE}/api/cron/status`, { headers: { cookie } });
    const body = await status.json().catch(() => ({}));
    check(status.status === 200 && body.ok === true, 'scheduler status returns for a signed-in user', `status=${status.status}`);
    check(body.data?.stale === false, 'worker heartbeat is fresh', `lastRunAt=${body.data?.lastRunAt} ageSeconds=${body.data?.ageSeconds}`);
  }
}

console.log(`\n${failures.length === 0 ? 'All checks passed' : `${failures.length} check(s) failed`}`);
if (failures.length) process.exit(1);
