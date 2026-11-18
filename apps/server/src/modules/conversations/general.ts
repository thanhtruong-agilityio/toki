import { and, eq } from "drizzle-orm";
import type { Db } from "./facts.js";
import { conversationMembers, conversations } from "./schema.js";

// The two writes of #general's rows (R25, R26). They are the only code that
// writes the fixed values of #general, they open no transaction of their own,
// and they take the caller's database client or transaction.

export async function createGeneralChannel(
  tx: Db,
  input: { workspaceId: string; createdBy: string; createdAt: Date },
): Promise<string> {
  const [created] = await tx
    .insert(conversations)
    .values({
      workspaceId: input.workspaceId,
      kind: "channel",
      name: "general",
      topic: null,
      description: null,
      isPrivate: false,
      isGeneral: true,
      dmKey: null,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
      archivedAt: null,
    })
    .returning({ id: conversations.id });
  const id = created!.id;
  await tx.insert(conversationMembers).values({
    conversationId: id,
    userId: input.createdBy,
    workspaceId: input.workspaceId,
    notificationLevel: null,
    isMuted: false,
    isStarred: false,
    createdAt: input.createdAt,
  });
  return id;
}

// True when the row was added, false when the person already was a member (the
// row that exists is not changed). Throws when the workspace has no #general.
export async function addMemberToGeneral(
  tx: Db,
  input: { workspaceId: string; userId: string; createdAt: Date },
): Promise<boolean> {
  const [general] = await tx
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, input.workspaceId),
        eq(conversations.isGeneral, true),
      ),
    )
    .limit(1);
  if (!general) {
    throw new Error(`workspace ${input.workspaceId} has no #general channel`);
  }
  const added = await tx
    .insert(conversationMembers)
    .values({
      conversationId: general.id,
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
