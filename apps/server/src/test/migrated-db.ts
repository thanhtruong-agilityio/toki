import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrationsFolder, runMigrations } from "../db/migrate.js";
import { createThrowawayDb } from "./throwaway-db.js";

// Test-only: a throwaway database with every migration applied, a raw client
// (for rows made by SQL text) and a Drizzle client (for the functions of a
// module). `connect()` opens another client on the same database, for the
// tests that need two connections.
export async function createMigratedDb() {
  const throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  const open = () => postgres(throwaway.url, { max: 1, onnotice: () => {} });
  const sql = open();
  const clients = [sql];
  return {
    url: throwaway.url,
    sql,
    db: drizzle(sql),
    connect() {
      const extra = open();
      clients.push(extra);
      return { sql: extra, db: drizzle(extra) };
    },
    async close() {
      await Promise.all(clients.map((c) => c.end()));
      await throwaway.drop();
    },
  };
}
