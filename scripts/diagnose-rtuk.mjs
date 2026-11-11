import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: await r.text() };
}

console.log('campaign rtuk:', (await query("select * from public.campaigns where name='rtuk' order by created_at desc limit 1")).body);
console.log('execs:', (await query("select e.id, e.status, e.provider_message_id, e.error, e.personalized, e.variant_id, e.finished_at, e.attempts from public.campaign_executions e join public.campaigns c on c.id=e.campaign_id where c.name='rtuk' order by finished_at desc limit 3")).body);
console.log('msg:', (await query("select m.id, m.from_email, m.from_name, m.to_emails, m.subject, length(m.body_text) body_len, length(m.body_html) html_len, m.provider_message_id, m.sent_at from public.email_messages m join public.campaigns c on c.id=m.campaign_id where c.name='rtuk' order by m.created_at desc limit 3")).body);
console.log('mailbox:', (await query("select mb.id, mb.provider, mb.status, mb.email_address, mb.display_name, mb.daily_limit, mb.sent_today, mb.last_error, mb.reputation from public.mailboxes mb join public.campaigns c on c.mailbox_id=mb.id where c.name='rtuk'")).body);
console.log('body_text:', (await query("select left(m.body_text, 1500) body from public.email_messages m join public.campaigns c on c.id=m.campaign_id where c.name='rtuk' order by m.created_at desc limit 1")).body);
