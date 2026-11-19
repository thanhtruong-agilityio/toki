import type { ConversationFacts } from "@toki/shared";
import { and, asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { conversationMembers, conversations } from "./schema.js";

// The database client or a transaction of it (TOKI-005): both fit.
export type Db = PostgresJsDatabase;

type FactsRow = {
  kind: string;
  isPrivate: boolean;
  isGeneral: boolean;
  archivedAt: Date | null;
  isMember: boolean;
};

// The one place that maps the columns to the facts of the permission functions
// (R18, Design "Reads for other modules"). The database never stores a
// combination this cannot name (R5, R9).
export function toConversationFacts(row: FactsRow): ConversationFacts {
  let kind: ConversationFacts["kind"];
  if (row.kind === "channel") {
    kind = row.isPrivate ? "private_channel" : "public_channel";
  } else if (row.kind === "dm" || row.kind === "group_dm") {
    kind = row.kind;
  } else {
    throw new Error(`conversations: unknown kind '${row.kind}'`);
  }
  return {
    kind,
    isGeneral: row.isGeneral,
    archived: row.archivedAt !== null,
    isMember: row.isMember,
  };
}

// The facts of a conversation for one person, or null when it does not exist
// (the caller answers "not found"). One query reads the conversation and the
// person's member row.
export async function getConversationFacts(
  db: Db,
  actorId: string,
  conversationId: string,
): Promise<ConversationFacts | null> {
  const rows = await db
    .select({
      kind: conversations.kind,
      isPrivate: conversations.isPrivate,
      isGeneral: conversations.isGeneral,
      archivedAt: conversations.archivedAt,
      memberUserId: conversationMembers.userId,
    })
    .from(conversations)
    .leftJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, conversations.id),
        eq(conversationMembers.userId, actorId),
      ),
    )
    .where(eq(conversations.id, conversationId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return toConversationFacts({ ...row, isMember: row.memberUserId !== null });
}

// True while a member row exists (D-077, D-116): for a request that needs no
// other fact.
export async function isConversationMember(
  db: Db,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const rows = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .limit(1);
  return rows.length === 1;
}

// Every member row, deactivated people included, ordered by id. A caller that
// counts members or applies the last-member rule drops the deactivated ones
// itself (concern 9).
export async function listMemberIds(
  db: Db,
  conversationId: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId))
    .orderBy(asc(conversationMembers.userId));
  return rows.map((r) => r.userId);
}
