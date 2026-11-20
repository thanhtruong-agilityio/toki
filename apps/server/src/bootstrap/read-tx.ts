import { PgDialect } from "drizzle-orm/pg-core";
import { PostgresJsDatabase, PostgresJsSession } from "drizzle-orm/postgres-js";
import type { Db, Tx } from "../db/client.js";

// Runs `fn` in one read-only transaction at repeatable read, so every read
// inside it sees the same snapshot (TOKI-031 R10). The mode is part of the
// `begin` statement: Drizzle's own `db.transaction(fn, config)` sends it as a
// separate `set transaction`, one more statement than R14 counts. The driver
// hands `fn` a scoped client, which `drizzle(client)` cannot wrap (it has no
// `options`), so the handle is built from the session, as Drizzle does inside
// its own transaction. This is the only place that knows about the driver.
const dialect = new PgDialect();

export function inReadSnapshot<T>(
  db: Db,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.$client.begin(
    "isolation level repeatable read read only",
    async (scoped) => {
      const session = new PostgresJsSession(
        scoped as never,
        dialect,
        undefined,
      );
      const handle = new PostgresJsDatabase(dialect, session, undefined);
      return fn(handle as unknown as Tx);
    },
  ) as Promise<T>;
}
