/**
 * Checks that the AI agent pages render for a signed-in user.
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
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error } = await supabase.auth.signInWithPassword({ email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD });
if (error || !auth.session) {
  console.error('Sign-in failed:', error?.message);
  process.exit(1);
}
const cookie = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`;

const pages = [
  { path: '/app/agents', expect: ['AI agents', 'Shopify lead generation'] },
  { path: '/app/agents/shopify-lead-generation', expect: ['Shopify lead generation', 'Target country', 'Run immediately', 'Schedule for later'] },
  { path: '/app/automations', expect: ['Automations', 'AI agents', 'Start task'] },
  { path: '/admin/ai-agents', expect: ['AI agents'] },
];

const failures = [];
for (const page of pages) {
  const response = await fetch(`${BASE}${page.path}`, { headers: { cookie, accept: 'text/html' } });
  const text = await response.text();
  const isErrorPage = /This page couldn't load|Internal Server Error|digest:/i.test(text);
  const missing = page.expect.filter((needle) => !text.includes(needle));
  const ok = response.status === 200 && !isErrorPage && missing.length === 0;
  if (!ok) failures.push(page.path);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${page.path} status=${response.status} bytes=${text.length}${isErrorPage ? ' ERROR-PAGE' : ''}${missing.length ? ` missing=${missing.join(', ')}` : ''}`);
}

console.log(`\n${failures.length === 0 ? 'All agent pages render' : `${failures.length} page(s) failed`}`);
if (failures.length) process.exit(1);
