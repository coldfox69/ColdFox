/**
 * CSV cell escaping.
 *
 * Besides the RFC 4180 quoting rules, this neutralises formula injection:
 * spreadsheet apps evaluate a cell that starts with `=`, `+`, `@`, a tab or a
 * carriage return, so a lead field could otherwise run a formula when an
 * exported file is opened. A leading `'` keeps the value as literal text.
 * A plain negative number (`-42`) is left alone because it is not a formula.
 */

const FORMULA_PREFIX = /^[=+@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const dangerous = FORMULA_PREFIX.test(raw) || (raw.startsWith('-') && !PLAIN_NUMBER.test(raw));
  const text = dangerous ? `'${raw}` : raw;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
