import type { ChannelDetail } from "@toki/shared";
import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/client.js";
import type { ChannelDeps } from "./deps.js";
import { conversationMembers, conversations } from "./schema.js";

// The count of a channel's members leaves out the people whose account is
// deactivated; their member rows stay (TOKI-029 R6, concern 9). This module
// does not read the `users` table, so the status comes from the injected
// `getAccountsByIds`, asked once for the ids of the rows read.
export async function readChannelDetail(
  deps: Pick<ChannelDeps, "getAccountsByIds">,
  client: DbClient,
  actorId: string,
  conversationId: string,
): Promise<ChannelDetail | null> {
  const [row] = await client
    .select({
      id: conversations.id,
      name: conversations.name,
      topic: conversations.topic,
      description: conversations.description,
      isPrivate: conversations.isPrivate,
      isGeneral: conversations.isGeneral,
      archivedAt: conversations.archivedAt,
      createdBy: conversations.createdBy,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || row.name === null) return null;
  const members = await client
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));
  const accounts = await deps.getAccountsByIds(
    client,
    members.map((m) => m.userId),
  );
  return {
    id: row.id,
    name: row.name,
    topic: row.topic,
    isPrivate: row.isPrivate,
    isGeneral: row.isGeneral,
    archived: row.archivedAt !== null,
    memberCount: accounts.filter((a) => a.status === "active").length,
    isMember: members.some((m) => m.userId === actorId),
    description: row.description,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
