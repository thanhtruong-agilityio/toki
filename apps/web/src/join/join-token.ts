import { INVITATION_TOKEN_PATTERN } from "@toki/shared";

// The token of a Join link (TOKI-097 R26, R43, R48). The link is `<origin>/join#<token>`: the token is
// in the fragment, which no server, proxy log or `Referer` sees. The page takes it from the address
// once, when the page document loads and before the router starts; it keeps it in a variable of this
// module (not storage, not router state) and removes the fragment from the address bar and the history
// entry with `history.replaceState`. A reload loses it: the page shows the unrecognised link and the
// person presses Join in the mail again (R48).

type Win = {
  location: { hash: string; pathname: string; search: string };
  history: {
    state: unknown;
    replaceState(state: unknown, unused: string, url: string): void;
  };
};

let held: string | null = null;
let taken = false;

/**
 * Reads the token from `location.hash` on the Join path, removes the fragment, and holds the token if
 * it is 43 base64url characters. Another path is left alone: its fragment belongs to its own page (the
 * emergency link). It reads the address once: a second call changes nothing.
 */
export function captureJoinToken(win: Win): void {
  if (taken || win.location.pathname !== "/join") return;
  const hash = win.location.hash;
  if (hash === "") return;
  taken = true;
  const text = hash.startsWith("#") ? hash.slice(1) : hash;
  held = INVITATION_TOKEN_PATTERN.test(text) ? text : null;
  // The history state is passed through: the router keeps its own in it.
  win.history.replaceState(
    win.history.state,
    "",
    win.location.pathname + win.location.search,
  );
}

/** The token held, or null when the address had none or one of the wrong shape. */
export function getJoinToken(): string | null {
  return held;
}
