import { and, eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "./facts.js";
import { conversationMembers, conversations } from "./schema.js";

// The two writes of #general's rows (R25, R26). They are the only code that
// writes the fixed values of #general, they open no transaction of their own,
// and they take the caller's database client or transaction.

export async function createGeneralChannel(
  tx: Db,
  input: { workspaceId: string; createdBy: string; createdAt: Date },
): Promise<string> {
  // One statement for both rows, so a caller that passes a client and not a
  // transaction never leaves a #general row without its creator. The id is
  // made here, as the Drizzle default of the table would make it.
  const id = uuidv7();
  await tx.execute(sql`
    with created as (
      insert into conversations
        (id, workspace_id, kind, name, topic, description, is_private,
         is_general, dm_key, created_by, created_at, archived_at)
      values
        (${id}, ${input.workspaceId}, 'channel', 'general', null, null, false,
         true, null, ${input.createdBy}, ${input.createdAt.toISOString()}::timestamptz, null)
      returning id, workspace_id, created_by, created_at
    )
    insert into conversation_members
      (conversation_id, user_id, workspace_id, notification_level, is_muted,
       is_starred, created_at)
    select id, created_by, workspace_id, null, false, false, created_at
    from created`);
  return id;
}

// The id of the workspace's #general. Throws when there is none.
export async function getGeneralConversationId(
  tx: Db,
  workspaceId: string,
): Promise<string> {
  const [general] = await tx
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.isGeneral, true),
      ),
    )
    .limit(1);
  if (!general) {
    throw new Error(`workspace ${workspaceId} has no #general channel`);
  }
  return general.id;
}

// True when the row was added, false when the person already was a member (the
// row that exists is not changed). Throws when the workspace has no #general.
export async function addMemberToGeneral(
  tx: Db,
  input: { workspaceId: string; userId: string; createdAt: Date },
): Promise<boolean> {
  const generalId = await getGeneralConversationId(tx, input.workspaceId);
  const added = await tx
    .insert(conversationMembers)
    .values({
      conversationId: generalId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      notificationLevel: null,
      isMuted: false,
      isStarred: false,
      createdAt: input.createdAt,
    })
    .onConflictDoNothing({
      target: [conversationMembers.conversationId, conversationMembers.userId],
    })
    .returning({ userId: conversationMembers.userId });
  return added.length === 1;
}
