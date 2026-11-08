#!/usr/bin/env node
/**
 * Applies versioned SQL migrations through the Supabase Management API.
 * Statements are sent individually (the API rejects large batches).
 * Tracks applied files in public.schema_migrations. Re-runnable.
 *
 * Usage: npm run db:migrate
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  } catch {}
  return env;
}

const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.');
  process.exit(1);
}

const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function query(sql) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${text.slice(0, 2000)}`);
    err.sql = sql;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

/** Splits SQL on semicolons, respecting dollar quotes, strings and comments. */
export function splitStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  let single = false;
  let lineComment = false;
  let blockComment = false;
  let dollar = null;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      buf += ch;
      if (ch === '\n') lineComment = false;
      i++;
      continue;
    }
    if (blockComment) {
      buf += ch;
      if (ch === '*' && next === '/') { buf += next; i += 2; blockComment = false; continue; }
      i++;
      continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) { buf += dollar; i += dollar.length; dollar = null; continue; }
      buf += ch; i++; continue;
    }
    if (single) {
      buf += ch;
      if (ch === "'" && next === "'") { buf += next; i += 2; continue; }
      if (ch === "'") single = false;
      i++;
      continue;
    }
    if (ch === '-' && next === '-') { buf += ch + next; i += 2; lineComment = true; continue; }
    if (ch === '/' && next === '*') { buf += ch + next; i += 2; blockComment = true; continue; }
    if (ch === "'") { buf += ch; single = true; i++; continue; }
    if (ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) { dollar = m[0]; buf += dollar; i += dollar.length; continue; }
    }
    if (ch === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.trim() && !buf.trim().split('\n').every((l) => l.trim().startsWith('--') || !l.trim())) {
    out.push(buf.trim());
  }
  return out;
}

async function main() {
  await query(`create table if not exists public.schema_migrations (
    filename text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  );`);

  const dir = join(root, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Map(
    (await query('select filename, checksum from public.schema_migrations order by filename;')).map((r) => [r.filename, r.checksum]),
  );

  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    if (applied.get(file) === checksum) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const statements = splitStatements(sql);
    console.log(`apply ${file} (${statements.length} statements)`);
    for (let idx = 0; idx < statements.length; idx++) {
      try {
        await query(statements[idx]);
      } catch (e) {
        console.error(`\nFAILED in ${file} statement ${idx + 1}:`);
        console.error(statements[idx].slice(0, 800));
        console.error('\n', e.message);
        process.exit(1);
      }
    }
    await query(
      `insert into public.schema_migrations (filename, checksum) values ('${file.replace(/'/g, "''")}', '${checksum}')
       on conflict (filename) do update set checksum = excluded.checksum, applied_at = now();`,
    );
  }
  console.log('\nAll migrations applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
