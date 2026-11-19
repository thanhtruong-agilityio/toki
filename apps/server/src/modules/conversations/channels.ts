import {
  ErrorCodes,
  canCreateChannel,
  canAddPeopleToChannel,
  canArchiveChannel,
  canEditChannelDetails,
  canJoinChannel,
  canLeaveChannel,
  canRemovePeopleFromChannel,
  canRestoreChannel,
  effectiveNotificationLevel,
  type ChannelDetail,
  type ConversationFacts,
  type CreateChannelBodySchema,
  type EditChannelBodySchema,
  type SettingsPatch,
} from "@toki/shared";
import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import type { DbClient } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { checkAccess, refusal, type Permission } from "./access.js";
import { readChannelDetail } from "./browse.js";
import type { AccountFacts, ChannelDeps } from "./deps.js";
import { conversationMembers, conversations } from "./schema.js";

// The writes behind the routes. Each runs in one transaction that takes its
// locks in the order of TOKI-024 R39 (R15): the `users` rows `FOR SHARE` in id
// order in one statement, then the conversation row `FOR NO KEY UPDATE`, then
// the member rows.

// Locks the account rows of the actor and of the people the request names, and
// the conversation row when there is one. The actor is read again from the
// locked row, so a demotion or a deactivation that happened while the request
// waited takes effect for this request (R1 step 5). Create has no conversation
// row to lock.
export async function lockForWrite(
  deps: Pick<ChannelDeps, "getAccountsByIds">,
  tx: DbClient,
  actorId: string,
  otherIds: readonly string[],
  conversationId?: string,
): Promise<{ actor: AccountFacts; accounts: Map<string, AccountFacts> }> {
  const ids = [...new Set([actorId, ...otherIds])];
  const rows = await deps.getAccountsByIds(tx, ids, { lock: "share" });
  const accounts = new Map(rows.map((r) => [r.id, r]));
  const actor = accounts.get(actorId);
  if (!actor) {
    throw new AppError(
      401,
      ErrorCodes.unauthenticated,
      "A session is required.",
    );
  }
  if (actor.status === "deactivated") {
    throw new AppError(
      401,
      ErrorCodes.accountDeactivated,
      "This account is deactivated.",
    );
  }
  if (conversationId !== undefined) {
    // A single-table select: the facts query has a left join, which cannot
    // carry this lock. A missing row is answered 404 by the check that follows.
    await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .for("no key update");
  }
  return { actor, accounts };
}

const invalidMember = () =>
  new AppError(
    400,
    ErrorCodes.invalidMember,
    "A person to add is unknown or not active.",
  );

// Every id must be the account of an active person of the actor's workspace;
// an unknown id, another workspace and a deactivated account are one answer.
export function requireActivePeople(
  actor: AccountFacts,
  accounts: Map<string, AccountFacts>,
  ids: readonly string[],
) {
  for (const id of ids) {
    const account = accounts.get(id);
    if (
      !account ||
      account.workspaceId !== actor.workspaceId ||
      account.status !== "active"
    ) {
      throw invalidMember();
    }
  }
}

type CreateBody = z.output<typeof CreateChannelBodySchema>;

