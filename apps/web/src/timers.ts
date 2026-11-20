import type { Timers } from "@toki/client-core";

// The one place of the web app that calls a global timer (TOKI-032 R25).
// `client-core` takes `timers` as a parameter and calls no timer function of
// its own (TOKI-008 R19), so the app lends this one.
export type TimerHost = {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

const globalHost: TimerHost = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as number),
};

// `after(ms, fn)` calls `fn` once after `ms` milliseconds and returns the way
// to cancel it.
export function createTimers(host: TimerHost = globalHost): Timers {
  return {
    after(ms, fn) {
      const handle = host.setTimeout(fn, ms);
      return () => host.clearTimeout(handle);
    },
  };
}
