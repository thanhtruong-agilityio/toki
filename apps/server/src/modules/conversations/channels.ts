import {
  ErrorCodes,
  canCreateChannel,
  type ChannelDetail,
  type CreateChannelBodySchema,
} from "@toki/shared";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import type { DbClient } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { refusal } from "./access.js";
import { readChannelDetail } from "./browse.js";
import type { AccountFacts, ChannelDeps } from "./deps.js";
import { conversationMembers, conversations } from "./schema.js";

// The writes behind the routes. Each runs in one transaction that takes its
// locks in the order of TOKI-024 R39 (R15): the `users` rows `FOR SHARE` in id
// order in one statement, then the conversation row `FOR NO KEY UPDATE`, then
// the member rows.

type Writer = Pick<
  ChannelDeps,
  "db" | "clock" | "getAccountsByIds" | "recordChange" | "getConversationFacts"
>;

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
  deps: Writer,
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
