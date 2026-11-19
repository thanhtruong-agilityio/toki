import {
  canInviteMember,
  canManageInvitations,
  canOpenAdminPage,
  ChangeRoleBodySchema,
  ErrorCodes,
  IdempotencyKeySchema,
  IdParamSchema,
  INVITATION_BATCH_MAX,
  InviteBodySchema,
  MemberListQuerySchema,
  type Clock,
} from "@toki/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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
import {
  claimRequest,
  completeRequest,
  pruneRequests,
  releaseRequest,
  requestHash,
  type RequestAction,
} from "./idempotency.js";
import { listMembers } from "./list.js";
import {
  inviteBatch,
  resendInvitation,
  revokeInvitation,
} from "./invitations.js";

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
  const invitationDeps = {
    db,
    mail: deps.mail,
    appOrigin: deps.appOrigin,
  };

  // The repeat rule (R13): claim the key, answer a repeat from the stored
  // response, store a 200 and nothing else.
  async function once<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    claim: {
      actor: Account;
      key: string;
      action: RequestAction;
      invitationId: string | null;
      body: unknown;
      now: Date;
    },
    work: () => Promise<T>,
  ) {
    const claimed = await claimRequest(db, {
      workspaceId: claim.actor.workspaceId,
      userId: claim.actor.id,
      key: claim.key,
      action: claim.action,
      hash: requestHash(claim.action, claim.invitationId, claim.body),
      now: claim.now,
    });
    if (claimed.kind === "replay") {
      return reply.code(claimed.status).send(claimed.body);
    }
    let body: T;
    try {
      body = await work();
    } catch (error) {
      // Only a 200 is stored: any other answer frees the key. A failure to
      // free it must not hide the error that is being answered.
      await releaseRequest(db, claimed.claimId).catch(() => {});
      throw error;
    }
    // The work is done and committed. Housekeeping and the stored copy are
    // best effort: their failure must not turn a finished request into an
    // error, which a retry would then process again.
    await pruneRequests(db, claim.now, claimed.claimId).catch(() => {});
    const stored = await completeRequest(db, {
      claimId: claimed.claimId,
      status: 200,
      body,
      now: claim.now,
    }).catch(() => false);
    if (!stored) await releaseRequest(db, claimed.claimId).catch(() => {});
    return body;
  }
  const keyOf = (request: FastifyRequest) =>
    IdempotencyKeySchema.parse(request.headers["idempotency-key"]);

  scope.get("/members", (request) =>
    guarded(async () => {
      const actor = gate(request);
      const query = MemberListQuerySchema.parse(request.query ?? {});
      return listMembers(db, {
        workspaceId: actor.workspaceId,
        query,
        now: new Date(clock.now()),
      });
    }),
  );

  scope.post("/invitations", (request, reply) =>
    guarded(async () => {
      const actor = gate(request);
      const body = InviteBodySchema.parse(request.body ?? {});
      if (body.emails.length > INVITATION_BATCH_MAX) {
        throw new AppError(
          400,
          ErrorCodes.batchTooLarge,
          "Too many addresses in one batch.",
          { max: INVITATION_BATCH_MAX },
        );
      }
      const key = keyOf(request);
      refuse(canInviteMember(actor, { role: body.role }));
      const now = new Date(clock.now());
      return once(
        request,
        reply,
        { actor, key, action: "invite", invitationId: null, body, now },
        () => inviteBatch(invitationDeps, { actor, ...body, now }),
      );
    }),
  );

  scope.post("/invitations/:invitationId/resend", (request, reply) =>
    guarded(async () => {
      const actor = gate(request);
      const invitationId = param(request, "invitationId");
      const key = keyOf(request);
      refuse(canManageInvitations(actor));
      const now = new Date(clock.now());
      return once(
        request,
        reply,
        { actor, key, action: "resend", invitationId, body: null, now },
        () => resendInvitation(invitationDeps, { actor, invitationId, now }),
      );
    }),
  );

  scope.post("/invitations/:invitationId/revoke", (request) =>
    guarded(async () => {
      const actor = gate(request);
      const invitationId = param(request, "invitationId");
      refuse(canManageInvitations(actor));
      const now = new Date(clock.now());
      return revokeInvitation(invitationDeps, { actor, invitationId, now });
    }),
  );

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
