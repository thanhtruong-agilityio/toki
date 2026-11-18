import { describe, expect, it } from "vitest";
import {
  atLocalTime,
  isValidTimeZone,
  MAX_INSTANT,
  utcOffsetMinutes,
  zonedParts,
} from "./zone.js";

const HCM = "Asia/Ho_Chi_Minh";
const NY = "America/New_York";
const AKL = "Pacific/Auckland";
const badInstants: number[] = [NaN, Infinity, -Infinity, Number(undefined), Number("2026-11-10T08:05:00Z"), MAX_INSTANT + 1, -MAX_INSTANT - 1];
const badZones = ["", "Mars/Phobos"];

describe("isValidTimeZone", () => {
  it("accepts a known zone and refuses anything else without throwing", () => {
    expect(isValidTimeZone(HCM)).toBe(true);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Mars/Phobos")).toBe(false);
    expect(isValidTimeZone(undefined as unknown as string)).toBe(false);
  });
});

describe("zonedParts", () => {
  it("reads the calendar parts in the zone", () => {
    expect(zonedParts(Date.UTC(2026, 10, 10, 8, 5, 7), HCM)).toEqual({
      year: 2026, month: 11, day: 10, hour: 15, minute: 5, second: 7, weekday: 2,
    });
  });

  it("shows midnight as hour 0, never 24", () => {
    expect(zonedParts(Date.UTC(2026, 10, 9, 17, 0, 0), HCM)).toMatchObject({ day: 10, hour: 0, minute: 0 });
  });

  it("works at the limits of Date and refuses beyond them", () => {
    expect(zonedParts(MAX_INSTANT, "UTC")).not.toBeNull();
    expect(zonedParts(MAX_INSTANT + 1, "UTC")).toBeNull();
  });

  it("returns null for a bad instant or a bad zone", () => {
    for (const at of badInstants) expect(zonedParts(at, HCM)).toBeNull();
    for (const zone of badZones) expect(zonedParts(0, zone)).toBeNull();
  });
});

describe("utcOffsetMinutes", () => {
  it("returns the offset east positive", () => {
    expect(utcOffsetMinutes(Date.UTC(2026, 0, 15, 12), HCM)).toBe(420);
    expect(utcOffsetMinutes(Date.UTC(2026, 0, 15, 12), "Asia/Kolkata")).toBe(330);
    expect(utcOffsetMinutes(Date.UTC(2026, 0, 15, 12), NY)).toBe(-300);
    expect(utcOffsetMinutes(Date.UTC(2026, 6, 15, 12), NY)).toBe(-240);
  });

  it("returns null for a bad instant or a bad zone", () => {
    for (const at of badInstants) expect(utcOffsetMinutes(at, HCM)).toBeNull();
    for (const zone of badZones) expect(utcOffsetMinutes(0, zone)).toBeNull();
  });
});

describe("atLocalTime", () => {
  const now = Date.UTC(2026, 10, 10, 3, 0); // 10:00 on 10 Nov in HCM

  it("returns 09:00 today and tomorrow in the zone", () => {
    expect(atLocalTime(now, HCM, 0, "09:00")).toBe(Date.UTC(2026, 10, 10, 2, 0));
    expect(atLocalTime(now, HCM, 1, "09:00")).toBe(Date.UTC(2026, 10, 11, 2, 0));
  });

  it("returns the first instant after a gap (clock set forward)", () => {
    // New York, 8 Mar 2026: 02:00 became 03:00 (07:00Z)
    expect(atLocalTime(Date.UTC(2026, 2, 8, 5, 0), NY, 0, "02:30")).toBe(Date.UTC(2026, 2, 8, 7, 0));
    // Auckland, 27 Sep 2026: 02:00 became 03:00 (14:00Z on the 26th)
    expect(atLocalTime(Date.UTC(2026, 8, 26, 12, 0), AKL, 0, "02:30")).toBe(Date.UTC(2026, 8, 26, 14, 0));
  });

  it("returns the earlier instant when a time occurs twice (clock set back)", () => {
    // New York, 1 Nov 2026: 01:30 EDT (05:30Z) then 01:30 EST (06:30Z)
    expect(atLocalTime(Date.UTC(2026, 10, 1, 4, 0), NY, 0, "01:30")).toBe(Date.UTC(2026, 10, 1, 5, 30));
    // Auckland, 5 Apr 2026: 02:30 NZDT (13:30Z on the 4th) then 02:30 NZST
    expect(atLocalTime(Date.UTC(2026, 3, 4, 11, 0), AKL, 0, "02:30")).toBe(Date.UTC(2026, 3, 4, 13, 30));
  });

  it("returns null for a time that is not a real HH:mm", () => {
    for (const time of ["24:00", "9:5", "tomorrow", "", "12:60"]) expect(atLocalTime(now, HCM, 0, time)).toBeNull();
    expect(atLocalTime(now, HCM, NaN, "09:00")).toBeNull();
  });

  it("returns null for a bad now or a bad zone", () => {
    for (const bad of badInstants) expect(atLocalTime(bad, HCM, 0, "09:00")).toBeNull();
    for (const zone of badZones) expect(atLocalTime(now, zone, 0, "09:00")).toBeNull();
  });
});
