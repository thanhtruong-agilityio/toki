import {
  getSessionState,
  subscribeSession,
  type SessionUser,
} from "@toki/client-core";

// Two facts about this page's life that the root route needs after the state has left `signedIn`:
// whether the app was ever shown (a cover over it keeps it; a cover when Toki is opened shows the page
// background only, R26) and who the last person was (their email is filled in by 'Sign in again', R25).
let everSignedIn = false;
let lastUser: SessionUser | null = null;

function note(): void {
  const state = getSessionState();
  if (state.status === "signedIn") {
    everSignedIn = true;
    lastUser = state.user;
  }
}
note();
subscribeSession(note);

export const sessionMemory = {
  get everSignedIn() {
    return everSignedIn;
  },
  get lastUser() {
    return lastUser;
  },
  // For tests: the page is opened again.
  reset() {
    everSignedIn = false;
    lastUser = null;
    note();
  },
};
