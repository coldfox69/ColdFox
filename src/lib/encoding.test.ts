import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), 'src');
// Pattern built from escapes so this test file stays ASCII-clean.
const MOJIBAKE = new RegExp(['\\u00c2', '\\u00e2', '\\u00ef\\u00bf\\u00bd'].join('|'), 'u');

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|js|jsx|css|md)$/.test(entry.name)) yield full;
  }
}

const offenders: string[] = [];
for (const file of walk(root)) {
  if (MOJIBAKE.test(fs.readFileSync(file, 'utf8'))) offenders.push(file);
}

describe('source encoding', () => {
  it('contains no double-encoded mojibake', () => {
    expect(offenders).toEqual([]);
  });
});
