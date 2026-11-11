/**
 * Admin console smoke test against a locally running production build.
 *
 * Usage: node scripts/smoke-admin.mjs
 * Reads .env.local, signs in with SMOKE_EMAIL / SMOKE_PASSWORD, and
 * exercises the admin console API.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

function loadEnv() {
  const raw = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  const env = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return env;
}

const env = loadEnv();
const email = process.env.SMOKE_EMAIL ?? env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD ?? env.SMOKE_PASSWORD;
if (!email || !password) {
  console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD in the environment or .env.local.');
  process.exit(1);
}
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) {
  console.error('Sign-in failed:', authError.message);
  process.exit(1);
}

const cookieName = `sb-${projectRef}-auth-token`;
const cookieValue = `base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`;
const cookie = `${cookieName}=${cookieValue}`;

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { cookie, accept: 'application/json' },
    redirect: 'manual',
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { response, body, text };
}

async function checkModule(mod) {
  const { response, body } = await get(`/api/admin/console/${mod}?pageSize=5`);
  const rows = body?.data?.rows;
  const ok = response.status === 200 && body?.ok === true;
  record(`${mod} list`, ok, `status=${response.status}${Array.isArray(rows) ? ` rows=${rows.length}` : ''}${body?.error ? ` error=${body.error}` : ''}`);
  return body?.data;
}

// API session sanity
await get('/api/admin/console/me').then(({ response, body }) => {
  record('me endpoint', response.status === 200 && body?.ok === true, `status=${response.status}${body?.error ? ` error=${body.error}` : ''}`);
});

// Dashboards
for (const mod of ['overview', 'analytics', 'revenue', 'system-health']) {
  const { response, body } = await get(`/api/admin/console/${mod}`);
  record(`${mod} dashboard`, response.status === 200 && body?.ok === true, `status=${response.status}${body?.error ? ` error=${body.error}` : ''}`);
}

// Every table module
const modules = [
  'users', 'organizations', 'leads', 'campaigns', 'mailboxes', 'subscriptions',
  'plans', 'billing', 'tickets', 'announcements', 'ai-usage', 'api-usage',
  'feature-flags', 'settings', 'jobs', 'errors', 'audit', 'roles', 'webhooks',
  'abuse', 'email-activity', 'integrations',
];
const datasets = {};
for (const mod of modules) {
  datasets[mod] = await checkModule(mod);
}

// Detail lookup on the first user row
const firstUser = datasets.users?.rows?.[0];
if (firstUser?.id) {
  const { response, body } = await get(`/api/admin/console/users?id=${encodeURIComponent(firstUser.id)}`);
  record('user detail', response.status === 200 && Boolean(body?.data?.fields?.length), `status=${response.status}`);
} else {
  record('user detail', false, 'no user row available');
}

// CSV export
for (const mod of ['users', 'leads', 'audit']) {
  const response = await fetch(`${BASE}/api/admin/console/export/${mod}`, {
    headers: { cookie },
    redirect: 'manual',
  });
  const text = await response.text();
  record(`${mod} export`, response.status === 200 && text.includes(','), `status=${response.status} bytes=${text.length} type=${response.headers.get('content-type')}`);
}

// Invalid module
{
  const { response, body } = await get('/api/admin/console/not-a-module');
  record('unknown module rejected', response.status === 404 && body?.ok === false, `status=${response.status}`);
}

// Permission enforcement with a temporary read-only admin.
async function permissionTest() {
  const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const testEmail = `smoke-readonly-${Date.now()}@example.com`;
  const testPassword = `Smoke-${Date.now()}-aA1!`;
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (createError || !created.user) {
    record('read-only admin 403', false, `could not create test user: ${createError?.message}`);
    return;
  }
  const userId = created.user.id;
  try {
    const { error: grantError } = await service.from('platform_admins').insert({ user_id: userId, role: 'read_only', notes: 'temporary smoke test' });
    if (grantError) {
      record('read-only admin 403', false, `could not grant role: ${grantError.message}`);
      return;
    }
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: testAuth, error: signInError } = await client.auth.signInWithPassword({ email: testEmail, password: testPassword });
    if (signInError || !testAuth.session) {
      record('read-only admin 403', false, `could not sign in: ${signInError?.message}`);
      return;
    }
    const testCookie = `${cookieName}=base64-${Buffer.from(JSON.stringify(testAuth.session)).toString('base64url')}`;
    const allowed = await fetch(`${BASE}/api/admin/console/users`, { headers: { cookie: testCookie } });
    const plans = await fetch(`${BASE}/api/admin/console/plans`, { headers: { cookie: testCookie } });
    const forbidden = await fetch(`${BASE}/api/admin/console/settings`, { headers: { cookie: testCookie } });
    const write = await fetch(`${BASE}/api/admin/console/users`, {
      method: 'PATCH',
      headers: { cookie: testCookie, 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ action: 'suspend', id: firstUser?.id }),
    });
    const ticketWrite = await fetch(`${BASE}/api/admin/console/tickets`, {
      method: 'PATCH',
      headers: { cookie: testCookie, 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ action: 'resolve', id: '00000000-0000-0000-0000-000000000000' }),
    });
    record('read-only can read users', allowed.status === 200, `status=${allowed.status}`);
    record('read-only can read plans', plans.status === 200, `status=${plans.status}`);
    record('read-only cannot read settings', forbidden.status === 403, `status=${forbidden.status}`);
    record('read-only cannot write users', write.status === 403, `status=${write.status}`);
    record('read-only cannot write tickets', ticketWrite.status === 403, `status=${ticketWrite.status}`);
  } finally {
    await service.from('platform_admins').delete().eq('user_id', userId);
    await service.auth.admin.deleteUser(userId);
  }
}
await permissionTest();

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
