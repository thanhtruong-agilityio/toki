import { describe, expect, it } from "vitest";
import { ErrorCodes } from "../src/index.js";

describe("error codes of member management (TOKI-024 R2)", () => {
  it("holds the ten codes under one name each", () => {
    expect({
      forbidden: ErrorCodes.forbidden,
      batchTooLarge: ErrorCodes.batchTooLarge,
      invitationNotFound: ErrorCodes.invitationNotFound,
      invitationUsed: ErrorCodes.invitationUsed,
      invitationRevoked: ErrorCodes.invitationRevoked,
      invitationExpired: ErrorCodes.invitationExpired,
      lastAdmin: ErrorCodes.lastAdmin,
      selfTarget: ErrorCodes.selfTarget,
      requestInProgress: ErrorCodes.requestInProgress,
      idempotencyKeyReused: ErrorCodes.idempotencyKeyReused,
    }).toEqual({
      forbidden: "forbidden",
      batchTooLarge: "batch_too_large",
      invitationNotFound: "invitation_not_found",
      invitationUsed: "invitation_used",
      invitationRevoked: "invitation_revoked",
      invitationExpired: "invitation_expired",
      lastAdmin: "last_admin",
      selfTarget: "self_target",
      requestInProgress: "request_in_progress",
      idempotencyKeyReused: "idempotency_key_reused",
    });
  });
});
