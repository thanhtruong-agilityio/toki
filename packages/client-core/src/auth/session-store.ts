// The session state of the web app (TOKI-023, R39). It holds one value and tells listeners when it changes.
// It touches no storage, no address and no timer, and it empties no store: the screens react to it.

import type { User } from "@toki/shared";

// The user of the session is the shared `User` (TOKI-022); kept under its name for the callers.
export type SessionUser = User;

export type SessionState =
  | { status: "unknown" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: SessionUser }
  | { status: "ended"; reason: "expired" | "deactivated" };

export type SessionStore = {
  getSessionState(): SessionState;
  subscribeSession(listener: () => void): () => void;
  reportUnauthenticated(code: string): void;
  markSignedOut(): void;
  markSignedIn(user: SessionUser): void;
};

const SIGNED_OUT: SessionState = { status: "signedOut" };
const ENDED_EXPIRED: SessionState = { status: "ended", reason: "expired" };
const ENDED_DEACTIVATED: SessionState = {
  status: "ended",
  reason: "deactivated",
};

// A store of its own, so a test starts from `unknown`; the app uses the one below.
export function createSessionStore(): SessionStore {
  let state: SessionState = { status: "unknown" };
  const listeners = new Set<() => void>();

  function set(next: SessionState): void {
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener();
  }

  return {
    getSessionState: () => state,
    subscribeSession(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    // A 401 answer. Row by row of the state table; a state that is already signed out or ended stays,
    // so many refusals show one modal (R27).
    reportUnauthenticated(code) {
      const deactivated = code === "account_deactivated";
      if (
        !deactivated &&
        code !== "unauthenticated" &&
        code !== "session_ended"
      ) {
        return;
      }
      if (state.status === "unknown") {
        set(deactivated ? ENDED_DEACTIVATED : SIGNED_OUT);
      } else if (state.status === "signedIn") {
        set(deactivated ? ENDED_DEACTIVATED : ENDED_EXPIRED);
      }
    },
    markSignedOut() {
      if (state.status !== "signedOut") set(SIGNED_OUT);
    },
    markSignedIn(user) {
      set({ status: "signedIn", user });
    },
  };
}

const store = createSessionStore();

export const getSessionState = store.getSessionState;
export const subscribeSession = store.subscribeSession;
export const reportUnauthenticated = store.reportUnauthenticated;
export const markSignedOut = store.markSignedOut;
export const markSignedIn = store.markSignedIn;
