import { describe, expect, it } from "vitest";
import { validateDateNotPast, validateDateTime, validateFutureInstant } from "./validate.js";

const HCM = "Asia/Ho_Chi_Minh";
// Tue 10 Nov 2026, 12:00 in Ho Chi Minh
const now = Date.UTC(2026, 10, 10, 5, 0);
const env = { now, timeZone: HCM };

describe("validateDateTime", () => {
  it("returns required for an empty field, naming the first empty one", () => {
    expect(validateDateTime({ date: "", time: "09:00" }, env)).toEqual({ ok: false, reason: "required", field: "date" });
    expect(validateDateTime({ date: "2026-11-11", time: "   " }, env)).toEqual({ ok: false, reason: "required", field: "time" });
    expect(validateDateTime({ date: null, time: undefined }, env)).toEqual({ ok: false, reason: "required", field: "date" });
    expect(validateDateTime({}, env)).toEqual({ ok: false, reason: "required", field: "date" });
  });

  it("returns invalid for a field that is not a real date or time", () => {
    for (const date of ["2026-02-30", "2026-13-01", "tomorrow", "2026-1-1"]) {
      expect(validateDateTime({ date, time: "09:00" }, env)).toEqual({ ok: false, reason: "invalid", field: "date" });
    }
    for (const time of ["24:00", "9:5", "tomorrow", "12:60"]) {
      expect(validateDateTime({ date: "2026-11-11", time }, env)).toEqual({ ok: false, reason: "invalid", field: "time" });
    }
  });

  it("returns required before invalid when one field is empty and the other bad", () => {
    expect(validateDateTime({ date: "", time: "nope" }, env)).toMatchObject({ reason: "required", field: "date" });
  });

  it("rejects a time equal to or before now and accepts one minute after", () => {
    expect(validateDateTime({ date: "2026-11-10", time: "11:59" }, env)).toEqual({ ok: false, reason: "past" });
    expect(validateDateTime({ date: "2026-11-10", time: "12:00" }, env)).toEqual({ ok: false, reason: "past" });
    expect(validateDateTime({ date: "2026-11-10", time: "12:01" }, env)).toEqual({ ok: true, at: Date.UTC(2026, 10, 10, 5, 1) });
  });

  it("reports a time that does not exist (clock set forward) as invalid for the time", () => {
    const result = validateDateTime({ date: "2026-03-08", time: "02:30" }, { now: Date.UTC(2026, 2, 1), timeZone: "America/New_York" });
    expect(result).toEqual({ ok: false, reason: "invalid", field: "time" });
  });

  it("takes the earlier instant of a time that occurs twice (clock set back)", () => {
    const result = validateDateTime({ date: "2026-11-01", time: "01:30" }, { now: Date.UTC(2026, 9, 31), timeZone: "America/New_York" });
    expect(result).toEqual({ ok: true, at: Date.UTC(2026, 10, 1, 5, 30) });
  });

  it("throws a RangeError that names an unknown zone", () => {
    expect(() => validateDateTime({ date: "2026-11-11", time: "09:00" }, { now, timeZone: "Mars/Phobos" })).toThrow(/Mars\/Phobos/);
    expect(() => validateDateTime({ date: "2026-11-11", time: "09:00" }, { now, timeZone: "Mars/Phobos" })).toThrow(RangeError);
  });
});

describe("validateFutureInstant", () => {
  it("returns required, invalid, past or the instant", () => {
    expect(validateFutureInstant(null, now)).toEqual({ ok: false, reason: "required" });
    expect(validateFutureInstant(undefined, now)).toEqual({ ok: false, reason: "required" });
    expect(validateFutureInstant(NaN, now)).toEqual({ ok: false, reason: "invalid" });
    expect(validateFutureInstant(Infinity, now)).toEqual({ ok: false, reason: "invalid" });
    expect(validateFutureInstant(now - 1, now)).toEqual({ ok: false, reason: "past" });
    expect(validateFutureInstant(now, now)).toEqual({ ok: false, reason: "past" });
    expect(validateFutureInstant(now + 1, now)).toEqual({ ok: true, at: now + 1 });
  });
});

describe("validateDateNotPast", () => {
  // 01:00 on 11 Nov in Ho Chi Minh, while the UTC date is still 10 Nov
  const lateEnv = { now: Date.UTC(2026, 10, 10, 18, 0), timeZone: HCM };

  it("rejects yesterday, accepts today and tomorrow in the zone of the person", () => {
    expect(validateDateNotPast("2026-11-10", lateEnv)).toEqual({ ok: false, reason: "past" });
    expect(validateDateNotPast("2026-11-11", lateEnv)).toEqual({ ok: true, date: "2026-11-11" });
    expect(validateDateNotPast("2026-11-12", lateEnv)).toEqual({ ok: true, date: "2026-11-12" });
  });

  it("returns required and invalid", () => {
    expect(validateDateNotPast("", lateEnv)).toEqual({ ok: false, reason: "required" });
    expect(validateDateNotPast(null, lateEnv)).toEqual({ ok: false, reason: "required" });
    expect(validateDateNotPast("2026-02-30", lateEnv)).toEqual({ ok: false, reason: "invalid" });
  });
});
