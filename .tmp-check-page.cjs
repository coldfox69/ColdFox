const http = require('http');
const url = process.argv[2] || 'http://localhost:3000/';
http.get(url, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    console.log('status', res.statusCode, 'bytes', body.length);
    const imgs = [...body.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
    console.log('img count:', imgs.length);
    imgs.filter((i) => /logo/i.test(i)).forEach((i) => console.log('  ', i));
    const styles = [...body.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
    const all = styles.join('\n');
    console.log('style blocks:', styles.length, 'chars', all.length);
    console.log('has .dark\\:opacity-0:', /\.dark\\:opacity-0/.test(all) || all.includes('dark:opacity-0'));
    const idx = all.indexOf('dark:opacity-0');
    if (idx >= 0) console.log('  rule:', all.slice(idx - 40, idx + 60).replace(/\n/g, ' '));
    const cssLinks = [...body.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0]);
    console.log('css links:', cssLinks);
  });
}).on('error', (e) => console.log('ERR', e.message));
