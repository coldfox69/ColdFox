import fs from 'node:fs';

const targets = ['https://coldfox69.vercel.app/api/diag-bare', 'https://coldfox69.vercel.app/api/diag'];
const rounds = Number(process.argv[2] ?? 2);

async function hit(target) {
  const started = performance.now();
  const res = await fetch(target, { headers: { 'user-agent': 'coldfox-coldstart-probe' } });
  const body = await res.json().catch(() => null);
  return {
    path: new URL(target).pathname,
    ms: Math.round(performance.now() - started),
    serverTiming: res.headers.get('server-timing'),
    body,
  };
}

for (let i = 0; i < rounds; i += 1) {
  for (const target of targets) {
    const r = await hit(target);
    console.log(`${r.path}  ${r.ms}ms  server-timing=${r.serverTiming}  body=${JSON.stringify(r.body)}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}
