import {
  getSessionState,
  markSignedIn,
  markSignedOut,
  reportUnauthenticated,
} from "@toki/client-core";
import { getAuthServices } from "./services";

let started = false;

// The read of the session when Toki is opened (R1, R2, R26, R40). It runs once per page. A 401 on a
// route with the flag `public` is no session whatever its code, with no modal (R40); elsewhere it is
// reported as R1 and R26 say. A read that fails to connect or to answer leaves the state `unknown`:
// no spec text says what to show then (reported on the PR).
export async function readSessionOnOpen(isPublic: boolean): Promise<void> {
  if (started) return;
  started = true;
  const result = await getAuthServices().openCalls.readSession();
  if (getSessionState().status !== "unknown") return;
  if (result.kind === "ok") markSignedIn(result.user);
  else if (result.kind === "unauthenticated") {
    if (isPublic) markSignedOut();
    else reportUnauthenticated(result.code);
  }
}

// For tests: the page is opened again.
export function resetSessionOnOpen(): void {
  started = false;
}
