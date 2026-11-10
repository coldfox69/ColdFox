const http = require('http');
const url = process.argv[2];
http.get(url, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    console.log('status', res.statusCode, 'bytes', body.length);
    for (const needle of ['dark:opacity-0', 'dark:opacity-100']) {
      const i = body.indexOf(needle);
      console.log(`\n--- ${needle} at ${i} ---`);
      if (i >= 0) {
        const start = Math.max(0, body.lastIndexOf('}', i));
        console.log(body.slice(start + 1, body.indexOf('}', i) + 1).trim());
      }
    }
  });
}).on('error', (e) => console.log('ERR', e.message));
