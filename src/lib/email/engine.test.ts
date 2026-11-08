import { describe, it, expect } from 'vitest';

function parseClock(value: string, fallback: string) {
  const [h, m] = (value || fallback).slice(0, 5).split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : Number(fallback.slice(0, 2)), minute: Number.isFinite(m) ? m : 0 };
}

function nextSendWindowUTC(now: Date, start: string, end: string, weekdays: number[]): Date {
  const startClock = parseClock(start, '09:00');
  const endClock = parseClock(end, '17:00');
  const days = weekdays.length ? weekdays : [1, 2, 3, 4, 5];
  for (let offset = 0; offset < 10; offset += 1) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const day = probe.getUTCDay();
    if (!days.includes(day)) continue;
    const windowStart = new Date(Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth(), probe.getUTCDate(), startClock.hour, startClock.minute, 0));
    const windowEnd = new Date(Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth(), probe.getUTCDate(), endClock.hour, endClock.minute, 0));
    if (now < windowStart) return windowStart;
    if (now >= windowStart && now < windowEnd) return now;
  }
  return now;
}

describe('engine scheduling helpers', () => {
  it('nextSendWindow returns now when within window', () => {
    const now = new Date('2026-11-09T12:00:00Z'); // Monday UTC
    const result = nextSendWindowUTC(now, '09:00', '17:00', [1, 2, 3, 4, 5]);
    expect(result.getTime()).toBe(now.getTime());
  });

  it('nextSendWindow returns next window start when before window', () => {
    const now = new Date('2026-11-09T08:00:00Z'); // Before 09:00
    const result = nextSendWindowUTC(now, '09:00', '17:00', [1, 2, 3, 4, 5]);
    expect(result.getTime()).toBeGreaterThan(now.getTime());
    expect(result.getUTCHours()).toBe(9);
  });

  it('nextSendWindow skips weekends', () => {
    const now = new Date('2026-11-07T12:00:00Z'); // Saturday
    const result = nextSendWindowUTC(now, '09:00', '17:00', [1, 2, 3, 4, 5]);
    expect(result.getUTCDay()).toBe(1); // Monday
    expect(result.getUTCHours()).toBe(9);
  });
});
