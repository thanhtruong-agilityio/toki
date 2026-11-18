import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  CHANNEL_DESCRIPTION_MAX,
  CHANNEL_NAME_MAX,
  CHANNEL_TOPIC_MAX,
} from "@toki/shared";
import { uuidv7 } from "uuidv7";

// The two conversation tables (TOKI-028). Not exported from the module's
// index.ts, so no other module reads them: other modules call the functions
// of the module. The foreign keys that leave the module (workspace_id,
// created_by, user_id) are written as SQL in the migration (R16): a schema
// file may not import another module's table. The functions and triggers of
// R8, R10, R21 and R22 are SQL in the migration too. No time column has a
// database default; the server writes the time (R17).

// The name pattern, the topic and the description limit are the values of
// packages/shared (R15). A migration freezes the numbers it was generated
// with, so a change of a limit needs a new migration; a test runs the same
// lists through both.
const IDS = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    kind: text("kind").notNull(),
    name: text("name"),
    topic: text("topic"),
    description: text("description"),
    isPrivate: boolean("is_private").notNull().default(false),
    isGeneral: boolean("is_general").notNull().default(false),
    dmKey: text("dm_key"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "conversations_kind_check",
      sql`${table.kind} in ('channel', 'dm', 'group_dm')`,
    ),
    check(
      "conversations_channel_shape_check",
      sql`${table.kind} <> 'channel' or ${table.dmKey} is null`,
    ),
    check(
      "conversations_dm_shape_check",
      sql`${table.kind} = 'channel' or (${table.name} is null and ${table.topic} is null and ${table.description} is null and ${table.isPrivate} and ${table.archivedAt} is null)`,
    ),
    check(
      "conversations_name_check",
      sql`${table.kind} <> 'channel' or (${table.name} is not null and ${table.name} ~ ${sql.raw(`'^[a-z0-9-]{1,${CHANNEL_NAME_MAX}}$'`)})`,
    ),
    check(
      "conversations_topic_check",
      sql`${table.topic} is null or char_length(${table.topic}) between 1 and ${sql.raw(String(CHANNEL_TOPIC_MAX))}`,
    ),
    check(
      "conversations_description_check",
      sql`${table.description} is null or char_length(${table.description}) between 1 and ${sql.raw(String(CHANNEL_DESCRIPTION_MAX))}`,
    ),
    check(
      "conversations_general_shape_check",
      sql`not ${table.isGeneral} or (${table.kind} = 'channel' and not ${table.isPrivate} and ${table.archivedAt} is null)`,
    ),
    check(
      "conversations_general_name_check",
      sql`${table.kind} <> 'channel' or ${table.isGeneral} = (${table.name} = 'general')`,
    ),
    check(
      "conversations_dm_key_shape_check",
      sql`${table.kind} = 'channel' or (${table.dmKey} is not null and ${table.dmKey} ~ ${sql.raw(`'^${IDS}(,${IDS})*$'`)})`,
    ),
    check(
      "conversations_dm_key_order_check",
      sql`${table.kind} = 'channel' or conversations_dm_key_sorted(${table.dmKey})`,
    ),
    check(
      "conversations_dm_key_size_check",
      sql`${table.kind} not in ('dm', 'group_dm') or (${table.dmKey} is not null and ((${table.kind} = 'dm' and cardinality(string_to_array(${table.dmKey}, ',')) = 2) or (${table.kind} = 'group_dm' and cardinality(string_to_array(${table.dmKey}, ',')) between 3 and 8)))`,
    ),
    unique("conversations_workspace_id_name_key").on(
      table.workspaceId,
      table.name,
    ),
    unique("conversations_workspace_id_dm_key_key").on(
      table.workspaceId,
      table.dmKey,
    ),
    unique("conversations_id_workspace_id_key").on(table.id, table.workspaceId),
  ],
);

// A row means the person is a member; leaving deletes the row (concern 5).
// No id: the pair is the key, as convention 1 of TOKI-019 allows.
export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id").notNull(),
    userId: uuid("user_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    notificationLevel: text("notification_level"),
    isMuted: boolean("is_muted").notNull().default(false),
    isStarred: boolean("is_starred").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "conversation_members_pkey",
      columns: [table.conversationId, table.userId],
    }),
    foreignKey({
      name: "conversation_members_conversation_id_fkey",
      columns: [table.conversationId, table.workspaceId],
      foreignColumns: [conversations.id, conversations.workspaceId],
    }).onDelete("restrict"),
    check(
      "conversation_members_notification_level_check",
      sql`${table.notificationLevel} is null or ${table.notificationLevel} in ('all', 'mentions', 'none')`,
    ),
    index("conversation_members_user_id_idx").on(table.userId),
  ],
);
