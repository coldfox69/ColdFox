import fs from 'node:fs';

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
if (!env.CRON_SECRET) { console.error('CRON_SECRET missing'); process.exit(1); }

const worker = await fetch(`${BASE}/api/cron/worker`, {
  headers: { 'x-cron-secret': env.CRON_SECRET },
});
const workerBody = await worker.json();
console.log('worker status:', worker.status);
console.log('worker ok:', workerBody.ok, JSON.stringify(workerBody.data).slice(0, 400));

const unauth = await fetch(`${BASE}/api/cron/status`);
console.log('status unauth:', unauth.status);

const bad = await fetch(`${BASE}/api/cron/worker`, { headers: { 'x-cron-secret': 'wrong' } });
console.log('worker wrong secret:', bad.status);

const health = await fetch(`${BASE}/api/health`);
console.log('health:', health.status, JSON.stringify(await health.json()).slice(0, 300));
