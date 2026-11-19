import {
  canChangeRole,
  canDeactivateAccount,
  canOpenAdminPage,
  canReactivateAccount,
  ErrorCodes,
  type Decision,
  type MemberAccount,
  type Role,
} from "@toki/shared";
import { and, asc, count, eq, inArray, isNull, or } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db, DbClient, Tx } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { endSessionsOfUser } from "../auth/index.js";
import type { MemberChange } from "./events.js";
import { recordAction } from "./record.js";
import { invitations, users } from "./schema.js";

export type Account = {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: "member" | "admin";
  status: "active" | "deactivated";
  language: "en" | "vi";
};

const columns = {
  id: users.id,
  workspaceId: users.workspaceId,
  email: users.email,
  displayName: users.displayName,
  role: users.role,
  status: users.status,
  language: users.language,
};

// The email address is compared as stored: lower case (the caller normalises
// it with parseEmail). An address with no users row returns no account.
export async function findAccountByEmail(
  client: DbClient,
  email: string,
): Promise<Account | null> {
  const [row] = await client
    .select(columns)
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return (row as Account | undefined) ?? null;
}

export async function getAccountById(
  client: DbClient,
  id: string,
): Promise<Account | null> {
  const [row] = await client
    .select(columns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return (row as Account | undefined) ?? null;
}

// What the channel code needs to know about a person: who, which workspace,
// which role (as stored text, so a role the permission functions do not know
// reaches them) and whether the account is in use. No address, no name.
export type AccountFacts = {
  id: string;
  workspaceId: string;
  role: string;
  status: "active" | "deactivated";
};

// One statement for every id that has a row, in id order. With
// `lock: "share"` the rows are read `FOR SHARE`, so a demotion or a
// deactivation that holds a row finishes first and the caller reads its
// result, and a person cannot be deactivated between the check and the
// insert that follows (TOKI-029 R15, TOKI-024 R39). Without the option no
// lock is taken, which is how a read-only transaction calls it.
export async function getAccountsByIds(
  client: DbClient,
  ids: readonly string[],
  options: { lock?: "share" } = {},
): Promise<AccountFacts[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const query = client
    .select({
      id: users.id,
      workspaceId: users.workspaceId,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(inArray(users.id, unique))
    .orderBy(users.id);
  const rows = await (options.lock === "share" ? query.for("share") : query);
  return rows as AccountFacts[];
}

// The number of accounts in the database (TOKI-020 R14).
export async function countAccounts(client: DbClient): Promise<number> {
  const [row] = await client.select({ n: count() }).from(users);
  return row?.n ?? 0;
}

// Inserts the first Admin. Narrow on purpose: the role and the status are
// fixed here and are not arguments, so no caller can make an Admin through it
// around the rules of the last Admin and of invitations (TOKI-024). The
// language keeps the table default. Returns the new id.
export async function createFirstAdminAccount(
  client: DbClient,
  input: {
    workspaceId: string;
    email: string;
    displayName: string;
    createdAt: Date;
  },
): Promise<string> {
  const id = uuidv7();
  await client.insert(users).values({
    id,
    workspaceId: input.workspaceId,
    email: input.email,
    displayName: input.displayName,
    role: "admin",
    status: "active",
    createdAt: input.createdAt,
  });
  return id;
}

// ---- the person routes: role, deactivate, reactivate (TOKI-024 R26 to R30) ----

type Status = "active" | "deactivated";
export type LockedAccount = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  status: Status;
};

// The answer to a refusal of a permission function. `role_not_allowed` is the
// "no access" answer; a rule about the target is a conflict (409), not a 403;
// `fact_missing` and `unknown_role` are a fault of the server (R1).
export function refuse(decision: Decision): void {
  if (decision.allowed) return;
  switch (decision.reason) {
    case "role_not_allowed":
      throw new AppError(403, ErrorCodes.forbidden, "Admins only.");
    case "self_target":
      throw new AppError(
        409,
        ErrorCodes.selfTarget,
        "You cannot do this to your own account.",
      );
    case "last_admin":
      throw new AppError(
        409,
        ErrorCodes.lastAdmin,
        "The workspace needs at least one active Admin.",
      );
    default:
      throw new Error(`permission check failed: ${decision.reason}`);
  }
}

// The actor as its locked row says it is now (R1 step 5): a deactivated actor
// is 401, an actor who is no longer an Admin is 403.
export function checkLockedActor(
  actor: { id: string; role: string; status: string } | undefined,
): asserts actor is { id: string; role: Role; status: "active" } {
  if (!actor) {
    throw new AppError(401, ErrorCodes.unauthenticated, "Sign in first.");
  }
  if (actor.status !== "active") {
    throw new AppError(
      401,
      ErrorCodes.accountDeactivated,
      "This account is deactivated.",
    );
  }
  refuse(canOpenAdminPage(actor));
}

// Every account row of the workspace, locked in id order (R27, R39). All rows
// and not only the Admins: under READ COMMITTED a lock on the Admin rows would
// not see a person whom another request has just promoted. FOR NO KEY UPDATE
// does not wait for the key-share lock of a foreign key, so a sign-in or a
// batch that points to a person does not deadlock with a person route.
async function lockAccounts(
  tx: Tx,
  workspaceId: string,
): Promise<LockedAccount[]> {
  const rows = await tx
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.workspaceId, workspaceId))
    .orderBy(asc(users.id))
    .for("no key update");
  return rows as LockedAccount[];
}

type PersonInput = {
  actorId: string;
  workspaceId: string;
  targetId: string;
  now: Date;
};
export type PersonResult = {
  member: MemberAccount;
  // Sessions ended inside the transaction: the caller reports them after it.
  endedSessionIds: string[];
  // Set when something changed: the caller publishes it after the commit.
  event: MemberChange | null;
};

