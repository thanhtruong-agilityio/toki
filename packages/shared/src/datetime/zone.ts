// Time zone arithmetic. Every function takes the zone as an argument and
// reads no clock and no ambient setting (R17). Intl is used only to read
// numbers (formatToParts); no text it produces reaches a result.

/** Largest instant a Date can hold, in epoch milliseconds. */
export const MAX_INSTANT = 8_640_000_000_000_000;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

export interface ZonedParts {
  year: number;
  /** 1 to 12 */
  month: number;
  day: number;
  /** 0 to 23 */
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday to 6 = Saturday */
  weekday: number;
}

export function isInstant(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MAX_INSTANT;
}

// A cache of formatters, one per zone. It holds no setting: the key is the
// zone name and the value never changes.
const formatters = new Map<string, Intl.DateTimeFormat | null>();

function formatterFor(timeZone: unknown): Intl.DateTimeFormat | null {
  if (typeof timeZone !== "string" || timeZone === "") return null;
  const cached = formatters.get(timeZone);
  if (cached !== undefined) return cached;
  let formatter: Intl.DateTimeFormat | null;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
  } catch {
    formatter = null;
  }
  formatters.set(timeZone, formatter);
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  return formatterFor(timeZone) !== null;
}

const WEEKDAYS: Readonly<Record<string, number>> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(at: number, timeZone: string): ZonedParts | null {
  if (!isInstant(at)) return null;
  const formatter = formatterFor(timeZone);
  if (formatter === null) return null;
  const read: Record<string, string> = {};
  for (const part of formatter.formatToParts(at)) read[part.type] = part.value;
  const weekday = WEEKDAYS[read.weekday ?? ""];
  if (weekday === undefined) return null;
  return {
    year: Number(read.year),
    month: Number(read.month),
    day: Number(read.day),
    hour: Number(read.hour) % 24,
    minute: Number(read.minute),
    second: Number(read.second),
    weekday,
  };
}

/** The wall clock of the parts, written as if it were UTC. */
function wallOf(parts: ZonedParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

/** Offset of the zone from UTC at the instant, in minutes, east positive. */
export function utcOffsetMinutes(at: number, timeZone: string): number | null {
  const parts = zonedParts(at, timeZone);
  if (parts === null) return null;
  const whole = Math.floor(at / 1000) * 1000;
  return (wallOf(parts) - whole) / MINUTE_MS;
}

export type WallTime = { kind: "ok"; at: number } | { kind: "gap"; at: number };

/**
 * The instant at which the wall clock of the zone shows `wall` (a wall clock
 * written as if it were UTC). Occurs twice (clock set back): the earlier
 * instant. Does not occur (clock set forward): kind "gap", with the first
 * instant after the gap. Returns null for a bad zone or a wall time out of
 * range.
 */
export function resolveWallTime(wall: number, timeZone: string): WallTime | null {
  if (!isInstant(wall - DAY_MS) || !isInstant(wall + DAY_MS)) return null;
  const before = utcOffsetMinutes(wall - DAY_MS, timeZone);
  const after = utcOffsetMinutes(wall + DAY_MS, timeZone);
  if (before === null || after === null) return null;

  const valid: number[] = [];
  for (const offset of new Set([before, after])) {
    const candidate = wall - offset * MINUTE_MS;
    const parts = zonedParts(candidate, timeZone);
    if (parts !== null && wallOf(parts) === wall) valid.push(candidate);
  }
  const first = valid.length > 0 ? Math.min(...valid) : null;
  if (first !== null) return { kind: "ok", at: first };

  // The wall time does not exist: the offset grew between the two samples.
  // Find the first instant that already has the later offset.
  const later = Math.max(before, after);
  let low = wall - later * MINUTE_MS; // still has the earlier offset
  let high = wall - Math.min(before, after) * MINUTE_MS; // has the later offset
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    if (utcOffsetMinutes(middle, timeZone) === later) high = middle;
    else low = middle;
  }
  return { kind: "gap", at: high };
}

const TIME_FORM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * The instant at which the wall clock in `timeZone` shows `time` (HH:mm) on
 * the day `dayOffset` days after the day of `now` (R10).
 */
export function atLocalTime(now: number, timeZone: string, dayOffset: number, time: string): number | null {
  if (!Number.isInteger(dayOffset)) return null;
  const match = typeof time === "string" ? TIME_FORM.exec(time) : null;
  const today = zonedParts(now, timeZone);
  if (match === null || today === null) return null;
  const wall = Date.UTC(today.year, today.month - 1, today.day + dayOffset, Number(match[1]), Number(match[2]));
  const resolved = resolveWallTime(wall, timeZone);
  return resolved !== null && isInstant(resolved.at) ? resolved.at : null;
}
