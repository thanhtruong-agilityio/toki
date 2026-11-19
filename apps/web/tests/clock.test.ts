import { afterEach, describe, expect, test, vi } from "vitest";
import { clock } from "../src/clock";

afterEach(() => {
  vi.useRealTimers();
});

describe("the web app's system clock (R45)", () => {
  test("now() is the system time in epoch milliseconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T05:06:07Z"));
    expect(clock.now()).toBe(Date.UTC(2026, 2, 4, 5, 6, 7));
    vi.advanceTimersByTime(1500);
    expect(clock.now()).toBe(Date.UTC(2026, 2, 4, 5, 6, 8, 500));
  });

  test("has now() only", () => {
    expect(Object.keys(clock)).toEqual(["now"]);
  });
});
