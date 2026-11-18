import { describe, expect, it } from "vitest";
import { formatCountdown, formatDate, formatDateTime, formatDay, formatTime, type DateContext, type FormatContext } from "./format.js";
import { NAMES } from "./names.js";

const HCM = "Asia/Ho_Chi_Minh";
const words = { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday" };
// Tue 10 Nov 2026, 12:00 in Ho Chi Minh
const now = Date.UTC(2026, 10, 10, 5, 0);
const ctx: FormatContext = { now, timeZone: HCM, language: "en", dayWords: words };
const dateCtx: DateContext = { now, timeZone: HCM, language: "en" };

describe("formatTime", () => {
  it("writes HH:mm in the zone", () => {
    expect(formatTime(Date.UTC(2026, 10, 10, 8, 5), HCM)).toBe("15:05");
    expect(formatTime(Date.UTC(2026, 0, 15, 12, 0), "Asia/Kolkata")).toBe("17:30");
  });

  it("writes midnight as 00:00 and 23:59 as 23:59", () => {
    expect(formatTime(Date.UTC(2026, 10, 9, 17, 0), HCM)).toBe("00:00");
    expect(formatTime(Date.UTC(2026, 10, 10, 16, 59), HCM)).toBe("23:59");
  });

  it("never holds AM, PM or 24:", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(formatTime(Date.UTC(2026, 5, 1, hour, 7), "UTC")).not.toMatch(/AM|PM|24:/);
    }
  });
});

describe("formatCountdown", () => {
  it.each([
    [0, "00:00"],
    [-5000, "00:00"],
    [999, "00:00"],
    [65_000, "01:05"],
    [3_599_000, "59:59"],
    [3_600_000, "1:00:00"],
    [3_725_000, "1:02:05"],
  ])("%d ms gives %s", (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });

  it("gives null for a value that is not a finite number", () => {
    for (const bad of [NaN, Infinity, -Infinity, Number(undefined)]) expect(formatCountdown(bad)).toBeNull();
  });
});

describe("formatDate", () => {
  it("writes weekday, day and month", () => {
    expect(formatDate(Date.UTC(2026, 10, 10, 8, 0), dateCtx)).toBe("Tue 10 Nov");
    expect(formatDate(Date.UTC(2026, 10, 10, 8, 0), dateCtx, { weekday: false })).toBe("10 Nov");
  });

  it("adds the year when it differs from the year of now, read in the zone", () => {
    const from2027 = { ...dateCtx, now: Date.UTC(2027, 0, 5, 5, 0) };
    expect(formatDate(Date.UTC(2026, 11, 31, 5, 0), from2027)).toBe("Thu 31 Dec 2026");
    expect(formatDate(Date.UTC(2027, 0, 1, 5, 0), dateCtx)).toBe("Fri 1 Jan 2027");
  });

  it("reads both years in the zone, not in UTC", () => {
    // 18:00Z on 31 Dec is already 1 Jan 01:00 in Ho Chi Minh
    const at = Date.UTC(2026, 11, 31, 18, 0);
    expect(formatDate(at, { ...dateCtx, now: Date.UTC(2026, 11, 31, 16, 0) })).toBe("Fri 1 Jan 2027");
    expect(formatDate(at, { ...dateCtx, now: Date.UTC(2026, 11, 31, 18, 0) })).toBe("Fri 1 Jan");
  });

  it('shows the year in every case with year: "always"', () => {
    expect(formatDate(Date.UTC(2026, 10, 10, 8, 0), dateCtx, { year: "always" })).toBe("Tue 10 Nov 2026");
  });

  it("takes a context without day words and also a full FormatContext", () => {
    expect(formatDate(Date.UTC(2026, 10, 16, 2, 0), dateCtx)).toBe("Mon 16 Nov");
    expect(formatDate(Date.UTC(2026, 10, 16, 2, 0), ctx)).toBe("Mon 16 Nov");
  });
});

describe("formatDay and formatDateTime", () => {
  it("writes Today, Tomorrow and Yesterday, otherwise the date", () => {
    expect(formatDay(Date.UTC(2026, 10, 10, 8, 0), ctx)).toBe("Today");
    expect(formatDay(Date.UTC(2026, 10, 11, 2, 0), ctx)).toBe("Tomorrow");
    expect(formatDay(Date.UTC(2026, 10, 9, 11, 20), ctx)).toBe("Yesterday");
    expect(formatDay(Date.UTC(2026, 10, 16, 2, 0), ctx)).toBe("Mon 16 Nov");
  });

  it("compares calendar days, not 24 hours", () => {
    const lateNow = { ...ctx, now: Date.UTC(2026, 10, 10, 16, 30) }; // 23:30 in the zone
    expect(formatDay(lateNow.now + 40 * 60_000, lateNow)).toBe("Tomorrow");
    expect(formatDay(lateNow.now - 23 * 3_600_000, lateNow)).toBe("Today");
    expect(formatDay(lateNow.now - 24 * 3_600_000, lateNow)).toBe("Yesterday");
  });

  it("writes the five examples of R5", () => {
    expect(formatDateTime(Date.UTC(2026, 10, 10, 8, 0), ctx)).toBe("Today 15:00");
    expect(formatDateTime(Date.UTC(2026, 10, 11, 2, 0), ctx)).toBe("Tomorrow 09:00");
    expect(formatDateTime(Date.UTC(2026, 10, 9, 11, 20), ctx)).toBe("Yesterday 18:20");
    expect(formatDateTime(Date.UTC(2026, 10, 16, 2, 0), ctx)).toBe("Mon 16 Nov 09:00");
    expect(formatDateTime(Date.UTC(2027, 0, 1, 2, 0), ctx)).toBe("Fri 1 Jan 2027 09:00");
  });

  it("gives null when a day word is missing", () => {
    const broken = { ...ctx, dayWords: { today: "Today" } } as unknown as FormatContext;
    expect(formatDay(now, broken)).toBeNull();
    expect(formatDateTime(now, broken)).toBeNull();
  });
});

