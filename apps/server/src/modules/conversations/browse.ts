import {
  CHANNEL_NAME_PATTERN,
  ErrorCodes,
  UUID_PATTERN,
  type ChannelDetail,
  type ChannelSummary,
} from "@toki/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DbClient } from "../../db/client.js";
import { AppError } from "../../errors.js";
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

// The summary is the detail without what only a member reads (R7).
export function toSummary(detail: ChannelDetail): ChannelSummary {
  return {
    id: detail.id,
    name: detail.name,
    topic: detail.topic,
    isPrivate: detail.isPrivate,
    isGeneral: detail.isGeneral,
    archived: detail.archived,
    memberCount: detail.memberCount,
    isMember: detail.isMember,
  };
}

// A cursor is opaque to the client: base64url of the last row's sort key.
const encodeCursor = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const badCursor = () =>
  new AppError(
    400,
    ErrorCodes.validationFailed,
    "The request failed validation.",
    { issues: [{ path: ["cursor"], code: "invalid_cursor" }] },
  );

// The shape of `created_at::text`: what the cursor of a page of members holds.
const DB_TIME =
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:\d{2})?)?$/;

function decodeCursor(cursor: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw badCursor();
  return Buffer.from(cursor, "base64url").toString("utf8");
}

// R6: every public channel, archived ones included, and the private channels
// the person is in. Order: by name in byte order, and the cursor compares with
// the same collation, so reading every page gives each channel once. `search`
// is compared with strpos, so `%` and `_` are plain characters.
export async function listChannels(
  deps: Pick<ChannelDeps, "getAccountsByIds">,
  client: DbClient,
  actor: { id: string; workspaceId: string },
  query: { search?: string; limit: number; cursor?: string },
): Promise<{ channels: ChannelSummary[]; nextCursor: string | null }> {
  const conditions = [
    eq(conversations.workspaceId, actor.workspaceId),
    eq(conversations.kind, "channel"),
    sql`(${conversations.isPrivate} = false or exists (
      select 1 from conversation_members m
      where m.conversation_id = ${conversations.id} and m.user_id = ${actor.id}))`,
  ];
  if (query.search) {
    conditions.push(
      sql`strpos(lower(${conversations.name}), lower(${query.search})) > 0`,
    );
  }
  if (query.cursor !== undefined) {
    const name = decodeCursor(query.cursor);
    if (!CHANNEL_NAME_PATTERN.test(name)) throw badCursor();
    conditions.push(sql`${conversations.name} collate "C" > ${name}`);
  }
  const rows = await client
    .select({
      id: conversations.id,
      name: conversations.name,
      topic: conversations.topic,
      isPrivate: conversations.isPrivate,
      isGeneral: conversations.isGeneral,
      archivedAt: conversations.archivedAt,
    })
    .from(conversations)
    .where(and(...conditions))
    .orderBy(sql`${conversations.name} collate "C"`)
    .limit(query.limit + 1);
  const page = rows.slice(0, query.limit);

  const pairs =
    page.length === 0
      ? []
      : await client
          .select({
            conversationId: conversationMembers.conversationId,
            userId: conversationMembers.userId,
          })
          .from(conversationMembers)
          .where(
            inArray(
              conversationMembers.conversationId,
              page.map((r) => r.id),
            ),
          );
  const accounts = await deps.getAccountsByIds(client, [
    ...new Set(pairs.map((p) => p.userId)),
  ]);
  const active = new Set(
    accounts.filter((a) => a.status === "active").map((a) => a.id),
  );
  const channels = page.map((r) => {
    const own = pairs.filter((p) => p.conversationId === r.id);
    return {
      id: r.id,
      name: r.name!,
      topic: r.topic,
      isPrivate: r.isPrivate,
      isGeneral: r.isGeneral,
      archived: r.archivedAt !== null,
      memberCount: own.filter((p) => active.has(p.userId)).length,
      isMember: own.some((p) => p.userId === actor.id),
    };
  });
  return {
    channels,
    nextCursor:
      rows.length > query.limit ? encodeCursor(page.at(-1)!.name!) : null,
  };
}

// R8: every member row, deactivated people included, by join time and then by
// id. The cursor holds the time as the database writes it, so no precision is
// lost between pages.
export async function listChannelMembers(
  client: DbClient,
  conversationId: string,
  query: { limit: number; cursor?: string },
): Promise<{
  members: { userId: string; joinedAt: string }[];
  nextCursor: string | null;
}> {
  const conditions = [eq(conversationMembers.conversationId, conversationId)];
  if (query.cursor !== undefined) {
    const [at, userId, ...rest] = decodeCursor(query.cursor).split("|");
    if (!at || !userId || rest.length > 0 || !UUID_PATTERN.test(userId)) {
      throw badCursor();
    }
    if (!DB_TIME.test(at)) throw badCursor();
    conditions.push(
      sql`(${conversationMembers.createdAt}, ${conversationMembers.userId}) > (${at}::timestamptz, ${userId}::uuid)`,
    );
  }
  const rows = await client
    .select({
      userId: conversationMembers.userId,
      joinedAt: conversationMembers.createdAt,
      joinedAtText: sql<string>`${conversationMembers.createdAt}::text`,
    })
    .from(conversationMembers)
    .where(and(...conditions))
    .orderBy(
      asc(conversationMembers.createdAt),
      asc(conversationMembers.userId),
    )
    .limit(query.limit + 1);
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    members: page.map((r) => ({
      userId: r.userId,
      joinedAt: r.joinedAt.toISOString(),
    })),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor(`${last.joinedAtText}|${last.userId}`)
        : null,
  };
}
