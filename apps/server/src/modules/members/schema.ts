import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

// One row per person who has an account. Not exported from the module's
// index.ts, so no other module reads the table. The foreign key to
// workspaces is written as SQL in the migration (R22): a schema file may not
// import another module's table. No time column has a database default; the
// server writes the time (R6).
export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull(),
    language: text("language").notNull().default("en"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("users_workspace_id_email_key").on(t.workspaceId, t.email),
    check(
      "users_email_check",
      sql`${t.email} = lower(${t.email}) and ${t.email} !~ '[[:space:]]'`,
    ),
    check("users_email_length_check", sql`char_length(${t.email}) <= 254`),
    check(
      "users_display_name_length_check",
      sql`char_length(${t.displayName}) between 1 and 80`,
    ),
    check("users_role_check", sql`${t.role} in ('member', 'admin')`),
    check("users_status_check", sql`${t.status} in ('active', 'deactivated')`),
    check("users_language_check", sql`${t.language} in ('en', 'vi')`),
  ],
);
