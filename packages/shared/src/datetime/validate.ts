import { isInstant, isValidTimeZone, resolveWallTime, zonedParts } from "./zone.js";

export type Reason = "required" | "invalid" | "past";
export type Failure = { ok: false; reason: Reason; field?: "date" | "time" };

const DATE_FORM = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_FORM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// A zone or a "now" that the code gives is a fault of the calling code, not of
// what a person typed, so it throws and is not one of the three reasons.
function assertEnv(now: number, timeZone: string): void {
  if (!isValidTimeZone(timeZone)) throw new RangeError(`Unknown time zone: ${JSON.stringify(timeZone)}`);
  if (!isInstant(now)) throw new RangeError(`"now" is not an instant: ${String(now)}`);
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "";
}

/** The day as year, month, day when `text` is a real YYYY-MM-DD, else null. */
function parseDate(text: string): { year: number; month: number; day: number } | null {
  const match = DATE_FORM.exec(text);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day);
  const real = check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  return real ? { year, month, day } : null;
}

/** R11 to R13: a date and a time typed as strings, in the zone of the person. */
export function validateDateTime(
  input: { date?: string | null; time?: string | null },
  env: { now: number; timeZone: string },
): { ok: true; at: number } | Failure {
  assertEnv(env.now, env.timeZone);
  if (isBlank(input.date)) return { ok: false, reason: "required", field: "date" };
  if (isBlank(input.time)) return { ok: false, reason: "required", field: "time" };
  const date = parseDate(input.date as string);
  if (date === null) return { ok: false, reason: "invalid", field: "date" };
  const time = TIME_FORM.exec(input.time as string);
  if (time === null) return { ok: false, reason: "invalid", field: "time" };

  const wall = new Date(0);
  wall.setUTCFullYear(date.year, date.month - 1, date.day);
  wall.setUTCHours(Number(time[1]), Number(time[2]), 0, 0);
  const resolved = resolveWallTime(wall.getTime(), env.timeZone);
  if (resolved === null || resolved.kind === "gap") return { ok: false, reason: "invalid", field: "time" };
  return resolved.at <= env.now ? { ok: false, reason: "past" } : { ok: true, at: resolved.at };
}

/** R14: the same rule for a value that is already an instant. */
export function validateFutureInstant(
  at: number | null | undefined,
  now: number,
): { ok: true; at: number } | Failure {
  if (!isInstant(now)) throw new RangeError(`"now" is not an instant: ${String(now)}`);
  if (at === null || at === undefined) return { ok: false, reason: "required" };
  if (!isInstant(at)) return { ok: false, reason: "invalid" };
  return at <= now ? { ok: false, reason: "past" } : { ok: true, at };
}

/** R15: a date without a time; the day of `now` is accepted. */
export function validateDateNotPast(
  date: string | null | undefined,
  env: { now: number; timeZone: string },
): { ok: true; date: string } | Failure {
  assertEnv(env.now, env.timeZone);
  if (isBlank(date)) return { ok: false, reason: "required" };
  const parsed = parseDate(date as string);
  if (parsed === null) return { ok: false, reason: "invalid" };
  const today = zonedParts(env.now, env.timeZone);
  if (today === null) throw new RangeError(`Cannot read the day of "now" in ${env.timeZone}`);
  const typed = parsed.year * 10_000 + parsed.month * 100 + parsed.day;
  const current = today.year * 10_000 + today.month * 100 + today.day;
  return typed < current ? { ok: false, reason: "past" } : { ok: true, date: date as string };
}
