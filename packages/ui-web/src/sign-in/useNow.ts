import { useEffect, useState } from "react";
import { useSignInTime } from "./SignInTimeProvider";

// The time now, read from the clock, and a wake-up at the next of `deadlines`
// that is still ahead, set through `timers.after` (R45). When it fires the
// component renders again and the next deadline is set. Nothing here calls a
// global timer or reads the system time.
export function useNow(deadlines: ReadonlyArray<number | null>): number {
  const { clock, timers } = useSignInTime();
  const [tick, setTick] = useState(0);
  const now = clock.now();
  let next: number | null = null;
  for (const deadline of deadlines) {
    if (
      deadline !== null &&
      deadline > now &&
      (next === null || deadline < next)
    )
      next = deadline;
  }
  useEffect(() => {
    if (next === null) return;
    return timers.after(Math.max(0, next - clock.now()), () =>
      setTick((n) => n + 1),
    );
  }, [next, tick, timers, clock]);
  return now;
}

// Whole minutes left, rounded up (R19): 1 s and 60 s are 1 minute, 61 s is 2.
export function minutesLeft(untilMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((untilMs - nowMs) / 60000));
}

// The instant the rounded-up minutes next change: when what is left falls to
// the previous whole minute (or to nothing, for the last one).
export function nextMinuteChange(untilMs: number, nowMs: number): number {
  return untilMs - (minutesLeft(untilMs, nowMs) - 1) * 60000;
}

// True when the device asks for reduced motion (R33). The query is guarded:
// a browser without matchMedia, or a test, has no such preference.
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
