import { namesFor } from "./names.js";
import { isInstant, zonedParts } from "./zone.js";

export interface DayWords {
  today: string;
  tomorrow: string;
  yesterday: string;
}

export interface DateContext {
  now: number;
  /** IANA name. */
  timeZone: string;
  /** 'en' or 'vi'; a code that is not listed gets the English names. */
  language: string;
}

export interface FormatContext extends DateContext {
  /** Read from i18n by the caller; required by formatDay and formatDateTime. */
  dayWords: DayWords;
}

export interface FormatDateOptions {
  weekday?: boolean;
  year?: "whenDifferent" | "always";
}

const DAY_MS = 86_400_000;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** R1: HH:mm in the zone. */
export function formatTime(at: number, timeZone: string): string | null {
  const parts = zonedParts(at, timeZone);
  return parts === null ? null : `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** R6: mm:ss below one hour, h:mm:ss from one hour. */
export function formatCountdown(ms: number): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  const total = ms > 0 ? Math.floor(ms / 1000) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`;
}

/** R2, R3: short weekday, day, short month, and the year when it differs. */
export function formatDate(at: number, ctx: DateContext, opts: FormatDateOptions = {}): string | null {
  if (!isInstant(ctx.now)) return null;
  const parts = zonedParts(at, ctx.timeZone);
  const today = zonedParts(ctx.now, ctx.timeZone);
  if (parts === null || today === null) return null;
  const names = namesFor(ctx.language);
  const weekday = names.weekdays[parts.weekday];
  const month = names.months[parts.month - 1];
  if (weekday === undefined || month === undefined) return null;
  const out: string[] = [];
  if (opts.weekday !== false) out.push(weekday);
  out.push(String(parts.day), month);
  if (opts.year === "always" || parts.year !== today.year) out.push(String(parts.year));
  return out.join(" ");
}

function dayNumber(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

function hasDayWords(words: unknown): words is DayWords {
  if (typeof words !== "object" || words === null) return false;
  const { today, tomorrow, yesterday } = words as Record<string, unknown>;
  return typeof today === "string" && typeof tomorrow === "string" && typeof yesterday === "string";
}

/** R4: a day word for yesterday, today and tomorrow, otherwise the date. */
export function formatDay(at: number, ctx: FormatContext): string | null {
  if (!hasDayWords(ctx.dayWords)) return null;
  const parts = zonedParts(at, ctx.timeZone);
  const today = isInstant(ctx.now) ? zonedParts(ctx.now, ctx.timeZone) : null;
  if (parts === null || today === null) return null;
  const difference =
    dayNumber(parts.year, parts.month, parts.day) - dayNumber(today.year, today.month, today.day);
  if (difference === 0) return ctx.dayWords.today;
  if (difference === 1) return ctx.dayWords.tomorrow;
  if (difference === -1) return ctx.dayWords.yesterday;
  return formatDate(at, ctx);
}

/** R5: the day, a space, the time. */
export function formatDateTime(at: number, ctx: FormatContext): string | null {
  const day = formatDay(at, ctx);
  const time = formatTime(at, ctx.timeZone);
  return day === null || time === null ? null : `${day} ${time}`;
}
