import { INVITATION_TOKEN_PATTERN } from "@toki/shared";
import { and, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Tx } from "../../db/client.js";
import { endSessionsOfUser } from "../auth/index.js";
import {
  addMemberToGeneral,
  getGeneralConversationId,
} from "../conversations/index.js";
import type { Account } from "./accounts.js";
import {
  closedError,
  hashToken,
  invitationState,
  lockInvitationByToken,
  type ClosedError,
} from "./invitations.js";
import { recordAction } from "./record.js";
import { invitations, users } from "./schema.js";

export type AcceptedInvitation =
  | {
      ok: true;
      account: Pick<
        Account,
        "id" | "email" | "displayName" | "role" | "status" | "language"
      >;
      created: boolean;
      reactivated: boolean;
      generalConversationId: string;
      // Sessions of a brought-back account that were ended here: the caller
      // reports them after its commit.
      endedSessionIds: string[];
    }
  | { ok: false; error: ClosedError | "account_active" };

const accountColumns = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  role: users.role,
  status: users.status,
  language: users.language,
};

// Accepts an invitation in the caller's transaction (R20). The caller has
// checked the 6 digits; this function checks no code. It creates the account
// or brings a deactivated one back, closes the invitation and adds the person
// to #general, so the change has one author. Nothing is written for a
// refusal, except `account_active`, which closes the invitation.
export async function acceptInvitation(
  tx: Tx,
  input: { token: string; now: Date },
): Promise<AcceptedInvitation> {
  const { now } = input;
  const seen = await readAddress(tx, input.token);
  if (!seen) return { ok: false, error: "invitation_not_found" };

  // The locks, in the order of R39: the account of the address first, then
  // the invitation row, which is read again.
  const [account] = await tx
    .select(accountColumns)
    .from(users)
    .where(
      and(eq(users.workspaceId, seen.workspaceId), eq(users.email, seen.email)),
    )
    .for("no key update");
  const invitation = await lockInvitationByToken(tx, input.token);
  if (!invitation) return { ok: false, error: "invitation_not_found" };
  const error = closedError(invitationState(invitation, now));
  if (error) return { ok: false, error };

  const close = (userId: string) =>
    tx
      .update(invitations)
      .set({ usedAt: now, usedBy: userId })
      .where(
        and(
          eq(invitations.id, invitation.id),
          isNull(invitations.usedAt),
          isNull(invitations.revokedAt),
        ),
      );
  const role = invitation.role as Account["role"];

  if (account?.status === "active") {
    // The address already belongs to an active member: an old invitation
    // must not change that person's role.
    await close(account.id);
    return { ok: false, error: "account_active" };
  }

  let accepted: Extract<AcceptedInvitation, { ok: true }>["account"];
  let endedSessionIds: string[] = [];
  if (account) {
    // The same account, brought back (D-094, D-181). Its sessions are ended
    // first: a session row that was never ended would live again.
    endedSessionIds = await endSessionsOfUser(tx, account.id, {
      reason: "deactivated",
    });
    await tx
      .update(users)
      .set({ status: "active", role })
      .where(eq(users.id, account.id));
    await recordAction(tx, {
      workspaceId: invitation.workspaceId,
      // No Admin pressed a button at this moment: the person is the actor.
      actorId: account.id,
      action: "account_reactivated",
      targetUserId: account.id,
      detail: {
        via: "invitation",
        invitationId: invitation.id,
        invitedBy: invitation.invitedBy,
        role,
        earlierRole: account.role,
      },
      at: now,
    });
    accepted = { ...(account as Account), status: "active", role };
  } else {
    const id = uuidv7();
    const displayName = invitation.email.split("@")[0]!;
    await tx.insert(users).values({
      id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      displayName,
      role,
      status: "active",
      createdAt: now,
    });
    accepted = {
      id,
      email: invitation.email,
      displayName,
      role,
      status: "active",
      language: "en",
    };
  }
  await close(accepted.id);
  await addMemberToGeneral(tx, {
    workspaceId: invitation.workspaceId,
    userId: accepted.id,
    createdAt: now,
  });
  return {
    ok: true,
    account: accepted,
    created: !account,
    reactivated: Boolean(account),
    generalConversationId: await getGeneralConversationId(
      tx,
      invitation.workspaceId,
    ),
    endedSessionIds,
  };
}

// The address and the workspace of a token, read without a lock: they name
// the account row to lock before the invitation row.
async function readAddress(tx: Tx, token: string) {
  if (!INVITATION_TOKEN_PATTERN.test(token)) return null;
  const [row] = await tx
    .select({
      email: invitations.email,
      workspaceId: invitations.workspaceId,
    })
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);
  return row ?? null;
}
