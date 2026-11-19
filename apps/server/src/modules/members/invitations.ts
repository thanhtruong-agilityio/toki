import { createHash, randomBytes } from "node:crypto";
import {
  canInviteMember,
  canManageInvitations,
  ErrorCodes,
  INVITATION_LIFETIME_DAYS,
  INVITATION_TOKEN_PATTERN,
  parseEmail,
  type Decision,
  type Invitation,
  type InviteResult,
  type MemberRole,
  type ResendResponse,
  type RevokeResponse,
} from "@toki/shared";
import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db, DbClient, Tx } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { createInvitationCode, pruneInvitationCodes } from "../auth/index.js";
import type { MailLayer } from "../mail/index.js";
import { getWorkspace } from "../workspace/index.js";
import { checkLockedActor, refuse } from "./accounts.js";
import { recordAction } from "./record.js";
import { invitations, users } from "./schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIFETIME_MS = INVITATION_LIFETIME_DAYS * DAY_MS;
// Invitation codes older than this hold an address for nothing (R33).
const CODE_PRUNE_MS = 8 * DAY_MS;
const PRUNE_LIMIT = 100;

export type InvitationState = "pending" | "expired" | "revoked" | "used";

// The state of an invitation, worked out from its columns and the clock; the
// first that applies (R18). Every read and every re-check under a lock use it.
export function invitationState(
  row: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
): InvitationState {
  if (row.usedAt) return "used";
  if (row.revokedAt) return "revoked";
  if (now.getTime() >= row.expiresAt.getTime()) return "expired";
  return "pending";
}

// 32 random bytes as 43 characters of base64url (R11). Only its SHA-256 is
// stored.
export const makeToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// The secret of one code of an invitation: each code has its own (R11).
export const codeSecret = (token: string, codeSerial: number) =>
  `${token}:${codeSerial}`;

export type InvitationRow = typeof invitations.$inferSelect;
type Inviter = { id: string; displayName: string };
export type InvitationWithInviter = { row: InvitationRow; inviter: Inviter };

const inviter = alias(users, "inviter");

// One invitation with the person who made it. `lock` takes FOR NO KEY UPDATE
// on the invitation row only (R39).
export async function readInvitation(
  client: DbClient,
  where: { id: string } | { openEmail: string },
  workspaceId: string,
  lock = false,
): Promise<InvitationWithInviter | null> {
  const condition =
    "id" in where
      ? eq(invitations.id, where.id)
      : and(
          eq(invitations.email, where.openEmail),
          isNull(invitations.usedAt),
          isNull(invitations.revokedAt),
        );
  const query = client
    .select({
      row: invitations,
      inviter: { id: inviter.id, displayName: inviter.displayName },
    })
    .from(invitations)
    .innerJoin(inviter, eq(inviter.id, invitations.invitedBy))
    .where(and(eq(invitations.workspaceId, workspaceId), condition))
    .limit(1);
  const [found] = lock
    ? await query.for("no key update", { of: invitations })
    : await query;
  return found ?? null;
}

type OpenState = "pending" | "expired";
const fields = (found: InvitationWithInviter) => ({
  id: found.row.id,
  role: found.row.role as MemberRole,
  mailStatus: found.row.mailStatus as "sent" | "failed",
  invitedBy: found.inviter,
  createdAt: found.row.createdAt.toISOString(),
  sentAt: found.row.sentAt.toISOString(),
  expiresAt: found.row.expiresAt.toISOString(),
});
// An unclosed invitation as the routes and the list return it (R22).
export const toInvitation = (
  found: InvitationWithInviter,
  now: Date,
): Invitation => ({
  ...fields(found),
  state: invitationState(found.row, now) as OpenState,
});

// The next code of an invitation, in the caller's transaction: the serial
// goes up by one, so the code has a secret of its own, and the earlier unused
// code is cancelled by the auth module (R19, TOKI-022 R49).
export async function makeCode(
  tx: DbClient,
  invitation: { id: string; email: string; codeSerial: number },
  token: string,
  now: Date,
): Promise<{ code: string; codeSerial: number }> {
  const codeSerial = invitation.codeSerial + 1;
  await tx
    .update(invitations)
    .set({ codeSerial, codeIssuedAt: now })
    .where(eq(invitations.id, invitation.id));
  const code = await createInvitationCode(tx, {
    email: invitation.email,
    secret: codeSecret(token, codeSerial),
  });
  return { code, codeSerial };
}

export type InvitationDeps = { db: Db; mail: MailLayer; appOrigin: string };
type Actor = { id: string; workspaceId: string; displayName: string };

