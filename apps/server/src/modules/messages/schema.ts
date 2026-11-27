import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { MESSAGE_KINDS, MESSAGE_TEXT_MAX } from "@toki/shared";
import { uuidv7 } from "uuidv7";

// The table `messages` (TOKI-036): channel messages, direct messages, thread
// replies and system lines in one table. Not exported from the module's
// index.ts. The foreign keys that leave the module (workspace_id,
// conversation_id, author_id, deleted_by) are written as SQL in the migration
// (R9): a schema file may not import another module's table. The functions and
// triggers of R5, R7 and R8 are SQL in the migration too. No time column has a
// database default; the server writes the time (R10). The order of messages is
// (created_at, id) (R12).

// The limit and the kinds are the values of packages/shared (R22). A migration
// freezes what it was generated with.
const KINDS = MESSAGE_KINDS.map((kind) => `'${kind}'`).join(", ");

export const messages = pgTable(
  "messages",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    conversationId: uuid("conversation_id").notNull(),
    authorId: uuid("author_id").notNull(),
    kind: text("kind").notNull(),
    systemType: text("system_type"),
    systemUserIds: uuid("system_user_ids").array(),
    body: text("body").notNull(),
    parentId: uuid("parent_id"),
    alsoInChannel: boolean("also_in_channel").notNull().default(false),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check("messages_kind_check", sql`${table.kind} in (${sql.raw(KINDS)})`),
    check(
      "messages_system_shape_check",
      sql`${table.kind} <> 'system' or (${table.systemType} is not null and ${table.systemType} ~ '^[a-z][a-z0-9_]{0,63}$' and ${table.systemUserIds} is not null and ${table.body} = '' and ${table.parentId} is null and not ${table.alsoInChannel} and ${table.editedAt} is null and ${table.deletedAt} is null and ${table.deletedBy} is null)`,
    ),
    check(
      "messages_user_shape_check",
      sql`${table.kind} <> 'user' or (${table.systemType} is null and ${table.systemUserIds} is null)`,
    ),
    check(
      "messages_body_check",
      sql`char_length(${table.body}) <= ${sql.raw(String(MESSAGE_TEXT_MAX))}`,
    ),
    check(
      "messages_also_in_channel_check",
      sql`not ${table.alsoInChannel} or ${table.parentId} is not null`,
    ),
    check(
      "messages_deleted_check",
      sql`(${table.deletedAt} is null) = (${table.deletedBy} is null)`,
    ),
    unique("messages_id_conversation_id_key").on(
      table.id,
      table.conversationId,
    ),
    // A reply stays in the conversation of its parent (R5).
    foreignKey({
      name: "messages_parent_id_fkey",
      columns: [table.parentId, table.conversationId],
      foreignColumns: [table.id, table.conversationId],
    }).onDelete("restrict"),
    // The two reads of a conversation (R11). A query is served only when it
    // implies the predicate of the index.
    index("messages_conversation_main_idx")
      .on(table.conversationId, table.createdAt, table.id)
      .where(sql`${table.parentId} is null or ${table.alsoInChannel}`),
    index("messages_thread_idx")
      .on(table.parentId, table.createdAt, table.id)
      .where(sql`${table.parentId} is not null`),
  ],
);
