import { describe, expect, it } from 'vitest';
import { escapeCsvCell } from '@/lib/csv';

describe('escapeCsvCell', () => {
  it('leaves an ordinary value unchanged', () => {
    expect(escapeCsvCell('Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('neutralises values a spreadsheet would treat as a formula', () => {
    expect(escapeCsvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(escapeCsvCell('+1+1')).toBe("'+1+1");
    expect(escapeCsvCell('@import')).toBe("'@import");
    expect(escapeCsvCell('\tcmd')).toBe("'\tcmd");
    expect(escapeCsvCell('\rcmd')).toBe("\"'\rcmd\"");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
  });

  it('keeps plain numbers, including negative ones', () => {
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(-42)).toBe('-42');
    expect(escapeCsvCell('-1.5')).toBe('-1.5');
  });

  it('renders null and undefined as an empty cell', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });
});
