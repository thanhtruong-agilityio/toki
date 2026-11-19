import { describe, expect, it } from "vitest";
import { systemClock } from "../../src/clock/clock.js";
import {
  createTestClock,
  DEFAULT_TEST_INSTANT,
} from "../../src/clock/test-clock.js";

describe("test clock", () => {
  it("returns the fixed default instant until a test sets it (R8)", () => {
    expect(createTestClock().now()).toBe(Date.UTC(2026, 0, 1));
    expect(DEFAULT_TEST_INSTANT).toBe(Date.UTC(2026, 0, 1));
  });

  it("returns exactly the instant a test sets (R8)", () => {
    const clock = createTestClock();
    clock.set(1_700_000_000_000);
    expect(clock.now()).toBe(1_700_000_000_000);
  });

  it("moves by exactly the advanced duration (R9)", () => {
    const clock = createTestClock();
    clock.set(1_000);
    clock.advance(250);
    clock.advance(750);
    expect(clock.now()).toBe(2_000);
  });
});

describe("system clock", () => {
  it("reads epoch milliseconds", () => {
    const before = Date.now();
    const value = systemClock.now();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(Date.now());
  });
});