// R3 to R5. The client makes the id, so a repeat of Create is the same
// request: the insert meets the unique name and the primary key without an
// error, and the row that is there decides whether this is a repeat.
export async function createChannel(
  deps: ChannelDeps,
  actorId: string,
  body: CreateBody,
): Promise<{ created: boolean; channel: ChannelDetail }> {
  const memberIds = [...new Set(body.memberIds ?? [])];
  return deps.db.transaction(async (tx) => {
    const { actor, accounts } = await lockForWrite(
      deps,
      tx,
      actorId,
      memberIds,
    );
    const decision = canCreateChannel({ id: actor.id, role: actor.role });
    if (!decision.allowed) throw refusal(decision.reason);
    requireActivePeople(actor, accounts, memberIds);

    const now = new Date(deps.clock.now());
    const inserted = await tx
      .insert(conversations)
      .values({
        id: body.id,
        workspaceId: actor.workspaceId,
        kind: "channel",
        name: body.name,
        topic: body.topic ?? null,
        description: null,
        isPrivate: body.isPrivate ?? false,
        isGeneral: false,
        dmKey: null,
        createdBy: actor.id,
        createdAt: now,
        archivedAt: null,
      })
      .onConflictDoNothing()
      .returning({ id: conversations.id });

    if (inserted.length === 1) {
      const everyone = [...new Set([actor.id, ...memberIds])];
      await tx.insert(conversationMembers).values(
        everyone.map((userId) => ({
          conversationId: body.id,
          userId,
          workspaceId: actor.workspaceId,
          notificationLevel: null,
          isMuted: false,
          isStarred: false,
          createdAt: now,
        })),
      );
      await deps.recordChange(tx, {
        type: "channel_created",
        actorId: actor.id,
        conversationId: body.id,
        userIds: everyone,
        at: now,
      });
      const channel = await readChannelDetail(deps, tx, actor.id, body.id);
      return { created: true, channel: channel! };
    }

    // Nothing was inserted: the id or the name is taken.
    const [existing] = await tx
      .select({
        createdBy: conversations.createdBy,
        name: conversations.name,
        isPrivate: conversations.isPrivate,
      })
      .from(conversations)
      .where(eq(conversations.id, body.id))
      .limit(1);
    if (!existing) {
      // No row has this id, so the name belongs to another channel, archived
      // or not (D-115, D-128).
      throw new AppError(
        409,
        ErrorCodes.channelNameTaken,
        "A channel with this name already exists.",
      );
    }
    const [membership] = await tx
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, body.id),
          eq(conversationMembers.userId, actor.id),
        ),
      )
      .limit(1);
    const isRepeat =
      existing.createdBy === actor.id &&
      existing.name === body.name &&
      existing.isPrivate === (body.isPrivate ?? false) &&
      membership !== undefined;
    if (!isRepeat) {
      // The same body whatever the channel is: it confirms only that the id is
      // taken, never what the channel is.
      throw new AppError(
        409,
        ErrorCodes.channelIdInUse,
        "This channel id is already in use.",
      );
    }
    const channel = await readChannelDetail(deps, tx, actor.id, body.id);
    return { created: false, channel: channel! };
  });
}

type Locked = {
  tx: DbClient;
  actor: AccountFacts;
  accounts: Map<string, AccountFacts>;
  facts: ConversationFacts;
  now: Date;
};

// The shape of every write on an existing conversation (R1 steps 3 to 5, R15):
// the check, then a transaction that locks the accounts and the conversation
// row, reads the actor and the facts again, and runs the write. A refusal
// before the lock costs no lock; a refusal after it is the one that counts.
export async function inConversationTx<T>(
  deps: ChannelDeps,
  account: { id: string; role: string },
  conversationId: string,
  otherIds: readonly string[],
  permission: Permission,
  work: (locked: Locked) => Promise<T>,
): Promise<T> {
  await checkAccess(deps, deps.db, account, conversationId, permission);
  return deps.db.transaction(async (tx) => {
    const { actor, accounts } = await lockForWrite(
      deps,
      tx,
      account.id,
      otherIds,
      conversationId,
    );
    const facts = await checkAccess(
      deps,
      tx,
      { id: actor.id, role: actor.role },
      conversationId,
      permission,
    );
    return work({
      tx,
      actor,
      accounts,
      facts,
      now: new Date(deps.clock.now()),
    });
  });
}

type EditBody = z.output<typeof EditChannelBodySchema>;

// R9: only the given fields are written, so two people changing two fields at
// once both keep their change; setting what is stored changes nothing.
export async function editChannelDetails(
  deps: ChannelDeps,
  account: { id: string; role: string },
  id: string,
  body: EditBody,
): Promise<{ channel: ChannelDetail; changed: boolean }> {
  return inConversationTx(
    deps,
    account,
    id,
    [],
    canEditChannelDetails,
    async ({ tx, actor, now }) => {
      const [current] = await tx
        .select({
          topic: conversations.topic,
          description: conversations.description,
        })
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1);
      const set: { topic?: string | null; description?: string | null } = {};
      if (body.topic !== undefined && body.topic !== current!.topic) {
        set.topic = body.topic;
      }
      if (
        body.description !== undefined &&
        body.description !== current!.description
      ) {
        set.description = body.description;
      }
      const changed = Object.keys(set).length > 0;
      if (changed) {
        await tx.update(conversations).set(set).where(eq(conversations.id, id));
        await deps.recordChange(tx, {
          type: "details_changed",
          actorId: actor.id,
          conversationId: id,
          userIds: [actor.id],
          at: now,
        });
      }
      const channel = await readChannelDetail(deps, tx, actor.id, id);
      return { channel: channel!, changed };
    },
  );
}

