import type { Clock } from "./clock.js";

// 2026-01-01T00:00:00Z: the same on every run, so a test that never sets the
// clock is repeatable.
export const DEFAULT_TEST_INSTANT = Date.UTC(2026, 0, 1);

export interface TestClock extends Clock {
  /** Moves the clock to this instant, in epoch milliseconds. */
  set(instant: number): void;
  /** Moves the clock forward by this many milliseconds. */
  advance(milliseconds: number): void;
}

export function createTestClock(): TestClock {
  let current = DEFAULT_TEST_INSTANT;
  return {
    now: () => current,
    set: (instant) => {
      current = instant;
    },
    advance: (milliseconds) => {
      current += milliseconds;
    },
  };
}
