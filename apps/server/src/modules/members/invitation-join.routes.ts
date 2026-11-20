import {
  CODE_TTL_SECONDS,
  ErrorCodes,
  INVITATION_RESEND_SECONDS,
  InvitationLookupBodySchema,
  ResendInvitationCodeBodySchema,
  type Clock,
} from "@toki/shared";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { Db } from "../../db/client.js";
import { AppError } from "../../errors.js";
import type { MailLayer } from "../mail/index.js";
import { lookupInvitation, resendInvitationCode } from "./invitation-join.js";
import type { ClosedError } from "./invitations.js";

export type InvitationJoinDeps = {
  db: Db;
  mail: MailLayer;
  clock: Clock;
};

// An invitation that cannot be used: 409 with its own code, 404 when no invitation has the token (R8).
function closedAnswer(error: ClosedError): AppError {
  switch (error) {
    case "invitation_not_found":
      return new AppError(
        404,
        ErrorCodes.invitationNotFound,
        "This invitation was not found.",
      );
    case "invitation_used":
      return new AppError(
        409,
        ErrorCodes.invitationUsed,
        "This invitation has been used.",
      );
    case "invitation_revoked":
      return new AppError(
        409,
        ErrorCodes.invitationRevoked,
        "This invitation was revoked.",
      );
    case "invitation_expired":
      return new AppError(
        409,
        ErrorCodes.invitationExpired,
        "This invitation has expired.",
      );
  }
}

// A failed query of Drizzle carries its parameters in the message, and the shared handler logs it: the
// token or the address would reach the log (R24). A known error passes; any other becomes one that
// names only its kind, with no `cause`.
function guarded<T>(work: () => Promise<T>): Promise<T> {
  return work().catch((error: unknown) => {
    if (error instanceof AppError || error instanceof ZodError) throw error;
    const kind = error instanceof Error ? error.name : "error";
    throw new Error(`The invitation request failed (${kind}).`);
  });
}

// The three public routes of the Join page (TOKI-097 R22, R23). Each carries the flag `public` in its
// own definition and none is a `GET`. The hooks of the auth module apply the rules of R22 to them.
export function registerInvitationJoinRoutes(
  scope: FastifyInstance,
  deps: InvitationJoinDeps,
) {
  const { db, mail, clock } = deps;
  const pub = { config: { public: true } };

  scope.post("/invitations/lookup", pub, (request) =>
    guarded(async () => {
      const body = InvitationLookupBodySchema.parse(request.body ?? {});
      return lookupInvitation(db, body.token, new Date(clock.now()));
    }),
  );

  scope.post("/invitations/codes", pub, (request, reply) =>
    guarded(async () => {
      const body = ResendInvitationCodeBodySchema.parse(request.body ?? {});
      const result = await resendInvitationCode(db, {
        token: body.token,
        now: new Date(clock.now()),
      });
      if (!result.ok) {
        if (result.error === "request_limit") {
          throw new AppError(
            429,
            ErrorCodes.codeRequestLimit,
            "Too many code requests for this address.",
            { retryAfterSeconds: result.retryAfterSeconds },
          );
        }
        if (result.error === "resend_too_soon") {
          throw new AppError(
            429,
            ErrorCodes.codeResendTooSoon,
            "A new code was requested too recently.",
            { retryAfterSeconds: result.retryAfterSeconds },
          );
        }
        throw closedAnswer(result.error);
      }
      // After the answer, and never awaited: a failing or silent mail layer changes nothing the
      // person sees (R9). The layer logs its own failure.
      const mailInput = { to: result.email, code: result.code };
      reply.raw.once("close", () => {
        void mail.sendInvitationCode(mailInput).catch(() => {});
      });
      return {
        expiresInSeconds: CODE_TTL_SECONDS,
        resendAfterSeconds: INVITATION_RESEND_SECONDS,
      };
    }),
  );
}
