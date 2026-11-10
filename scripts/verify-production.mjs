/**
 * End-to-end checks against the deployed app. Runs after a deploy.
 *
 * Usage: node scripts/verify-production.mjs
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE_URL ?? 'https://coldfox69.vercel.app';
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

function loadEnv() {
  const raw = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}

// ── 1. health ───────────────────────────────────────────────────
try {
  const res = await fetch(`${BASE}/api/health`);
  const body = await res.json();
  record('health endpoint', res.status === 200 && body.ok === true, `db=${body.checks?.database?.ok}`);
} catch (error) {
  record('health endpoint', false, error.message);
}

// ── 2. compression ──────────────────────────────────────────────
try {
  const res = await fetch(`${BASE}/api/health`, { headers: { 'accept-encoding': 'br, gzip' } });
  const encoding = res.headers.get('content-encoding');
  record('brotli/gzip compression', Boolean(encoding), `content-encoding=${encoding}`);
} catch (error) {
  record('brotli/gzip compression', false, error.message);
}

// ── 3. public page ──────────────────────────────────────────────
try {
  const res = await fetch(`${BASE}/`);
  const html = await res.text();
  record(
    'public home page',
    res.status === 200 && html.includes('ColdFox'),
    `${res.status}, ${Math.round(html.length / 1024)}KB`,
  );
} catch (error) {
  record('public home page', false, error.message);
}

// ── 4. security headers ─────────────────────────────────────────
try {
  const res = await fetch(`${BASE}/`);
  const headers = ['strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy'];
  const missing = headers.filter((h) => !res.headers.get(h));
  record('security headers', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'all present');
} catch (error) {
  record('security headers', false, error.message);
}

// ── 5. image optimization serves AVIF/WebP ──────────────────────
try {
  const res = await fetch(`${BASE}/_next/image?url=%2Flogo.png&w=640&q=75`, {
    headers: { accept: 'image/avif,image/webp,image/png,*/*' },
  });
  const type = res.headers.get('content-type');
  const typeOk = type === 'image/avif' || type === 'image/webp';
  record('image optimization (AVIF/WebP)', res.status === 200 && typeOk, `content-type=${type}`);
} catch (error) {
  record('image optimization (AVIF/WebP)', false, error.message);
}

// ── 6. hashed build output is cached indefinitely ──────────────
try {
  const page = await fetch(`${BASE}/`);
  const html = await page.text();
  const match = html.match(/src="(\/_next\/static\/[^"]+\.js)"/);
  if (!match) throw new Error('no static script reference found in the page');
  const res = await fetch(BASE + match[1]);
  const cache = res.headers.get('cache-control') ?? '';
  record(
    'static assets cached immutably',
    res.status === 200 && /max-age=31536000/.test(cache) && /immutable/.test(cache),
    `cache-control=${cache}`,
  );
} catch (error) {
  record('static assets cached immutably', false, error.message);
}

// ── 7. api responses are not cached ─────────────────────────────
try {
  const res = await fetch(`${BASE}/api/health`);
  const cache = res.headers.get('cache-control') ?? '';
  record('api responses not cached', /no-store/.test(cache), `cache-control=${cache}`);
} catch (error) {
  record('api responses not cached', false, error.message);
}

// ── 8. perf beacon accepts a report ────────────────────────────
try {
  const res = await fetch(`${BASE}/api/perf/beacon`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: '/verify', metric: 'LCP', value: 1234, rating: 'good' }),
  });
  const body = await res.json();
  record('performance beacon', res.status === 200 && body.ok === true);
} catch (error) {
  record('performance beacon', false, error.message);
}

// ── 9. cron routes require the secret ──────────────────────────
try {
  const worker = await fetch(`${BASE}/api/cron/worker`);
  const jobs = await fetch(`${BASE}/api/cron/jobs`);
  record('cron routes are protected', worker.status === 401 && jobs.status === 401, `${worker.status}/${jobs.status}`);
} catch (error) {
  record('cron routes are protected', false, error.message);
}

// ── 10. protected pages redirect when signed out ───────────────
try {
  const res = await fetch(`${BASE}/app`, { redirect: 'manual' });
  const location = res.headers.get('location') ?? '';
  record('signed-out /app redirects to login', res.status === 307 || location.includes('/login'), `status=${res.status} location=${location}`);
} catch (error) {
  record('signed-out /app redirects to login', false, error.message);
}

// ── 11. grouped count RPC ──────────────────────────────────────
try {
  const env = loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc('count_statuses', {
    p_table: 'campaigns',
    p_column: 'status',
    p_org: null,
    p_exclude_deleted: false,
  });
  record('grouped count function', !error && typeof data === 'object', JSON.stringify(data));
  const bad = await db.rpc('count_statuses', { p_table: 'pg_tables', p_column: 'tablename', p_org: null });
  record('grouped count rejects unknown tables', Boolean(bad.error), bad.error ? 'rejected' : 'NOT rejected');
} catch (error) {
  record('grouped count function', false, error.message);
}

// ── 12. job queue drain endpoint exists ────────────────────────
try {
  const res = await fetch(`${BASE}/api/cron/jobs`, { headers: { authorization: 'Bearer wrong-secret' } });
  record('job queue route exists', res.status === 401, `status=${res.status}`);
} catch (error) {
  record('job queue route exists', false, error.message);
}

// ── 13. real user metrics are being stored ─────────────────────
try {
  const env = loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data } = await db
    .from('web_vitals')
    .select('metric, value, path, created_at')
    .gte('created_at', new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5);
  const metrics = Array.from(new Set((data ?? []).map((row) => row.metric)));
  record('real user metrics stored', (data ?? []).length > 0, `last 36h: ${metrics.join(', ') || 'none'}`);
} catch (error) {
  record('real user metrics stored', false, error.message);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
