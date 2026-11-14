/**
 * Time zone maths shared by the sending engine and the scheduling screens.
 *
 * This module is pure: it only uses `Intl`, so the exact same conversion runs
 * in the browser (to turn a picked date and time into UTC) and on the server
 * (to decide when the next send window opens). Keeping one implementation
 * avoids the wizard and the engine disagreeing about what "09:00" means.
 */

/** A short list of zones the pickers offer. Any other valid IANA zone still works. */
export const COMMON_TIMEZONES: string[] = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid',
  'Africa/Cairo', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka',
  'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Building an `Intl.DateTimeFormat` is expensive; the engine converts many
// timestamps in a row when it plans a campaign, so keep one per zone.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hour12: false,
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

/** True when `timeZone` is an IANA zone `Intl` can resolve. */
export function isValidTimeZone(timeZone: unknown): boolean {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return false;
  try {
    formatterFor(timeZone.trim());
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock parts of `date` in `timeZone`. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour') === '24' ? '0' : get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: WEEKDAYS[get('weekday')] ?? 1,
  };
}

/** The offset of `timeZone` from UTC at `date`, in milliseconds. */
export function timezoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

/** Convert a wall-clock time in `timeZone` to the matching UTC instant. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  // Two passes settle the offset across a DST change.
  for (let i = 0; i < 2; i += 1) {
    guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - timezoneOffsetMs(guess, timeZone));
  }
  return guess;
}

/** Read `HH:mm` (or `HH:mm:ss`), falling back to a default when unparseable. */
function parseClock(value: string, fallback: string) {
  const [h, m] = (value || fallback).slice(0, 5).split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : Number(fallback.slice(0, 2)), minute: Number.isFinite(m) ? m : 0 };
}

/**
 * The first instant a campaign may send.
 *
 * Returns `now` when it already falls inside today's window in `timeZone`,
 * otherwise the next opening. Weekends and other excluded weekdays are skipped
 * by looking up to ten days ahead; if nothing matches, `now` is returned so a
 * send is never scheduled into the past. A full week of excluded days is the
 * caller's problem, not a reason to stall forever.
 */
export function nextSendWindow(now: Date, timeZone: string, start: string, end: string, weekdays: number[]): Date {
  const startClock = parseClock(start, '09:00');
  const endClock = parseClock(end, '17:00');
  const days = weekdays.length ? weekdays : [1, 2, 3, 4, 5];
  for (let offset = 0; offset < 10; offset += 1) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const p = zonedParts(probe, timeZone);
    if (!days.includes(p.weekday)) continue;
    const windowStart = zonedTimeToUtc(p.year, p.month, p.day, startClock.hour, startClock.minute, timeZone);
    const windowEnd = zonedTimeToUtc(p.year, p.month, p.day, endClock.hour, endClock.minute, timeZone);
    if (now < windowStart) return windowStart;
    if (now >= windowStart && now < windowEnd) return now;
  }
  return now;
}

/**
 * Convert an `<input type="date">` value (`YYYY-MM-DD`) and an
 * `<input type="time">` value (`HH:mm`) in `timeZone` to a UTC `Date`.
 * Returns `null` for an invalid zone, malformed input, or a date that does not
 * exist (for example 31 February).
 */
export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!dateMatch || !timeMatch) return null;
  if (!isValidTimeZone(timeZone)) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const utc = zonedTimeToUtc(year, month, day, hour, minute, timeZone.trim());
  // A round trip catches dates that rolled over (31 February -> 3 March).
  const check = zonedParts(utc, timeZone.trim());
  if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour || check.minute !== minute) {
    return null;
  }
  return utc;
}
