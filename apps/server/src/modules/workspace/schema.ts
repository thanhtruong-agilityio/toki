import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

// workspaces.id is the workspace id: other tables point to it. Not exported
// from the module's index.ts, so no other module reads the table.
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "workspaces_name_length",
      sql`char_length(${table.name}) between 1 and 100`,
    ),
  ],
);