// The acting Admin, read again from its row under FOR SHARE (R39): a demotion
// or a deactivation that holds the row is waited for, and the function of the
// route is asked again with what the row says now (R1 step 5).
async function lockActor(
  tx: Tx,
  actorId: string,
  check: (actor: { id: string; role: string }) => Decision,
) {
  const [actor] = await tx
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, actorId))
    .for("share");
  checkLockedActor(actor);
  refuse(check(actor));
}

type Outgoing = {
  invitationId: string;
  tokenHash: string;
  to: string;
  code: string;
  joinUrl: string;
};

// Hands the mails to the layer all together, then marks each delivered one.
// The update names the token, so a Resend that replaced it in between is not
// marked as delivered by the earlier mail. Returns the ids that were sent.
async function sendMails(
  deps: InvitationDeps,
  actor: Actor,
  mails: Outgoing[],
): Promise<Set<string>> {
  const sent = new Set<string>();
  if (mails.length === 0) return sent;
  const workspace = await getWorkspace(deps.db);
  if (!workspace) throw new Error("There is no workspace.");
  const answers = await Promise.all(
    mails.map((m) =>
      deps.mail
        .sendInvitationMail({
          to: m.to,
          code: m.code,
          workspaceName: workspace.name,
          inviterName: actor.displayName,
          joinUrl: m.joinUrl,
        })
        .then(
          (answer) => answer.ok,
          () => false,
        ),
    ),
  );
  for (const [i, ok] of answers.entries()) {
    if (!ok) continue;
    const mail = mails[i]!;
    const updated = await deps.db
      .update(invitations)
      .set({ mailStatus: "sent" })
      .where(
        and(
          eq(invitations.id, mail.invitationId),
          eq(invitations.tokenHash, mail.tokenHash),
        ),
      )
      .returning({ id: invitations.id });
    if (updated.length > 0) sent.add(mail.invitationId);
  }
  return sent;
}

const joinUrl = (deps: InvitationDeps, token: string) =>
  `${deps.appOrigin}/join#${token}`;

const pruneCodes = (deps: InvitationDeps, now: Date) =>
  pruneInvitationCodes(
    deps.db,
    new Date(now.getTime() - CODE_PRUNE_MS),
    PRUNE_LIMIT,
  );

const isOpenEmailConflict = (error: unknown) => {
  const cause = (error as { cause?: unknown }).cause ?? error;
  const pg = cause as { code?: string; constraint_name?: string };
  return (
    pg.code === "23505" && pg.constraint_name === "invitations_open_email_key"
  );
};

type Made = {
  result: InviteResult;
  mail: Outgoing | null;
  created: InvitationWithInviter | null;
};

// One address of a batch, in its own transaction (R6 to R9).
async function inviteOne(
  deps: InvitationDeps,
  actor: Actor,
  email: string,
  role: MemberRole,
  now: Date,
): Promise<Made> {
  const plain = (result: InviteResult): Made => ({
    result,
    mail: null,
    created: null,
  });
  const alreadyInvited = (found: InvitationWithInviter) =>
    plain({
      email,
      result: "already_invited",
      invitation: toInvitation(found, now),
    });
  try {
    return await deps.db.transaction(async (tx) => {
      await lockActor(tx, actor.id, (a) => canInviteMember(a, { role }));
      const [account] = await tx
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(
          and(eq(users.workspaceId, actor.workspaceId), eq(users.email, email)),
        )
        .limit(1);
      if (account?.status === "active") {
        return plain({ email, result: "already_member" });
      }
      const open = await readInvitation(
        tx,
        { openEmail: email },
        actor.workspaceId,
      );
      if (open) return alreadyInvited(open);

      const token = makeToken();
      const [row] = await tx
        .insert(invitations)
        .values({
          workspaceId: actor.workspaceId,
          email,
          role,
          // A deactivated account is brought back by this invitation (R9).
          userId: account?.id ?? null,
          invitedBy: actor.id,
          tokenHash: hashToken(token),
          codeSerial: 0,
          codeIssuedAt: now,
          // `sent` only once the mail layer said so: a crash between the
          // commit and the send must not show a false "Invited".
          mailStatus: "failed",
          createdAt: now,
          sentAt: now,
          expiresAt: new Date(now.getTime() + LIFETIME_MS),
        })
        .returning();
      const { code, codeSerial } = await makeCode(tx, row!, token, now);
      await recordAction(tx, {
        workspaceId: actor.workspaceId,
        actorId: actor.id,
        action: "invitation_created",
        targetUserId: account?.id ?? null,
        targetEmail: email,
        detail: { invitationId: row!.id, role },
        at: now,
      });
      const created = {
        row: { ...row!, codeSerial, codeIssuedAt: now },
        inviter: { id: actor.id, displayName: actor.displayName },
      };
      return {
        result: { email, result: "invited" as const },
        mail: {
          invitationId: row!.id,
          tokenHash: row!.tokenHash,
          to: email,
          code,
          joinUrl: joinUrl(deps, token),
        },
        created,
      };
    });
  } catch (error) {
    // Another request inserted the same address first: the database let one
    // in, and this one reports the invitation that exists (R7).
    if (!isOpenEmailConflict(error)) throw error;
    const open = await readInvitation(
      deps.db,
      { openEmail: email },
      actor.workspaceId,
    );
    if (!open) throw error;
    return alreadyInvited(open);
  }
}

