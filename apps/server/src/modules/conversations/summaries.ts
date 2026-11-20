import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../db/client.js";
import { conversationMembers, conversations } from "./schema.js";

export type ConversationSummary = {
  id: string;
  kind: "channel" | "dm" | "group_dm";
  name: string | null;
  topic: string | null;
  isPrivate: boolean;
  isGeneral: boolean;
  // The level stored in the person's member row; null means "the default of
  // the kind", which the caller computes (TOKI-028 R15).
  notificationLevel: "all" | "mentions" | "none" | null;
  isMuted: boolean;
  isStarred: boolean;
  // For a direct message or group, the ids of its people in the order of its
  // key; null for a channel.
  memberIds: string[] | null;
};

// The conversations of one person for the first screen (TOKI-031 R6, R7,
// R15): those with a member row of `userId` that are not archived, in one
// statement. The join on the person's own member row is in the query itself,
// so a conversation the person is not in cannot come back, and the level,
// mute and star are the person's own. The ids of a direct message come from
// its key (the ids of its people, in the order of the key, TOKI-028 R10 and
// R21), split at the commas. Ordered by id in byte order (collation "C").
export async function listConversationSummaries(
  client: DbClient,
  workspaceId: string,
  userId: string,
): Promise<ConversationSummary[]> {
  const rows = await client
    .select({
      id: conversations.id,
      kind: conversations.kind,
      name: conversations.name,
      topic: conversations.topic,
      isPrivate: conversations.isPrivate,
      isGeneral: conversations.isGeneral,
      notificationLevel: conversationMembers.notificationLevel,
      isMuted: conversationMembers.isMuted,
      isStarred: conversationMembers.isStarred,
      memberIds: sql<
        string[] | null
      >`string_to_array(${conversations.dmKey}, ',')`,
    })
    .from(conversations)
    .innerJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, conversations.id),
        eq(conversationMembers.userId, userId),
        eq(conversationMembers.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(conversations.workspaceId, workspaceId),
        isNull(conversations.archivedAt),
      ),
    )
    .orderBy(sql`${conversations.id}::text collate "C"`);
  return rows as ConversationSummary[];
}
