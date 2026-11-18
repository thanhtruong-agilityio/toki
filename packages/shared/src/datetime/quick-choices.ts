import { assertEnv, atLocalTime } from "./zone.js";

export type QuickTimeId = "in1Hour" | "today1500" | "in3Hours" | "tomorrow0900";

const HOUR_MS = 3_600_000;

/**
 * R16: the choices of the reminder and snooze menus (D-114): an id and an
 * instant each. The labels are texts of the i18n catalogue, added by the
 * screens.
 */
export function quickTimeChoices(now: number, timeZone: string): { id: QuickTimeId; at: number }[] {
  assertEnv(now, timeZone);
  const today1500 = atLocalTime(now, timeZone, 0, "15:00");
  const tomorrow0900 = atLocalTime(now, timeZone, 1, "09:00");
  if (tomorrow0900 === null) throw new RangeError(`Cannot compute 09:00 tomorrow in ${timeZone}`);
  const second: { id: QuickTimeId; at: number } =
    today1500 !== null && today1500 > now
      ? { id: "today1500", at: today1500 }
      : { id: "in3Hours", at: now + 3 * HOUR_MS };
  return [{ id: "in1Hour", at: now + HOUR_MS }, second, { id: "tomorrow0900", at: tomorrow0900 }];
}
