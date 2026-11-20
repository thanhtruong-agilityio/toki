import { InvitationLookupBodySchema, type Clock } from "@toki/shared";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { Db } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { lookupInvitation } from "./invitation-join.js";

export type InvitationJoinDeps = {
  db: Db;
  clock: Clock;
};

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
  const { db, clock } = deps;
  const pub = { config: { public: true } };

  scope.post("/invitations/lookup", pub, (request) =>
    guarded(async () => {
      const body = InvitationLookupBodySchema.parse(request.body ?? {});
      return lookupInvitation(db, body.token, new Date(clock.now()));
    }),
  );
}
