import { describe, expect, it } from 'vitest';
import { isValidTimeZone, zonedDateTimeToUtc, zonedParts, zonedTimeToUtc } from '@/lib/timezone';

describe('timezone helpers', () => {
  it('recognises valid IANA zones only', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });

  it('reads the wall clock of a zone', () => {
    const parts = zonedParts(new Date('2026-07-15T12:00:00Z'), 'America/New_York');
    expect(parts).toMatchObject({ year: 2026, month: 7, day: 15, hour: 8, minute: 0 });
  });

  it('converts winter time in New York to UTC', () => {
    const utc = zonedTimeToUtc(2026, 1, 15, 9, 0, 'America/New_York');
    expect(utc.toISOString()).toBe('2026-01-15T14:00:00.000Z');
  });

  it('converts summer time in New York to UTC', () => {
    const utc = zonedTimeToUtc(2026, 7, 15, 9, 0, 'America/New_York');
    expect(utc.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it('converts a picked date and time in the chosen zone', () => {
    const utc = zonedDateTimeToUtc('2026-07-15', '09:30', 'Asia/Dhaka');
    expect(utc?.toISOString()).toBe('2026-07-15T03:30:00.000Z');
  });

  it('rejects malformed input, impossible dates and unknown zones', () => {
    expect(zonedDateTimeToUtc('15/07/2026', '09:30', 'UTC')).toBeNull();
    expect(zonedDateTimeToUtc('2026-02-31', '09:30', 'UTC')).toBeNull();
    expect(zonedDateTimeToUtc('2026-07-15', '09:30', 'Nowhere/Invalid')).toBeNull();
    expect(zonedDateTimeToUtc('2026-07-15', '25:00', 'UTC')).toBeNull();
  });
});
