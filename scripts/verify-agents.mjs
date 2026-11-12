/**
 * End to end check of the AI agents feature.
 *
 * Covers the user path (list, detail, start a task, follow the run) and the
 * admin path (catalog, credential storage). The agent itself has no API yet,
 * so the run is expected to stop with a clear "not connected" message instead
 * of inventing leads.
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

const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: env.SMOKE_EMAIL,
  password: env.SMOKE_PASSWORD,
});
if (authError || !auth.session) {
  console.error('Sign-in failed:', authError?.message);
  process.exit(1);
}
const cookie = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`;
const asUser = (path, init = {}) => fetch(`${BASE}${path}`, { ...init, headers: { cookie, ...(init.headers ?? {}) } });

// ── user path ──────────────────────────────────────────────────────
const list = await asUser('/api/agents').then((r) => r.json());
const agents = list?.data?.agents ?? [];
check(Array.isArray(agents) && agents.length > 0, 'agent catalog is visible to the user panel', `agents=${agents.length}`);
const shopify = agents.find((agent) => agent.slug === 'shopify-lead-generation');
check(Boolean(shopify), 'the published agent shows up in the list', shopify?.name);
check(shopify?.supportsOutreach === true, 'the agent can hand over to the outreach pipeline');

const detail = await asUser('/api/agents/shopify-lead-generation').then((r) => r.json());
const agent = detail?.data?.agent;
check(Boolean(agent), 'agent detail loads');
check(Array.isArray(agent?.fields) && agent.fields.length > 0, 'the input schema is returned', `fields=${agent?.fields?.length}`);
check(agent?.fields?.some((field) => field.required), 'required fields are marked');

const missing = await asUser('/api/agents/shopify-lead-generation/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ inputs: { niche: 'apparel' }, mode: 'now' }),
});
const missingBody = await missing.json();
check(missing.status === 422, 'a missing required field is rejected', `status=${missing.status} ${missingBody?.error ?? ''}`);

const started = await asUser('/api/agents/shopify-lead-generation/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputs: { country: 'United States', niche: 'apparel', audience: 'store owners', keywords: 'shopify store', lead_limit: 10 },
    mode: 'now',
    outreach: { enabled: false },
  }),
});
const startedBody = await started.json();
check(started.status === 202, 'a task can be started', `status=${started.status} ${startedBody?.error ?? ''}`);
const runId = startedBody?.data?.id;

if (runId) {
  // The background worker picks the task up. Give it a moment.
  let status = 'queued';
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const run = await asUser(`/api/agents/runs/${runId}`).then((r) => r.json());
    status = run?.data?.run?.status;
    if (['succeeded', 'failed', 'awaiting_api', 'cancelled'].includes(status)) break;
  }
  check(status === 'awaiting_api', 'the task stops with a clear message while no API is connected', `status=${status}`);
  const run = await asUser(`/api/agents/runs/${runId}`).then((r) => r.json());
  check(/not connected/i.test(String(run?.data?.run?.error ?? '')), 'the message says the API is missing', String(run?.data?.run?.error).slice(0, 80));
}

// ── admin path ─────────────────────────────────────────────────────
const adminList = await asUser('/api/admin/console/ai-agents').then((r) => r.json());
check(adminList?.ok === true, 'the admin console lists the agents', `rows=${adminList?.data?.rows?.length}`);
check((adminList?.data?.rows ?? []).some((row) => row.slug === 'shopify-lead-generation'), 'the seeded agent is in the console');

const agentId = adminList?.data?.rows?.find((row) => row.slug === 'shopify-lead-generation')?.id;
const adminAgent = await asUser(`/api/admin/agents/${agentId}`).then((r) => r.json());
check(adminAgent?.ok === true, 'the agent editor loads the agent', `fields=${adminAgent?.data?.agent?.fields?.length}`);
check(adminAgent?.data?.agent?.apiConfigured === false, 'no API key is stored yet');

const testKey = 'cf-test-key-do-not-use-1234';
const setKey = await asUser(`/api/admin/agents/${agentId}/credential`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ api_key: testKey }),
});
check(setKey.status === 200, 'an admin can store an API key');

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: stored } = await db.from('ai_agent_credentials').select('encrypted_payload').eq('agent_id', agentId).maybeSingle();
check(Boolean(stored?.encrypted_payload), 'the key is stored in the database');
check(!String(stored?.encrypted_payload ?? '').includes(testKey), 'the key is not stored in plain text');

const afterSet = await asUser(`/api/admin/agents/${agentId}`).then((r) => r.json());
check(afterSet?.data?.agent?.apiConfigured === true, 'the console only reports that a key exists');
check(!JSON.stringify(afterSet?.data ?? {}).includes(testKey), 'the key is never sent back to the browser');

const removeKey = await asUser(`/api/admin/agents/${agentId}/credential`, { method: 'DELETE' });
check(removeKey.status === 200, 'an admin can remove the API key');
const { data: afterRemove } = await db.from('ai_agent_credentials').select('agent_id').eq('agent_id', agentId).maybeSingle();
check(!afterRemove, 'the key is gone from the database');

console.log(`\n${failures.length === 0 ? 'All checks passed' : `${failures.length} check(s) failed: ${failures.join(', ')}`}`);
if (failures.length) process.exit(1);
