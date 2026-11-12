/**
 * Verifies that every admin page actually renders for an authenticated admin,
 * instead of crashing with a server error. Uses the smoke credentials.
 */
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

const adminPages = [
  '/admin/organizations', '/admin/users', '/admin/leads', '/admin/campaigns', '/admin/mailboxes',
  '/admin/subscriptions', '/admin/plans', '/admin/billing', '/admin/tickets', '/admin/announcements',
  '/admin/analytics', '/admin/revenue', '/admin/system-health', '/admin/feature-flags', '/admin/settings',
  '/admin/jobs', '/admin/errors', '/admin/audit', '/admin/roles', '/admin/webhooks',
  '/admin/abuse', '/admin/email-activity', '/admin/ai-usage', '/admin/api-usage', '/admin/integrations',
  '/admin/ai-agents',
];

const results = [];
for (const page of adminPages) {
  const response = await fetch(`${BASE}${page}`, {
    headers: { cookie, accept: 'text/html' },
    redirect: 'follow',
  });
  const text = await response.text();
  const isErrorPage = /This page couldn't load|Internal Server Error|digest:/i.test(text);
  const hasContent = /The workspace|Search |Operations|All /i.test(text) || text.length > 1500;
  const ok = response.status === 200 && !isErrorPage;
  results.push({ page, ok, status: response.status, bytes: text.length, errorPage: isErrorPage });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${page} status=${response.status} bytes=${text.length}${isErrorPage ? ' ERROR-PAGE' : ''}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} admin pages render`);
if (failed.length) process.exit(1);