// R10: a public channel that is not archived. The member row has the defaults,
// or the values that come with the join (Undo of a leave gives back the level,
// mute and star the person had). A person who is already a member changes
// nothing and the values are ignored.
export async function joinChannel(
  deps: ChannelDeps,
  account: { id: string; role: string },
  id: string,
  settings: SettingsPatch = {},
): Promise<{ channel: ChannelDetail; changed: boolean }> {
  return inConversationTx(
    deps,
    account,
    id,
    [],
    canJoinChannel,
    async ({ tx, actor, now }) => {
      const inserted = await tx
        .insert(conversationMembers)
        .values({
          conversationId: id,
          userId: actor.id,
          workspaceId: actor.workspaceId,
          // The default of the kind is stored as null, as R22 does, so a later
          // change of the default applies to this person too.
          notificationLevel:
            settings.notificationLevel === undefined ||
            settings.notificationLevel ===
              effectiveNotificationLevel("channel", null)
              ? null
              : settings.notificationLevel,
          isMuted: settings.isMuted ?? false,
          isStarred: settings.isStarred ?? false,
          createdAt: now,
        })
        .onConflictDoNothing()
        .returning({ userId: conversationMembers.userId });
      const changed = inserted.length === 1;
      if (changed) {
        await deps.recordChange(tx, {
          type: "member_joined",
          actorId: actor.id,
          conversationId: id,
          userIds: [actor.id],
          at: now,
        });
      }
      const channel = await readChannelDetail(deps, tx, actor.id, id);
      return { channel: channel!, changed };
    },
  );
}

// R11: any member of either role adds people, in a private channel too. Every
// id must be an active person of the workspace, whether or not the person is
// already a member (so a deactivated member makes the whole request 400); then
// the people who are already members are skipped. The new rows have the
// defaults: a person who is added again does not get the old level back.
export async function addMembers(
  deps: ChannelDeps,
  account: { id: string; role: string },
  id: string,
  userIds: readonly string[],
): Promise<{ added: string[]; alreadyMembers: string[] }> {
  const ids = [...new Set(userIds)];
  return inConversationTx(
    deps,
    account,
    id,
    ids,
    canAddPeopleToChannel,
    async ({ tx, actor, accounts, now }) => {
      requireActivePeople(actor, accounts, ids);
      const existing = await tx
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, id),
            inArray(conversationMembers.userId, ids),
          ),
        );
      const present = new Set(existing.map((r) => r.userId));
      const added = ids.filter((u) => !present.has(u));
      const alreadyMembers = ids.filter((u) => present.has(u));
      if (added.length > 0) {
        await tx
          .insert(conversationMembers)
          .values(
            added.map((userId) => ({
              conversationId: id,
              userId,
              workspaceId: actor.workspaceId,
              notificationLevel: null,
              isMuted: false,
              isStarred: false,
              createdAt: now,
            })),
          )
          .onConflictDoNothing();
        await deps.recordChange(tx, {
          type: "members_added",
          actorId: actor.id,
          conversationId: id,
          userIds: added,
          at: now,
        });
      }
      return { added, alreadyMembers };
    },
  );
}

// Only a private channel is archived when its last member leaves (D-051,
// TOKI-028 concern 3, TOKI-029 concern 1): an empty public channel can still
// be joined by anyone.
export const archivesWhenEmptied = (isPrivate: boolean) => isPrivate;

// A person who is not a member of a public channel gets "nothing changed"
// instead of the refusal of the function, and before `channel_is_general`
// (R12): a repeat of a leave, or a leave after Undo, is harmless.
const leavePermission: Permission = (actor, facts) => {
  const decision = canLeaveChannel(actor, facts);
  return !decision.allowed && decision.reason === "not_a_member"
    ? { allowed: true }
    : decision;
};

