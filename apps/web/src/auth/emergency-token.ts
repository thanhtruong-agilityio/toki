import { EMERGENCY_TOKEN_PATTERN } from "@toki/shared";

// The token of an emergency link (TOKI-026 R41, R44). It is read from the fragment of the address
// once, kept in memory only and never written anywhere else. The fragment is removed from the address
// bar and the history entry before the page makes any request, so `location.href` holds the path
// alone. The token lives at module level, not in component state: React's strict mode renders twice
// and the second read would find the fragment gone.

type Win = {
  location: { hash: string; pathname: string; search: string };
  history: {
    state: unknown;
    replaceState(state: unknown, unused: string, url: string): void;
  };
};

let held: string | null = null;

/**
 * Reads the token from `location.hash` when there is a fragment, removes the fragment, and returns the
 * token held, or null when there is none or it is not 43 base64url characters (R41).
 */
export function takeFragmentToken(win: Win): string | null {
  const hash = win.location.hash;
  if (hash !== "") {
    const text = hash.startsWith("#") ? hash.slice(1) : hash;
    held = EMERGENCY_TOKEN_PATTERN.test(text) ? text : null;
    // The history state is passed through: the router keeps its own in it.
    win.history.replaceState(
      win.history.state,
      "",
      win.location.pathname + win.location.search,
    );
  }
  return held;
}

/** The token leaves memory after a final answer (R45). */
export function forgetToken(): void {
  held = null;
}
