import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

// One row per push registration of a signed-in device. Not exported from the
// module's index.ts. Foreign keys are written as SQL in the migration (R22).
// No time column has a database default (R6).
export const devices = pgTable(
  "devices",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    userId: uuid("user_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    pushChannel: text("push_channel").notNull(),
    pushAddress: jsonb("push_address")
      .$type<Record<string, unknown>>()
      .notNull(),
  },
  (t) => [
    unique("devices_session_id_key").on(t.sessionId),
    check(
      "devices_push_channel_check",
      sql`${t.pushChannel} in ('web_push', 'apns', 'fcm')`,
    ),
    check(
      "devices_push_address_check",
      sql`jsonb_typeof(${t.pushAddress}) = 'object'`,
    ),
    index("devices_user_id_idx").on(t.userId),
  ],
);
