import { z } from "zod";
import { CODE_LENGTH } from "../auth/limits.js";
import { UserSchema } from "../auth/schemas.js";

// The bodies and answers of the three public routes under /api/v1/invitations (TOKI-097 R24). The
// server validates its requests with them and the web app reads the answers with them.

// A token of the wrong shape is not a validation failure: the server answers `unknown` or 404 for it
// without a query (R2, R8). Only a missing or non-string token is refused here.
const TokenSchema = z.string();

export const InvitationLookupBodySchema = z.object({ token: TokenSchema });
export const ResendInvitationCodeBodySchema = z.object({ token: TokenSchema });
export const AcceptInvitationBodySchema = z.object({
  token: TokenSchema,
  code: z.string().regex(new RegExp(`^[0-9]{${CODE_LENGTH}}$`)),
});

// Strict, so that a field the answer must never carry (a role, an inviter, an id) is refused
// when the server checks its own answer (R1).
export const InvitationLookupResponseSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("pending"),
      email: z.string(),
      workspaceName: z.string(),
      codeExpiresInSeconds: z.number(),
      resendAfterSeconds: z.number(),
    })
    .strict(),
  z.object({ state: z.literal("expired"), workspaceName: z.string() }).strict(),
  z.object({ state: z.literal("revoked"), workspaceName: z.string() }).strict(),
  z.object({ state: z.literal("used"), email: z.string() }).strict(),
  z.object({ state: z.literal("unknown") }).strict(),
]);
export type InvitationLookupResponse = z.infer<
  typeof InvitationLookupResponseSchema
>;

export const ResendInvitationCodeResponseSchema = z
  .object({ expiresInSeconds: z.number(), resendAfterSeconds: z.number() })
  .strict();

// No token in the answer (R10, D-083).
export const AcceptInvitationResponseSchema = z
  .object({ user: UserSchema, generalConversationId: z.string() })
  .strict();
