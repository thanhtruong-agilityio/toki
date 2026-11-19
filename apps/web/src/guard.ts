import type { SessionState } from "@toki/client-core";

// The return address of R3: `next` is used only when it is a path of this app, else `/`. It starts
// with one `/` that is not followed by `/` or `\`, resolves to the app's own origin and is not `/login`.
export function returnAddress(next: unknown, origin: string): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next[1] === "/" || next[1] === "\\") return "/";
  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return "/";
  }
  if (url.origin !== origin || url.pathname === "/login") return "/";
  // A path such as `/.//x` normalises to `//x`, which a browser reads as another origin.
  const result = url.pathname + url.search + url.hash;
  if (result.startsWith("//") || result.startsWith("/\\")) return "/";
  return result;
}

export type GuardInput = {
  status: SessionState["status"];
  /** The app was shown at some point since the page was opened (a cover over it keeps it). */
  everSignedIn: boolean;
  pathname: string;
  /** The address showing: path, query and hash. */
  href: string;
  /** The `next` of the address, as it came. */
  next: unknown;
  /** The matched route carries the flag `public` (R40). */
  isPublic: boolean;
  origin: string;
};

export type GuardDecision =
  | { action: "wait" } // page background only (R44)
  | { action: "cover" } // page background only, under the modal of R26
  | { action: "allow" }
  | { action: "login"; next: string }
  | { action: "leave"; to: string };

// What the root route shows for a session state and an address (R1, R2, R40, R44).
export function decideGuard(input: GuardInput): GuardDecision {
  const { status, everSignedIn, pathname, href, next, isPublic, origin } =
    input;
  if (status === "unknown") return { action: "wait" };
  if (isPublic) return { action: "allow" };
  switch (status) {
    case "signedOut":
      return pathname === "/login"
        ? { action: "allow" }
        : { action: "login", next: href };
    case "signedIn":
      return pathname === "/login"
        ? { action: "leave", to: returnAddress(next, origin) }
        : { action: "allow" };
    case "ended":
      return everSignedIn ? { action: "allow" } : { action: "cover" };
  }
}
