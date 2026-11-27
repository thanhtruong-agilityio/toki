import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { EVENT_SCOPES, type EventScope } from "@toki/shared";

// The event log (TOKI-036 R13, R14). Not exported from the module's index.ts.
// The foreign keys, which all leave the module, and the functions and triggers
// of R13 and R14 are SQL in the migration. A number is read as a JavaScript
// number, so the checks keep it where the conversion loses nothing.
const MAX_NUMBER = sql.raw(String(Number.MAX_SAFE_INTEGER));
const SCOPES = EVENT_SCOPES.map((scope) => `'${scope}'`).join(", ");

export const events = pgTable(
  "events",
  {
    workspaceId: uuid("workspace_id").notNull(),
    number: bigint("number", { mode: "number" }).notNull(),
    // Who the event is for.
    scope: text("scope").$type<EventScope>().notNull(),
    conversationId: uuid("conversation_id"),
    userId: uuid("user_id"),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "events_pkey",
      columns: [table.workspaceId, table.number],
    }),
    check(
      "events_number_check",
      sql`${table.number} between 1 and ${MAX_NUMBER}`,
    ),
    check("events_scope_check", sql`${table.scope} in (${sql.raw(SCOPES)})`),
    check(
      "events_scope_shape_check",
      sql`(${table.scope} = 'workspace' and ${table.conversationId} is null and ${table.userId} is null) or (${table.scope} = 'conversation' and ${table.conversationId} is not null and ${table.userId} is null) or (${table.scope} = 'user' and ${table.userId} is not null and ${table.conversationId} is null)`,
    ),
    check("events_type_check", sql`${table.type} ~ '^[a-z][a-z0-9_.]{0,63}$'`),
    check(
      "events_payload_check",
      sql`jsonb_typeof(${table.payload}) = 'object'`,
    ),
    // Read by the pruning.
    index("events_created_at_idx").on(table.createdAt),
  ],
);

// One row per workspace: the last number that was given out. The row is made by
// the first event, or with 0 by lockEventCounter (R14, R27).
export const eventCounters = pgTable(
  "event_counters",
  {
    workspaceId: uuid("workspace_id").primaryKey(),
    lastNumber: bigint("last_number", { mode: "number" }).notNull(),
  },
  (table) => [
    check(
      "event_counters_last_number_check",
      sql`${table.lastNumber} between 0 and ${MAX_NUMBER}`,
    ),
  ],
);
