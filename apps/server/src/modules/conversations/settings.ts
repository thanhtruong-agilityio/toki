import {
  effectiveNotificationLevel,
  type ConversationFacts,
  type NotificationLevel,
  type SettingsPatch,
} from "@toki/shared";
import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/client.js";
import { refusal, type Actor } from "./access.js";
import { lockForWrite } from "./channels.js";
import type { ChannelDeps } from "./deps.js";
import { conversationMembers } from "./schema.js";

// R22: a person saves their own level, mute and star of a conversation of any
// kind. The only condition is membership: no role and no state of the
// conversation changes it, so an archived channel and #general are allowed.
// The three values are personal and seen by nobody else, which is why no
// permission function exists for it (TOKI-027 defines none).
async function requireMember(
  deps: Pick<ChannelDeps, "getConversationFacts">,
  client: DbClient,
  actor: Actor,
  id: string,
): Promise<ConversationFacts> {
  const facts = await deps.getConversationFacts(client, actor.id, id);
  // The same answer as for a conversation the person may not know about.
  if (facts === null) throw refusal("not_a_channel");
  if (!facts.isMember) {
    // A public channel may be seen by anyone, so the refusal is 403; a
    // private channel, a DM or a group is never confirmed.
    throw refusal(
      facts.kind === "public_channel" ? "not_a_member" : "private_channel",
    );
  }
  return facts;
}

const kindOf = (facts: ConversationFacts) =>
  facts.kind === "public_channel" || facts.kind === "private_channel"
    ? ("channel" as const)
    : facts.kind;

export async function updateSettings(
  deps: Pick<
    ChannelDeps,
    | "db"
    | "clock"
    | "getAccountsByIds"
    | "recordChange"
    | "getConversationFacts"
  >,
  account: Actor,
  id: string,
  patch: SettingsPatch,
): Promise<{
  settings: {
    notificationLevel: NotificationLevel;
    isMuted: boolean;
    isStarred: boolean;
  };
  changed: boolean;
}> {
  await requireMember(deps, deps.db, account, id);
  return deps.db.transaction(async (tx) => {
    const { actor } = await lockForWrite(deps, tx, account.id, [], id);
    const facts = await requireMember(
      deps,
      tx,
      { id: actor.id, role: actor.role },
      id,
    );
    const [row] = await tx
      .select({
        notificationLevel: conversationMembers.notificationLevel,
        isMuted: conversationMembers.isMuted,
        isStarred: conversationMembers.isStarred,
      })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, id),
          eq(conversationMembers.userId, actor.id),
        ),
      )
      .limit(1);
    const kind = kindOf(facts);
    const stored = row!.notificationLevel as NotificationLevel | null;
    const applies = effectiveNotificationLevel(kind, stored);

    // A key whose value equals what applies is not written, so a stored null
    // level stays null when the request sends the default of the kind.
    const set: {
      notificationLevel?: NotificationLevel;
      isMuted?: boolean;
      isStarred?: boolean;
    } = {};
    if (
      patch.notificationLevel !== undefined &&
      patch.notificationLevel !== applies
    ) {
      set.notificationLevel = patch.notificationLevel;
    }
    if (patch.isMuted !== undefined && patch.isMuted !== row!.isMuted) {
      set.isMuted = patch.isMuted;
    }
    if (patch.isStarred !== undefined && patch.isStarred !== row!.isStarred) {
      set.isStarred = patch.isStarred;
    }
    const changed = Object.keys(set).length > 0;
    if (changed) {
      await tx
        .update(conversationMembers)
        .set(set)
        .where(
          and(
            eq(conversationMembers.conversationId, id),
            eq(conversationMembers.userId, actor.id),
          ),
        );
      await deps.recordChange(tx, {
        type: "settings_changed",
        actorId: actor.id,
        conversationId: id,
        userIds: [actor.id],
        at: new Date(deps.clock.now()),
      });
    }
    return {
      settings: {
        notificationLevel: effectiveNotificationLevel(
          kind,
          set.notificationLevel ?? stored,
        ),
        isMuted: set.isMuted ?? row!.isMuted,
        isStarred: set.isStarred ?? row!.isStarred,
      },
      changed,
    };
  });
}
