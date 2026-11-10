/**
 * Measures real request latency against the deployed app so a cold start can
 * be compared against a warm one.
 *
 * Usage: node scripts/measure-latency.mjs [url] [rounds]
 */
const url = process.argv[2] ?? 'https://coldfox69.vercel.app/';
const rounds = Number(process.argv[3] ?? 5);

async function timeOnce(target) {
  const started = performance.now();
  const res = await fetch(target, {
    headers: { 'user-agent': 'coldfox-latency-probe', accept: 'text/html,*/*' },
    redirect: 'follow',
  });
  const reader = res.body?.getReader();
  let bytes = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
    }
  }
  return {
    status: res.status,
    ms: Math.round(performance.now() - started),
    ttfbHeader: res.headers.get('x-vercel-id') ?? null,
    serverTiming: res.headers.get('server-timing'),
    bytes,
  };
}

console.log(`target: ${url}`);
const results = [];
for (let i = 0; i < rounds; i += 1) {
  const r = await timeOnce(url);
  results.push(r);
  console.log(`  request ${i + 1}: ${r.status} ${r.ms}ms ${r.bytes}B ${r.serverTiming ?? ''}`);
  if (i < rounds - 1) await new Promise((r) => setTimeout(r, 500));
}

const times = results.map((r) => r.ms);
console.log(`min=${Math.min(...times)}ms max=${Math.max(...times)}ms avg=${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms`);
