import { createSignInCalls, reportUnauthenticated } from "@toki/client-core";
import type { SignInCalls } from "@toki/client-core";
import type { Clock } from "@toki/shared";
import { clock } from "../clock";
import { createFetchApi } from "./fetch-api";
import { timers, type Timers } from "./timers";

// What the sign-in wiring needs from outside: the calls, the clock and the timers. The app builds them
// once from the real parts; a test gives its own with `setAuthServices`.
//
// `calls` report every 401 to the session state through the hook (R39, R43). `openCalls` do not: the
// read when Toki is opened reports for itself, because on a route with the flag `public` any 401 means
// no session and no modal (R40). With the shared client of TOKI-032 this split goes (step 7).
export type AuthServices = {
  calls: SignInCalls;
  openCalls: SignInCalls;
  clock: Clock;
  timers: Timers;
};

let current: AuthServices | undefined;

function build(): AuthServices {
  return {
    calls: createSignInCalls(
      createFetchApi({ timers, onUnauthenticated: reportUnauthenticated }),
    ),
    openCalls: createSignInCalls(createFetchApi({ timers })),
    clock,
    timers,
  };
}

export function getAuthServices(): AuthServices {
  current ??= build();
  return current;
}

// For tests: give the parts, or `undefined` to go back to the real ones.
export function setAuthServices(services: AuthServices | undefined): void {
  current = services;
}
