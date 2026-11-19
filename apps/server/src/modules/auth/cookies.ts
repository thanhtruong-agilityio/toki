import { SESSION_IDLE_DAYS } from "@toki/shared";

// The one cookie of a session (R21). In production it carries the __Host-
// prefix, which makes a browser refuse it unless it is Secure, has Path=/ and
// no Domain: another host of the domain cannot set or overwrite it.
export const COOKIE_MAX_AGE_SECONDS = SESSION_IDLE_DAYS * 24 * 60 * 60;

// Only an explicit "development" is development; a missing or unknown value
// counts as production (R21).
export function isDevelopment(env: string | undefined): boolean {
  return env === "development";
}

export function cookieName(development: boolean): string {
  return development ? "toki_session" : "__Host-toki_session";
}

// The value of the one cookie called `name`. Other names are ignored, the
// first of two equal names wins, and a malformed pair is skipped.
export function readCookie(
  header: string | undefined,
  name: string,
): string | null {
  if (!header) return null;
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    if (pair.slice(0, index).trim() !== name) continue;
    const value = pair.slice(index + 1).trim();
    return value === "" ? null : value;
  }
  return null;
}

function attributes(development: boolean, maxAge: number): string {
  return `Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${development ? "" : "; Secure"}`;
}

export function sessionCookie(value: string, development: boolean): string {
  return `${cookieName(development)}=${value}; ${attributes(development, COOKIE_MAX_AGE_SECONDS)}`;
}

export function clearedCookie(development: boolean): string {
  return `${cookieName(development)}=; ${attributes(development, 0)}`;
}
