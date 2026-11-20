import { createEmergencyCalls, createSignInCalls } from "@toki/client-core";
import type { EmergencyCalls, SignInCalls, Timers } from "@toki/client-core";
import type { Clock } from "@toki/shared";
import { clock } from "../clock";
import { api, timers } from "../client";
import { toApiRequest } from "./request-adapter";

// What the sign-in wiring needs from outside: the calls, the clock and the timers. The app builds them
// once from the real parts; a test gives its own with `setAuthServices`.
//
// Every call goes through the one client of `client.ts`, whose hook reports each 401 with a session
// code to the session state (R39, R43; TOKI-032 R25).
export type AuthServices = {
  calls: SignInCalls;
  // The call of the emergency link page (TOKI-026): a public route.
  emergency: EmergencyCalls;
  clock: Clock;
  timers: Timers;
};

let current: AuthServices | undefined;

function build(): AuthServices {
  const request = toApiRequest(api);
  return {
    calls: createSignInCalls(request),
    emergency: createEmergencyCalls(request),
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
