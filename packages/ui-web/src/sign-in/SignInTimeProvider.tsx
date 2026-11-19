import { createContext, useContext, type ReactNode } from "react";
import type { Clock } from "@toki/shared";

// What wakes a screen up: `after(ms, fn)` calls `fn` once after `ms`
// milliseconds and returns the way to cancel it. The clock has `now()` only.
export type SignInTimers = {
  after(ms: number, fn: () => void): () => void;
};

export type SignInTime = { clock: Clock; timers: SignInTimers };

const Context = createContext<SignInTime | null>(null);

// Every wait of the sign-in screens reads the time from `clock.now()` and is
// woken by `timers.after` (R45); no file here calls a global timer.
export function SignInTimeProvider(
  props: SignInTime & { children?: ReactNode },
) {
  const { children, clock, timers } = props;
  return (
    <Context.Provider value={{ clock, timers }}>{children}</Context.Provider>
  );
}

export function useSignInTime(): SignInTime {
  const value = useContext(Context);
  if (value === null) throw new Error("SignInTimeProvider is missing");
  return value;
}