// A batch (R4 to R10). The entries were counted and checked by the route.
export async function inviteBatch(
  deps: InvitationDeps,
  input: { actor: Actor; emails: string[]; role: MemberRole; now: Date },
): Promise<{ results: InviteResult[] }> {
  const { actor, role, now } = input;
  // Trimmed and in lower case before anything else; each address once, in
  // the order of first appearance (R5).
  const distinct = [
    ...new Set(input.emails.map((e) => e.trim().toLowerCase())),
  ];
  const made: Made[] = [];
  // An error stops the batch (a lost actor is a 403, R39; a database failure
  // is a 500), but the invitations already made stay, and their mails are
  // still handed over below: otherwise they would wait as "Mail not sent"
  // without one attempt.
  let stopped: unknown = null;
  for (const entry of distinct) {
    const email = parseEmail(entry);
    if (email === null) {
      made.push({
        result: { email: entry, result: "invalid_email" },
        mail: null,
        created: null,
      });
      continue;
    }
    try {
      made.push(await inviteOne(deps, actor, email, role, now));
    } catch (error) {
      stopped = error;
      break;
    }
  }
  const sent = await sendMails(
    deps,
    actor,
    made.flatMap((m) => (m.mail ? [m.mail] : [])),
  ).catch((error: unknown) => {
    // Never hide the error that stopped the batch behind a mail error.
    if (stopped === null) throw error;
    return new Set<string>();
  });
  if (stopped !== null) throw stopped;
  await pruneCodes(deps, now);
  return {
    results: made.map((m): InviteResult => {
      if (!m.created) return m.result;
      const delivered = sent.has(m.created.row.id);
      const row = {
        ...m.created.row,
        mailStatus: delivered ? "sent" : "failed",
      };
      return {
        email: m.result.email,
        result: delivered ? "invited" : "mail_not_sent",
        invitation: toInvitation({ row, inviter: m.created.inviter }, now),
      };
    }),
  };
}

const notFound = () =>
  new AppError(404, ErrorCodes.invitationNotFound, "No such invitation.");
const used = () =>
  new AppError(
    409,
    ErrorCodes.invitationUsed,
    "This invitation was already used.",
  );
const revoked = () =>
  new AppError(
    409,
    ErrorCodes.invitationRevoked,
    "This invitation was revoked.",
  );

// Resend (R14): a new token, a new code and a new 7 days for an invitation
// that is pending or expired. The earlier mail stops working (D-182).
export async function resendInvitation(
  deps: InvitationDeps,
  input: { actor: Actor; invitationId: string; now: Date },
): Promise<ResendResponse> {
  const { actor, now } = input;
  const done = await deps.db.transaction(async (tx) => {
    await lockActor(tx, actor.id, canManageInvitations);
    const found = await readInvitation(
      tx,
      { id: input.invitationId },
      actor.workspaceId,
      true,
    );
    if (!found) throw notFound();
    const state = invitationState(found.row, now);
    if (state === "used") throw used();
    if (state === "revoked") throw revoked();

    const token = makeToken();
    const changes = {
      tokenHash: hashToken(token),
      sentAt: now,
      expiresAt: new Date(now.getTime() + LIFETIME_MS),
      mailStatus: "failed",
    };
    await tx
      .update(invitations)
      .set(changes)
      .where(eq(invitations.id, found.row.id));
    const { code, codeSerial } = await makeCode(tx, found.row, token, now);
    await recordAction(tx, {
      workspaceId: actor.workspaceId,
      actorId: actor.id,
      action: "invitation_resent",
      targetUserId: found.row.userId,
      targetEmail: found.row.email,
      detail: { invitationId: found.row.id, role: found.row.role },
      at: now,
    });
    return {
      found: {
        row: { ...found.row, ...changes, codeSerial, codeIssuedAt: now },
        inviter: found.inviter,
      },
      mail: {
        invitationId: found.row.id,
        tokenHash: changes.tokenHash,
        to: found.row.email,
        code,
        joinUrl: joinUrl(deps, token),
      },
    };
  });
  const sent = await sendMails(deps, actor, [done.mail]);
  await pruneCodes(deps, now);
  const delivered = sent.has(done.found.row.id);
  const row = { ...done.found.row, mailStatus: delivered ? "sent" : "failed" };
  return {
    result: delivered ? "invited" : "mail_not_sent",
    invitation: toInvitation({ row, inviter: done.found.inviter }, now),
  };
}

