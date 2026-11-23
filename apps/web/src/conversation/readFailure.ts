import { classifyApiError } from "@toki/client-core";

// What the screen does with a failed read or write (R14, D-131):
// - "no_access": the person is not or no longer a member (403, 404); the page draws the not-found view;
// - "none": the client's own hook or an aborted request handles it, this panel does nothing;
// - "unreadable": the answer does not fit the schema, a repeat fails the same way, so no Retry;
// - "retry": every other kind; the text and a Retry that reads again.
export type FailureView = "no_access" | "none" | "unreadable" | "retry";

export function readFailure(error: unknown): FailureView {
  switch (classifyApiError(error)) {
    case "no_access":
      return "no_access";
    case "unauthenticated":
    case "ignore":
      return "none";
    case "unreadable":
      return "unreadable";
    default:
      return "retry";
  }
}
