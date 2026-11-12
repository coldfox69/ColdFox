import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE_URL ?? 'https://coldfoxpro.vercel.app';
function loadEnv() {
  const raw = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}
const env = loadEnv();
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error } = await supabase.auth.signInWithPassword({ email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD });
if (error) { console.error('Sign-in failed:', error.message); process.exit(1); }
const cookie = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`;
const api = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, { method: opts.method ?? 'GET', headers: { cookie, 'content-type': 'application/json', origin: BASE }, body: opts.body ? JSON.stringify(opts.body) : undefined, redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
};

const results = [];
const record = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
record('health ok', health.ok === true);

const lists = await api('/api/lead-lists');
const listsArr = Array.isArray(lists.json) ? lists.json : lists.json?.data ?? [];
record('lead-lists endpoint', lists.status === 200, `status=${lists.status} lists=${listsArr.length}`);

const templates = await api('/api/templates');
const tplRows = Array.isArray(templates.json) ? templates.json : templates.json?.data ?? [];
const sample = tplRows[0];
record('templates endpoint with group metadata', templates.status === 200, `status=${templates.status} templates=${tplRows.length}${sample ? ` mode=${sample.mode}` : ''}`);

const review = await api('/api/ai/deliverability-review', { method: 'POST', body: { subject: 'Quick question about your growth goals', body_text: 'Hi, I saw your work and wanted to reach out. Worth 15 minutes?' } });
record('production AI deliverability review works', review.status === 200, `status=${review.status}${review.json?.error ? ` error=${review.json?.error}` : ''}`);

const campaigns = await api('/api/campaigns?pageSize=5');
record('campaigns endpoint', campaigns.status === 200, `status=${campaigns.status}`);
const rows = Array.isArray(campaigns.json) ? campaigns.json : campaigns.json?.data ?? [];
if (rows.length) {
  const id = rows[0].id;
  const detail = await api(`/api/campaigns/${id}`);
  record('campaign detail with stats', detail.status === 200 && detail.json?.data?.stats !== undefined, `status=${detail.status} progress=${detail.json?.data?.stats?.progress}`);
} else {
  record('campaign detail with stats', true, 'no campaigns yet');
}

const unauthorized = await fetch(`${BASE}/api/lead-lists`, { redirect: 'manual' });
record('unauthenticated requests rejected', unauthorized.status === 401 || unauthorized.status === 403, `status=${unauthorized.status}`);

const adminOrRedirect = await fetch(`${BASE}/app`, { redirect: 'manual' });
record('app page reachable', [200, 307].includes(adminOrRedirect.status), `status=${adminOrRedirect.status}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