// Revoke (R16). A repeat answers as the first time and records nothing.
export function revokeInvitation(
  deps: InvitationDeps,
  input: { actor: Actor; invitationId: string; now: Date },
): Promise<RevokeResponse> {
  const { actor, now } = input;
  return deps.db.transaction(async (tx) => {
    await lockActor(tx, actor.id, canManageInvitations);
    const found = await readInvitation(
      tx,
      { id: input.invitationId },
      actor.workspaceId,
      true,
    );
    if (!found) throw notFound();
    const state = invitationState(found.row, now);
    if (state === "used") throw used();
    if (state !== "revoked") {
      await tx
        .update(invitations)
        .set({ revokedAt: now })
        .where(eq(invitations.id, found.row.id));
      await recordAction(tx, {
        workspaceId: actor.workspaceId,
        actorId: actor.id,
        action: "invitation_revoked",
        targetUserId: found.row.userId,
        targetEmail: found.row.email,
        detail: { invitationId: found.row.id, role: found.row.role },
        at: now,
      });
    }
    return { invitation: { ...fields(found), state: "revoked" as const } };
  });
}

// ---- for the accept-an-invitation work (R19) ----

export type FoundInvitation = {
  id: string;
  email: string;
  role: MemberRole;
  state: InvitationState;
  accountId: string | null;
  codeSerial: number;
  codeIssuedAt: Date;
  expiresAt: Date;
};

// The invitation of a Join link, or null. A token of the wrong shape finds
// nothing without a query; a token replaced by a Resend finds nothing. Writes
// nothing.
export async function findInvitationByToken(
  db: DbClient,
  token: string,
  now: Date,
): Promise<FoundInvitation | null> {
  if (!INVITATION_TOKEN_PATTERN.test(token)) return null;
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role as MemberRole,
    state: invitationState(row, now),
    accountId: row.userId,
    codeSerial: row.codeSerial,
    codeIssuedAt: row.codeIssuedAt,
    expiresAt: row.expiresAt,
  };
}

export type ClosedError =
  | "invitation_not_found"
  | "invitation_used"
  | "invitation_revoked"
  | "invitation_expired";

// Why an invitation in this state cannot be used to join, or null.
export const closedError = (state: InvitationState): ClosedError | null =>
  state === "pending" ? null : (`invitation_${state}` as ClosedError);

// The invitation of a token, locked (FOR NO KEY UPDATE) and read again (R39).
export async function lockInvitationByToken(
  tx: DbClient,
  token: string,
): Promise<InvitationRow | null> {
  if (!INVITATION_TOKEN_PATTERN.test(token)) return null;
  const [row] = await tx
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .for("no key update");
  return row ?? null;
}

export type IssuedCode =
  | { ok: true; email: string; code: string }
  | { ok: false; error: ClosedError }
  | { ok: false; error: "resend_too_soon"; retryAfterSeconds: number };

// The next code of a pending invitation, for "Resend code" (R19). The wait
// between two codes is checked under the lock of the invitation row, so two
// presses at once give one code. It sends no mail.
export function issueInvitationCode(
  db: Db,
  input: { token: string; now: Date; minIntervalSeconds?: number },
): Promise<IssuedCode> {
  return db.transaction(async (tx): Promise<IssuedCode> => {
    const row = await lockInvitationByToken(tx, input.token);
    if (!row) return { ok: false, error: "invitation_not_found" };
    const error = closedError(invitationState(row, input.now));
    if (error) return { ok: false, error };
    if (input.minIntervalSeconds !== undefined) {
      const waitMs =
        input.minIntervalSeconds * 1000 -
        (input.now.getTime() - row.codeIssuedAt.getTime());
      if (waitMs > 0) {
        return {
          ok: false,
          error: "resend_too_soon",
          retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
        };
      }
    }
    const { code } = await makeCode(tx, row, input.token, input.now);
    return { ok: true, email: row.email, code };
  });
}
