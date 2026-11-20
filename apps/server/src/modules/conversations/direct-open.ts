import {
  ErrorCodes,
  canCreateDirectConversation,
  effectiveNotificationLevel,
  type DirectConversationEntry,
  type NotificationLevel,
} from "@toki/shared";
import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { refusal } from "./access.js";
import type { DirectDeps } from "./deps.js";
import { checkPeople, type DirectPlan } from "./direct.js";
import { conversationMembers, conversations } from "./schema.js";

export type OpenDirectResult = {
  status: 200 | 201;
  conversation: DirectConversationEntry;
};

type Found = {
  id: string;
  kind: string;
  dmKey: string | null;
  notificationLevel: string | null;
  isMuted: boolean;
  isStarred: boolean;
};

// The entry of the bootstrap call (R18). The level, mute and star are the
// caller's own, and the level is the one that applies.
function entryOf(found: Found): DirectConversationEntry {
  const kind = found.kind as "dm" | "group_dm";
  return {
    id: found.id,
    kind,
    name: null,
    topic: null,
    isPrivate: true,
    isGeneral: false,
    notificationLevel: effectiveNotificationLevel(
      kind,
      found.notificationLevel as NotificationLevel | null,
    ),
    isMuted: found.isMuted,
    isStarred: found.isStarred,
    memberIds: found.dmKey!.split(","),
  };
}

// The conversation of the key, with the caller's member row. The caller is
// always in the key, so the row is there.
async function findByKey(
  tx: DbClient,
  workspaceId: string,
  key: string,
  callerId: string,
): Promise<Found | undefined> {
  const [row] = await tx
    .select({
      id: conversations.id,
      kind: conversations.kind,
      dmKey: conversations.dmKey,
      notificationLevel: conversationMembers.notificationLevel,
      isMuted: conversationMembers.isMuted,
      isStarred: conversationMembers.isStarred,
    })
    .from(conversations)
    .innerJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, conversations.id),
        eq(conversationMembers.userId, callerId),
      ),
    )
    .where(
      and(
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.dmKey, key),
      ),
    )
    .limit(1);
  return row;
}

// Steps 4 and 5 of "How a request runs" (TOKI-030). One transaction at READ
// COMMITTED, set here: the insert waits for a concurrent insert of the same
// key and the read that follows must see its row, which a REPEATABLE READ
// snapshot would not (R13, R22).
export async function openDirect(
  deps: DirectDeps,
  actorId: string,
  plan: DirectPlan,
): Promise<OpenDirectResult> {
  const mayTakePart =
    deps.canCreateDirectConversation ?? canCreateDirectConversation;
  const now = new Date(deps.clock.now());
  return deps.db.transaction(
    async (tx) => {
      // The first statement: the caller and the others, locked FOR SHARE in id
      // order. The caller's role and status come from the locked row.
      const rows = await deps.getAccountsByIds(tx, [actorId, ...plan.others], {
        lock: "share",
      });
      const caller = rows.find((r) => r.id === actorId);
      if (!caller) {
        throw new AppError(
          401,
          ErrorCodes.unauthenticated,
          "A session is required.",
        );
      }
      if (caller.status === "deactivated") {
        throw new AppError(
          401,
          ErrorCodes.accountDeactivated,
          "This account is deactivated.",
        );
      }
      const decision = mayTakePart({ id: caller.id, role: caller.role });
      if (!decision.allowed) throw refusal(decision.reason);

      const people = checkPeople(caller, rows, plan.others, mayTakePart);
      if (people.kind === "failure") {
        throw new Error(`A permission function refused with ${people.reason}.`);
      }
      if (people.kind === "not_found") {
        throw new AppError(404, ErrorCodes.notFound, "No such person.");
      }

      // An existing conversation wins over a deactivated person (R9).
      const existing = await findByKey(
        tx,
        caller.workspaceId,
        plan.key,
        caller.id,
      );
      if (existing) return { status: 200, conversation: entryOf(existing) };

      if (people.deactivated.length > 0) {
        throw new AppError(
          409,
          ErrorCodes.personDeactivated,
          "A person in this conversation is deactivated.",
          { userIds: people.deactivated },
        );
      }

      const inserted = await tx
        .insert(conversations)
        .values({
          workspaceId: caller.workspaceId,
          kind: plan.kind,
          name: null,
          topic: null,
          description: null,
          isPrivate: true,
          isGeneral: false,
          dmKey: plan.key,
          createdBy: caller.id,
          createdAt: now,
          archivedAt: null,
        })
        .onConflictDoNothing({
          target: [conversations.workspaceId, conversations.dmKey],
        })
        .returning({ id: conversations.id });

      if (inserted.length === 1) {
        await tx.insert(conversationMembers).values(
          plan.memberIds.map((userId) => ({
            conversationId: inserted[0]!.id,
            userId,
            workspaceId: caller.workspaceId,
            notificationLevel: null,
            isMuted: false,
            isStarred: false,
            createdAt: now,
          })),
        );
        return {
          status: 201,
          conversation: entryOf({
            id: inserted[0]!.id,
            kind: plan.kind,
            dmKey: plan.key,
            notificationLevel: null,
            isMuted: false,
            isStarred: false,
          }),
        };
      }

      // Another request made the same conversation between the read and the
      // insert (the insert waited for it to commit): read it by the key.
      const made = await findByKey(tx, caller.workspaceId, plan.key, caller.id);
      return { status: 200, conversation: entryOf(made!) };
    },
    { isolationLevel: "read committed" },
  );
}