describe("bad values (R7, R8)", () => {
  const badNumbers = [NaN, Infinity, -Infinity, Number(undefined), Number("2026-11-10T08:05:00Z"), 8.64e15 + 1];
  const badZones = ["", "Mars/Phobos"];
  const at = Date.UTC(2026, 10, 10, 8, 0);

  it("returns null for a bad instant, a bad now or a bad zone, in every function", () => {
    for (const bad of badNumbers) {
      expect(formatTime(bad, HCM)).toBeNull();
      expect(formatDate(bad, dateCtx)).toBeNull();
      expect(formatDay(bad, ctx)).toBeNull();
      expect(formatDateTime(bad, ctx)).toBeNull();
      expect(formatDate(at, { ...dateCtx, now: bad })).toBeNull();
      expect(formatDay(at, { ...ctx, now: bad })).toBeNull();
      expect(formatDateTime(at, { ...ctx, now: bad })).toBeNull();
    }
    for (const zone of badZones) {
      expect(formatTime(at, zone)).toBeNull();
      expect(formatDate(at, { ...dateCtx, timeZone: zone })).toBeNull();
      expect(formatDay(at, { ...ctx, timeZone: zone })).toBeNull();
      expect(formatDateTime(at, { ...ctx, timeZone: zone })).toBeNull();
    }
  });

  it("never returns a string with Invalid Date, NaN or undefined", () => {
    const results: (string | null)[] = [];
    for (const bad of [...badNumbers, at]) {
      for (const zone of [...badZones, HCM]) {
        results.push(formatTime(bad, zone), formatDate(bad, { ...dateCtx, timeZone: zone }), formatDateTime(bad, { ...ctx, timeZone: zone }));
        results.push(formatDate(at, { ...dateCtx, now: bad, timeZone: zone }), formatCountdown(bad));
      }
    }
    for (const result of results) {
      if (result !== null) expect(result).not.toMatch(/Invalid Date|NaN|undefined/);
    }
  });

  it("uses only the day words, the names of Table B, digits, spaces and colons", () => {
    const marked = { ...ctx, dayWords: { today: "T1", tomorrow: "T2", yesterday: "T3" } };
    const instants = [
      Date.UTC(2026, 10, 10, 8, 0), Date.UTC(2026, 10, 11, 2, 0), Date.UTC(2026, 10, 9, 11, 20),
      Date.UTC(2026, 10, 16, 2, 0), Date.UTC(2027, 0, 1, 2, 0), Date.UTC(2024, 1, 29, 12, 0),
    ];
    const names = [...(NAMES.en?.weekdays ?? []), ...(NAMES.en?.months ?? [])];
    for (const instant of instants) {
      for (const text of [formatDay(instant, marked), formatDateTime(instant, marked), formatDate(instant, marked)]) {
        let rest = text ?? "";
        for (const word of ["T1", "T2", "T3", ...names]) rest = rest.split(word).join("");
        expect(rest).toMatch(/^[0-9 :]*$/);
      }
    }
  });

  it("gives the same results for a language that is not listed", () => {
    for (const language of ["vi", "fr", ""]) {
      expect(formatDateTime(Date.UTC(2026, 10, 16, 2, 0), { ...ctx, language })).toBe("Mon 16 Nov 09:00");
    }
  });
});

describe("a string given where an instant is wanted (R7)", () => {
  // The caller must convert with Date.parse first; a string, even an ISO 8601
  // one, is never read as an instant.
  const iso = "2026-11-10T08:05:00Z" as unknown as number;
  const at = Date.UTC(2026, 10, 10, 8, 0);

  it("returns null in every numeric place of every function", () => {
    expect(formatTime(iso, HCM)).toBeNull();
    expect(formatDate(iso, dateCtx)).toBeNull();
    expect(formatDay(iso, ctx)).toBeNull();
    expect(formatDateTime(iso, ctx)).toBeNull();
    expect(formatDate(at, { ...dateCtx, now: iso })).toBeNull();
    expect(formatDay(at, { ...ctx, now: iso })).toBeNull();
    expect(formatDateTime(at, { ...ctx, now: iso })).toBeNull();
    expect(formatCountdown(iso)).toBeNull();
  });
});
