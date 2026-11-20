import { ApiError } from "./errors";

export type ErrorScreen =
  | "unauthenticated"
  | "field"
  | "no_access"
  | "fresh_copy"
  | "wait"
  | "retry"
  | "unreadable"
  | "ignore"
  | "unknown";

// The three codes of a 401 that end a session (TOKI-022 R24, R27).
export const SESSION_CODES = [
  "unauthenticated",
  "session_ended",
  "account_deactivated",
] as const;

export function isSessionCode(code: string | null): boolean {
  return code !== null && (SESSION_CODES as readonly string[]).includes(code);
}

// Which kind of screen an error leads to (D-131). It reads the status and the
// kind, and the code only to tell the three session codes from other 401s.
export function classifyApiError(error: unknown): ErrorScreen {
  if (!(error instanceof ApiError)) return "unknown";
  switch (error.kind) {
    case "aborted":
      return "ignore";
    case "invalid_response":
      return "unreadable";
    case "network":
    case "timeout":
      return "retry";
    case "http":
      break;
  }
  const status = error.status;
  if (status === null) return "unknown";
  if (status === 401)
    return isSessionCode(error.code) ? "unauthenticated" : "unknown";
  if (status === 400) return "field";
  if (status === 403 || status === 404) return "no_access";
  if (status === 409 || status === 410) return "fresh_copy";
  if (status === 429) return "wait";
  if (status >= 500) return "retry";
  return "unknown";
}
