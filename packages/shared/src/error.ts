import { z } from "zod";

// The one error body every error response of the server uses. `code` is a
// plain string so a client built earlier does not fail on a code added later.
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// The registry of error codes. A ticket that introduces an error adds its
// code here; a code is never renamed or removed within a version.
export const ErrorCodes = {
  notFound: "not_found",
  validationFailed: "validation_failed",
  internalError: "internal_error",
  badRequest: "bad_request",
  payloadTooLarge: "payload_too_large",
  unsupportedMediaType: "unsupported_media_type",
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  tooManyRequests: "too_many_requests",
  codeRequestLimit: "code_request_limit",
  codeResendTooSoon: "code_resend_too_soon",
  codeIncorrect: "code_incorrect",
  codeLocked: "code_locked",
  codeExpired: "code_expired",
  accountDeactivated: "account_deactivated",
  unauthenticated: "unauthenticated",
  sessionEnded: "session_ended",
  originNotAllowed: "origin_not_allowed",
  rateLimited: "rate_limited",
  currentSession: "current_session",
  emergencyLinkInvalid: "emergency_link_invalid",
  batchTooLarge: "batch_too_large",
  invitationNotFound: "invitation_not_found",
  invitationUsed: "invitation_used",
  invitationRevoked: "invitation_revoked",
  invitationExpired: "invitation_expired",
  lastAdmin: "last_admin",
  requestInProgress: "request_in_progress",
  idempotencyKeyReused: "idempotency_key_reused",
  channelNameTaken: "channel_name_taken",
  channelIdInUse: "channel_id_in_use",
  channelArchived: "channel_archived",
  channelIsGeneral: "channel_is_general",
  invalidMember: "invalid_member",
  selfTarget: "self_target",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
