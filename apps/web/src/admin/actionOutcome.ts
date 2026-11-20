import { ApiError } from "@toki/client-core";
import { ErrorCodes } from "@toki/shared";

// What the Admin page does with the error of a request (TOKI-025 R19, R20, R22). One place, so a
// change of rule is made once and tested as a table.
//
// - forbidden: 403, the person is no longer an Admin: the no-access view.
// - session: 401, the session modal of TOKI-023 shows and the page does nothing more.
// - stale: the page was out of date (a 409 of the four codes below, or a 404): close, reload, say so.
//   A 404 of an action on one row means that the person or the invitation has vanished, not that the
//   Admin lost access, so it is not the no-access view (R19).
// - inProgress: 409 request_in_progress, the same key is still running on the server.
// - aborted: the request was cancelled (the page went away): nothing to show.
// - failed: everything else.
export type ActionOutcome =
  "forbidden" | "session" | "stale" | "inProgress" | "aborted" | "failed";

const STALE_CONFLICTS: readonly string[] = [
  ErrorCodes.lastAdmin,
  ErrorCodes.selfTarget,
  ErrorCodes.invitationUsed,
  ErrorCodes.invitationRevoked,
];

export function actionOutcome(error: unknown): ActionOutcome {
  if (!(error instanceof ApiError)) return "failed";
  if (error.kind === "aborted") return "aborted";
  if (error.kind !== "http") return "failed";
  if (error.status === 403) return "forbidden";
  if (error.status === 401) return "session";
  if (error.status === 404) return "stale";
  if (error.status === 409) {
    if (error.code === ErrorCodes.requestInProgress) return "inProgress";
    if (error.code !== null && STALE_CONFLICTS.includes(error.code))
      return "stale";
  }
  return "failed";
}

// Whether the next press of the same button sends the same key: after a timeout, a network error, a
// 5xx, a 409 request_in_progress and an answer that could not be read (the server may have done the
// work, so a new key could do it twice). Any other error drops the key (R20, R22).
export function keepsKey(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  switch (error.kind) {
    case "timeout":
    case "network":
    case "invalid_response":
      return true;
    case "http":
      return (
        (error.status !== null && error.status >= 500) ||
        (error.status === 409 && error.code === ErrorCodes.requestInProgress)
      );
    case "aborted":
      return false;
  }
}
