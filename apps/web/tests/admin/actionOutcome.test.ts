import { ApiError, type ApiErrorInit } from "@toki/client-core";
import { describe, expect, it } from "vitest";
import {
  actionOutcome,
  keepsKey,
  type ActionOutcome,
} from "../../src/admin/actionOutcome";

const http = (status: number, code: string): ApiErrorInit => ({
  kind: "http",
  status,
  code,
});

// Every condition of R19 and R22: what the page does and whether a retry keeps its key.
const TABLE: Array<[string, ApiErrorInit, ActionOutcome, boolean]> = [
  [
    "403 means the person is no longer an Admin",
    http(403, "forbidden"),
    "forbidden",
    false,
  ],
  [
    "401 is the session modal's business",
    http(401, "unauthenticated"),
    "session",
    false,
  ],
  [
    "404 not_found: the page was out of date",
    http(404, "not_found"),
    "stale",
    false,
  ],
  [
    "404 invitation_not_found",
    http(404, "invitation_not_found"),
    "stale",
    false,
  ],
  ["409 last_admin", http(409, "last_admin"), "stale", false],
  ["409 self_target", http(409, "self_target"), "stale", false],
  ["409 invitation_used", http(409, "invitation_used"), "stale", false],
  ["409 invitation_revoked", http(409, "invitation_revoked"), "stale", false],
  [
    "409 request_in_progress keeps the key",
    http(409, "request_in_progress"),
    "inProgress",
    true,
  ],
  [
    "409 idempotency_key_reused drops the key",
    http(409, "idempotency_key_reused"),
    "failed",
    false,
  ],
  ["any other 409", http(409, "conflict"), "failed", false],
  ["400 validation", http(400, "validation_failed"), "failed", false],
  ["400 batch_too_large", http(400, "batch_too_large"), "failed", false],
  ["500 keeps the key", http(500, "internal_error"), "failed", true],
  ["503 keeps the key", http(503, "unavailable"), "failed", true],
  ["a timeout keeps the key", { kind: "timeout" }, "failed", true],
  ["a network error keeps the key", { kind: "network" }, "failed", true],
  [
    "an answer that does not fit the schema keeps the key",
    { kind: "invalid_response", status: 200 },
    "failed",
    true,
  ],
  [
    "a cancelled request is not a failure",
    { kind: "aborted" },
    "aborted",
    false,
  ],
];

describe("actionOutcome and keepsKey (TOKI-025 R19, R20, R22)", () => {
  it.each(TABLE)("%s", (_name, init, outcome, keeps) => {
    const error = new ApiError(init);
    expect(actionOutcome(error)).toBe(outcome);
    expect(keepsKey(error)).toBe(keeps);
  });

  it("treats an error that is not an ApiError as a failure and drops the key", () => {
    expect(actionOutcome(new TypeError("boom"))).toBe("failed");
    expect(keepsKey(new TypeError("boom"))).toBe(false);
    expect(actionOutcome("text")).toBe("failed");
  });
});
