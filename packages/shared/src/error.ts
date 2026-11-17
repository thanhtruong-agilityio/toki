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
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