// The shared frame of a person route: lock, build the actor, the target and
// the count from the locked rows, check, then do the work.
function withLockedPeople(
  db: Db,
  input: PersonInput,
  work: (
    tx: Tx,
    people: {
      actor: LockedAccount;
      target: LockedAccount;
      activeAdminCount: number;
    },
  ) => Promise<PersonResult>,
): Promise<PersonResult> {
  return db.transaction(async (tx) => {
    const rows = await lockAccounts(tx, input.workspaceId);
    const actor = rows.find((r) => r.id === input.actorId);
    checkLockedActor(actor);
    const target = rows.find((r) => r.id === input.targetId);
    if (!target) {
      throw new AppError(404, ErrorCodes.notFound, "No such person.");
    }
    const activeAdminCount = rows.filter(
      (r) => r.role === "admin" && r.status === "active",
    ).length;
    return work(tx, {
      actor: actor as LockedAccount,
      target,
      activeAdminCount,
    });
  });
}

const view = (a: LockedAccount): MemberAccount => ({
  id: a.id,
  email: a.email,
  displayName: a.displayName,
  role: a.role,
  status: a.status,
});
const facts = (a: LockedAccount) => ({ role: a.role, status: a.status });

export function changeRole(
  db: Db,
  input: PersonInput & { role: Role },
): Promise<PersonResult> {
  return withLockedPeople(db, input, async (tx, p) => {
    refuse(canChangeRole(p.actor, p.target, input.role, p.activeAdminCount));
    if (p.target.role === input.role) {
      return { member: view(p.target), endedSessionIds: [], event: null };
    }
    const after = { ...p.target, role: input.role };
    await tx
      .update(users)
      .set({ role: input.role })
      .where(eq(users.id, p.target.id));
    await recordAction(tx, {
      workspaceId: input.workspaceId,
      actorId: p.actor.id,
      action: "role_changed",
      targetUserId: p.target.id,
      detail: { role: input.role, earlierRole: p.target.role },
      at: input.now,
    });
    return {
      member: view(after),
      endedSessionIds: [],
      event: {
        kind: "role_changed",
        actorId: p.actor.id,
        targetId: p.target.id,
        before: facts(p.target),
        after: facts(after),
        at: input.now,
      },
    };
  });
}

export function deactivate(db: Db, input: PersonInput): Promise<PersonResult> {
  return withLockedPeople(db, input, async (tx, p) => {
    refuse(canDeactivateAccount(p.actor, p.target, p.activeAdminCount));
    if (p.target.status === "deactivated") {
      // Nothing to change or record; a session that a sign-in running at
      // that moment made is still ended (R29).
      const endedSessionIds = await endSessionsOfUser(tx, p.target.id, {
        reason: "deactivated",
      });
      return { member: view(p.target), endedSessionIds, event: null };
    }
    const after = { ...p.target, status: "deactivated" as const };
    await tx
      .update(users)
      .set({ status: "deactivated" })
      .where(eq(users.id, p.target.id));
    // In the same transaction: no committed state has a deactivated person
    // with a live session (R28).
    const endedSessionIds = await endSessionsOfUser(tx, p.target.id, {
      reason: "deactivated",
    });
    await recordAction(tx, {
      workspaceId: input.workspaceId,
      actorId: p.actor.id,
      action: "account_deactivated",
      targetUserId: p.target.id,
      detail: { role: p.target.role },
      at: input.now,
    });
    return {
      member: view(after),
      endedSessionIds,
      event: {
        kind: "account_deactivated",
        actorId: p.actor.id,
        targetId: p.target.id,
        before: facts(p.target),
        after: facts(after),
        at: input.now,
      },
    };
  });
}

export function reactivate(db: Db, input: PersonInput): Promise<PersonResult> {
  return withLockedPeople(db, input, async (tx, p) => {
    refuse(canReactivateAccount(p.actor));
    if (p.target.status === "active") {
      return { member: view(p.target), endedSessionIds: [], event: null };
    }
    // Before the status: a session row that was never ended would live again
    // when the account is active (R30).
    const endedSessionIds = await endSessionsOfUser(tx, p.target.id, {
      reason: "deactivated",
    });
    const after = { ...p.target, status: "active" as const };
    await tx
      .update(users)
      .set({ status: "active" })
      .where(eq(users.id, p.target.id));
    // The unclosed invitation of the person, locked after the accounts (R39),
    // is closed as used: its Join link then leads to the normal sign-in page,
    // and its role is dropped (concern 14).
    const [open] = await tx
      .select({ id: invitations.id, role: invitations.role })
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, input.workspaceId),
          or(
            eq(invitations.userId, p.target.id),
            eq(invitations.email, p.target.email),
          ),
          isNull(invitations.usedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .for("no key update");
    if (open) {
      await tx
        .update(invitations)
        .set({ usedAt: input.now, usedBy: p.target.id })
        .where(eq(invitations.id, open.id));
    }
    await recordAction(tx, {
      workspaceId: input.workspaceId,
      actorId: p.actor.id,
      action: "account_reactivated",
      targetUserId: p.target.id,
      detail: {
        role: p.target.role,
        ...(open ? { closedInvitation: { id: open.id, role: open.role } } : {}),
      },
      at: input.now,
    });
    return {
      member: view(after),
      endedSessionIds,
      event: {
        kind: "account_reactivated",
        actorId: p.actor.id,
        targetId: p.target.id,
        before: facts(p.target),
        after: facts(after),
        at: input.now,
      },
    };
  });
}
