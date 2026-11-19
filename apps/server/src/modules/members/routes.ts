import {
  canOpenAdminPage,
  ChangeRoleBodySchema,
  IdParamSchema,
  type Clock,
} from "@toki/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { Db } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { reportSessionsEnded } from "../auth/index.js";
import type { MailLayer } from "../mail/index.js";
import {
  changeRole,
  deactivate,
  reactivate,
  refuse,
  type Account,
  type PersonResult,
} from "./accounts.js";
import { publishMemberChanged } from "./events.js";

export type MembersDeps = {
  db: Db;
  mail: MailLayer;
  clock: Clock;
  // The app's own origin, the one the Origin rule reads (R11).
  appOrigin: string;
};

// A failed query of Drizzle carries its parameters in the message, and the
// shared handler logs it: an address, a token or a key would reach the log
// (R32). A known error passes; any other becomes one that names only its kind.
function guarded<T>(work: () => Promise<T>): Promise<T> {
  return work().catch((error: unknown) => {
    if (error instanceof AppError || error instanceof ZodError) throw error;
    // No `cause`: the original error is the one that carries the parameters.
    const kind = error instanceof Error ? error.name : "error";
    throw new Error(`The member request failed (${kind}).`);
  });
}

// The role gate (R1 step 2). It runs before any schema, so a Member gets 403
// whatever the body, the query or the id (D-090).
function gate(request: FastifyRequest): Account {
  const actor = request.account!;
  refuse(canOpenAdminPage(actor));
  return actor;
}

const param = (request: FastifyRequest, name: string) =>
  IdParamSchema.parse((request.params as Record<string, unknown>)[name]);

// The routes of member management (TOKI-024). Every one needs an Admin; the
// session check itself is the hook of the auth module.
export function registerMembersRoutes(
  scope: FastifyInstance,
  deps: MembersDeps,
) {
  const { db, clock } = deps;

  // After the commit: the listeners hear of a session only when it is really
  // ended, and of a change only when it is really made (R28, R40).
  const finish = (request: FastifyRequest, out: PersonResult) => {
    reportSessionsEnded(out.endedSessionIds, "deactivated");
    if (out.event) publishMemberChanged(out.event, request.log);
    return { member: out.member };
  };
  const person = (request: FastifyRequest) => {
    const actor = gate(request);
    return {
      actorId: actor.id,
      workspaceId: actor.workspaceId,
      targetId: param(request, "userId"),
      now: new Date(clock.now()),
    };
  };

  scope.post("/members/:userId/role", (request) =>
    guarded(async () => {
      const input = person(request);
      const { role } = ChangeRoleBodySchema.parse(request.body ?? {});
      return finish(request, await changeRole(db, { ...input, role }));
    }),
  );

  scope.post("/members/:userId/deactivate", (request) =>
    guarded(async () => finish(request, await deactivate(db, person(request)))),
  );

  scope.post("/members/:userId/reactivate", (request) =>
    guarded(async () => finish(request, await reactivate(db, person(request)))),
  );
}
