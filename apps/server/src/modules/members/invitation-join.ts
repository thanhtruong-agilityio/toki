import {
  CODE_TTL_SECONDS,
  INVITATION_RESEND_SECONDS,
  type InvitationLookupResponse,
} from "@toki/shared";
import type { Db, Tx } from "../../db/client.js";
import {
  checkCodeRequestLimits,
  checkInvitationCode,
  type InvitationCheck,
} from "../auth/index.js";
import { getWorkspace } from "../workspace/index.js";
import { acceptInvitation } from "./accept.js";
import {
  closedError,
  codeSecret,
  findInvitationByToken,
  issueInvitationCode,
  type ClosedError,
} from "./invitations.js";

// What is left of a wait, in whole seconds rounded up and never below 0 (R4).
const secondsLeft = (total: number, ageMs: number) =>
  Math.max(0, Math.ceil(total - ageMs / 1000));

// "What is this link" (R1 to R5). It reads, and writes nothing. A token of the wrong shape finds no
// invitation without a query (R2); a token that a Resend replaced finds none either (R3).
export async function lookupInvitation(
  db: Db,
  token: string,
  now: Date,
): Promise<InvitationLookupResponse> {
  const found = await findInvitationByToken(db, token, now);
  if (!found) return { state: "unknown" };
  if (found.state === "used") return { state: "used", email: found.email };
  const workspace = await getWorkspace(db);
  if (!workspace) throw new Error("There is no workspace.");
  if (found.state === "expired" || found.state === "revoked") {
    return { state: found.state, workspaceName: workspace.name };
  }
  const age = now.getTime() - found.codeIssuedAt.getTime();
  return {
    state: "pending",
    email: found.email,
    workspaceName: workspace.name,
    codeExpiresInSeconds: secondsLeft(CODE_TTL_SECONDS, age),
    resendAfterSeconds: secondsLeft(INVITATION_RESEND_SECONDS, age),
  };
}

export type ResendResult =
  | { ok: true; email: string; code: string }
  | { ok: false; error: ClosedError }
  | {
      ok: false;
      error: "request_limit" | "resend_too_soon";
      retryAfterSeconds: number;
    };

// "Resend code" (R6, R7, R8, R50, R51). The refusals of an invitation that cannot be used come first
// (R8, R50), then, in one transaction on one connection, the count of the address (the lock of the
// address, then both purposes' rows) and `issueInvitationCode`, which locks the invitation row and
// holds the 60 seconds of the invitation. The lock order is the same on every path: address, then
// invitation row (`acceptInvitation` and the Admin routes never take the address lock).
//
// `issueInvitationCode` is typed to take the database. Given a transaction, Drizzle opens a savepoint
// on the same connection, and `createInvitationCode` joins the caller's transaction, so the request
// holds one connection: with two (one for the lock, one for the code) a full pool of requests that
// wait for the same address lock could leave the first with no connection to finish on. The cast is
// the only one, and a test reads the statements and shows one connection.
export async function resendInvitationCode(
  db: Db,
  input: { token: string; now: Date },
): Promise<ResendResult> {
  const { token, now } = input;
  const found = await findInvitationByToken(db, token, now);
  if (!found) return { ok: false, error: "invitation_not_found" };
  const closed = closedError(found.state);
  if (closed) return { ok: false, error: closed };

  return db.transaction(async (tx): Promise<ResendResult> => {
    const limits = await checkCodeRequestLimits(tx, {
      email: found.email,
      now,
    });
    if (limits.result !== "ok") {
      return {
        ok: false,
        error: limits.result,
        retryAfterSeconds: limits.retryAfterSeconds,
      };
    }
    const issued = await issueInvitationCode(tx as unknown as Db, {
      token,
      now,
      minIntervalSeconds: INVITATION_RESEND_SECONDS,
    });
    if (issued.ok) return { ok: true, email: issued.email, code: issued.code };
    if (issued.error === "resend_too_soon") {
      return {
        ok: false,
        error: "resend_too_soon",
        retryAfterSeconds: issued.retryAfterSeconds,
      };
    }
    return { ok: false, error: issued.error };
  });
}

// Test seams of the accept (TOKI-097). Only a test sets them; each runs at the place its name says.
export type JoinHooks = {
  // After the code is checked and before the transaction opens (a race of R16).
  afterCodeCheck?: () => Promise<void>;
  // In the transaction, after `acceptInvitation` answered ok and before the commit; a throw rolls back (R19).
  inTransaction?: (tx: Tx) => Promise<void>;
  // After the commit and the report of the ended sessions, before the session is made; a throw is a
  // failure of the session (R15, R19).
  afterCommit?: () => Promise<void>;
};

export type AcceptResult =
  | { kind: "refused"; error: ClosedError }
  | { kind: "code"; check: Exclude<InvitationCheck, { result: "ok" }> }
  | { kind: "account_active" }
  | {
      kind: "ok";
      accountId: string;
      generalConversationId: string;
      endedSessionIds: string[];
    };

class Rollback extends Error {
  constructor(readonly refusal: ClosedError) {
    super("rollback");
  }
}

// The steps of an accept up to the commit (R10 to R12, R16, R18, R44). The checks run in this order and
// each stops the request: the token, the state, then the code (R11), so a refusal of the first group
// uses up no try. The code check comes before the transaction of `acceptInvitation` (concern 10): an
// accept that fails after the code leaves the invitation pending and the code used up. `account_active`
// commits (the invitation is closed, R44); any other refusal rolls back (R16). What follows the
// commit (the report, the replaced session, the new session) is the route's.
export async function acceptWithCode(
  db: Db,
  input: { token: string; code: string; now: Date; hooks?: JoinHooks },
): Promise<AcceptResult> {
  const { token, code, now, hooks } = input;
  const found = await findInvitationByToken(db, token, now);
  if (!found) return { kind: "refused", error: "invitation_not_found" };
  const closed = closedError(found.state);
  if (closed) return { kind: "refused", error: closed };

  const check = await checkInvitationCode(db, {
    secret: codeSecret(token, found.codeSerial),
    code,
  });
  if (check.result !== "ok") return { kind: "code", check };
  await hooks?.afterCodeCheck?.();

  try {
    return await db.transaction(async (tx): Promise<AcceptResult> => {
      const out = await acceptInvitation(tx, { token, now });
      if (!out.ok) {
        // A value, not a throw: the transaction commits and keeps the invitation closed.
        if (out.error === "account_active") return { kind: "account_active" };
        throw new Rollback(out.error);
      }
      await hooks?.inTransaction?.(tx);
      return {
        kind: "ok",
        accountId: out.account.id,
        generalConversationId: out.generalConversationId,
        endedSessionIds: out.endedSessionIds,
      };
    });
  } catch (error) {
    if (error instanceof Rollback) {
      return { kind: "refused", error: error.refusal };
    }
    throw error;
  }
}
