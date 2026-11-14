import { describe, it, expect } from 'vitest';
import { nextSendWindow } from '@/lib/timezone';

describe('nextSendWindow', () => {
  it('returns now when it is already inside the window', () => {
    const now = new Date('2026-11-09T12:00:00Z'); // Monday 12:00 UTC
    const result = nextSendWindow(now, 'UTC', '09:00', '17:00', [1, 2, 3, 4, 5]);
    expect(result.getTime()).toBe(now.getTime());
  });

  it('returns the next opening when it is before the window', () => {
    const now = new Date('2026-11-09T08:00:00Z'); // Monday 08:00 UTC
    const result = nextSendWindow(now, 'UTC', '09:00', '17:00', [1, 2, 3, 4, 5]);
    expect(result.toISOString()).toBe('2026-11-09T09:00:00.000Z');
  });

  it('waits for the next day when the window has closed', () => {
    const now = new Date('2026-11-09T18:00:00Z'); // Monday after 17:00
    const result = nextSendWindow(now, 'UTC', '09:00', '17:00', [1, 2, 3, 4, 5]);
    expect(result.toISOString()).toBe('2026-11-10T09:00:00.000Z');
  });

  it('skips weekends', () => {
    const now = new Date('2026-11-07T12:00:00Z'); // Saturday
    const result = nextSendWindow(now, 'UTC', '09:00', '17:00', [1, 2, 3, 4, 5]);
    expect(result.getUTCDay()).toBe(1); // Monday
    expect(result.getUTCHours()).toBe(9);
  });

  it('uses the campaign timezone, not UTC', () => {
    // Monday 04:00 UTC is 10:00 in Asia/Dhaka, inside a 09:00-17:00 Dhaka window.
    const now = new Date('2026-11-09T04:00:00Z');
    const result = nextSendWindow(now, 'Asia/Dhaka', '09:00', '17:00', [1, 2, 3, 4, 5]);
    expect(result.getTime()).toBe(now.getTime());

    // Monday 02:00 UTC is 08:00 in Dhaka, before the window: it opens at 03:00 UTC.
    const early = new Date('2026-11-09T02:00:00Z');
    expect(nextSendWindow(early, 'Asia/Dhaka', '09:00', '17:00', [1, 2, 3, 4, 5]).toISOString()).toBe('2026-11-09T03:00:00.000Z');
  });

  it('handles daylight saving time in the chosen zone', () => {
    // July: New York is UTC-4, so 09:00 local is 13:00 UTC.
    const summer = new Date('2026-07-15T10:00:00Z');
    expect(nextSendWindow(summer, 'America/New_York', '09:00', '17:00', [1, 2, 3, 4, 5]).toISOString()).toBe('2026-07-15T13:00:00.000Z');
    // January: New York is UTC-5, so 09:00 local is 14:00 UTC.
    const winter = new Date('2026-01-15T10:00:00Z');
    expect(nextSendWindow(winter, 'America/New_York', '09:00', '17:00', [1, 2, 3, 4, 5]).toISOString()).toBe('2026-01-15T14:00:00.000Z');
  });

  it('falls back to Monday-Friday when no weekdays are given', () => {
    const now = new Date('2026-11-08T12:00:00Z'); // Sunday
    const result = nextSendWindow(now, 'UTC', '09:00', '17:00', []);
    expect(result.toISOString()).toBe('2026-11-09T09:00:00.000Z');
  });

  it('never schedules into the past when no day matches', () => {
    const now = new Date('2026-11-09T12:00:00Z'); // Monday
    const result = nextSendWindow(now, 'UTC', '09:00', '17:00', [0]); // Sundays only
    expect(result.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });
});