// R12. One transaction with the lock of the conversation row: the member row
// is deleted and the people who remain are counted, the deactivated ones left
// out (concern 9). Their status is read after the lock with no lock of its
// own, because a `users` lock after the conversation lock would break the
// order of R15; a reactivation that commits after the read finds the channel
// archived, the same result as a reactivation a moment later.
export async function leaveChannel(
  deps: ChannelDeps,
  account: { id: string; role: string },
  id: string,
): Promise<{ changed: boolean; archived: boolean }> {
  return inConversationTx(
    deps,
    account,
    id,
    [],
    leavePermission,
    async ({ tx, actor, facts, now }) => {
      if (!facts.isMember) {
        return { changed: false, archived: facts.archived };
      }
      await tx
        .delete(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, id),
            eq(conversationMembers.userId, actor.id),
          ),
        );
      await deps.recordChange(tx, {
        type: "member_left",
        actorId: actor.id,
        conversationId: id,
        userIds: [actor.id],
        at: now,
      });
      let archived = facts.archived;
      if (!archived && archivesWhenEmptied(facts.kind === "private_channel")) {
        const rest = await tx
          .select({ userId: conversationMembers.userId })
          .from(conversationMembers)
          .where(eq(conversationMembers.conversationId, id));
        const accounts = await deps.getAccountsByIds(
          tx,
          rest.map((r) => r.userId),
        );
        if (!accounts.some((a) => a.status === "active")) {
          await tx
            .update(conversations)
            .set({ archivedAt: now })
            .where(eq(conversations.id, id));
          archived = true;
          await deps.recordChange(tx, {
            type: "channel_archived",
            actorId: actor.id,
            conversationId: id,
            userIds: [actor.id],
            at: now,
          });
        }
      }
      return { changed: true, archived };
    },
  );
}

// R13: an Admin who is a member removes a person; removing oneself is its own
// route (leave), which carries the last-member rule.
export async function removeMember(
  deps: ChannelDeps,
  account: { id: string; role: string },
  id: string,
  userId: string,
): Promise<{ changed: boolean }> {
  return inConversationTx(
    deps,
    account,
    id,
    [],
    canRemovePeopleFromChannel,
    async ({ tx, actor, now }) => {
      if (userId === actor.id) {
        throw new AppError(
          409,
          ErrorCodes.selfTarget,
          "Leave the channel instead of removing yourself.",
        );
      }
      const removed = await tx
        .delete(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, id),
            eq(conversationMembers.userId, userId),
          ),
        )
        .returning({ userId: conversationMembers.userId });
      if (removed.length === 0) return { changed: false };
      await deps.recordChange(tx, {
        type: "member_removed",
        actorId: actor.id,
        conversationId: id,
        userIds: [userId],
        at: now,
      });
      return { changed: true };
    },
  );
}

// R14. Archiving needs an Admin who is a member; archiving an archived channel
// changes nothing (the conflict that TOKI-027 leaves to the API, D-111).
// Members, files and history are kept.
export async function archiveChannel(
  deps: ChannelDeps,
  account: { id: string; role: string },
  id: string,
): Promise<{ channel: ChannelDetail; changed: boolean }> {
  return inConversationTx(
    deps,
    account,
    id,
    [],
    canArchiveChannel,
    async ({ tx, actor, facts, now }) => {
      const changed = !facts.archived;
      if (changed) {
        await tx
          .update(conversations)
          .set({ archivedAt: now })
          .where(eq(conversations.id, id));
        await deps.recordChange(tx, {
          type: "channel_archived",
          actorId: actor.id,
          conversationId: id,
          userIds: [actor.id],
          at: now,
        });
      }
      const channel = await readChannelDetail(deps, tx, actor.id, id);
      return { channel: channel!, changed };
    },
  );
}

// R14 and concern 2: any Admin restores, a member or not, and becomes a member
// with the defaults when they were not one. An Admin outside a private channel
// never reaches this: the access check answers 404 first. Restoring an active
// channel changes nothing and adds no member row.
export async function restoreChannel(
  deps: ChannelDeps,
  account: { id: string; role: string },
  id: string,
): Promise<{ channel: ChannelDetail; changed: boolean }> {
  return inConversationTx(
    deps,
    account,
    id,
    [],
    canRestoreChannel,
    async ({ tx, actor, facts, now }) => {
      const changed = facts.archived;
      if (changed) {
        await tx
          .update(conversations)
          .set({ archivedAt: null })
          .where(eq(conversations.id, id));
        await deps.recordChange(tx, {
          type: "channel_restored",
          actorId: actor.id,
          conversationId: id,
          userIds: [actor.id],
          at: now,
        });
        if (!facts.isMember) {
          await tx.insert(conversationMembers).values({
            conversationId: id,
            userId: actor.id,
            workspaceId: actor.workspaceId,
            notificationLevel: null,
            isMuted: false,
            isStarred: false,
            createdAt: now,
          });
          await deps.recordChange(tx, {
            type: "member_joined",
            actorId: actor.id,
            conversationId: id,
            userIds: [actor.id],
            at: now,
          });
        }
      }
      const channel = await readChannelDetail(deps, tx, actor.id, id);
      return { channel: channel!, changed };
    },
  );
}
