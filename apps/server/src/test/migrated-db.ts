import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrationsFolder, runMigrations } from "../db/migrate.js";
import { createThrowawayDb } from "./throwaway-db.js";

// Test-only: a throwaway database with every migration applied, a raw client
// (for rows made by SQL text) and a Drizzle client (for the functions of a
// module).
export async function createMigratedDb() {
  const throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  const open = () => postgres(throwaway.url, { max: 1, onnotice: () => {} });
  // drizzle() changes how its client serializes dates, so the raw client for
  // SQL text and the one given to Drizzle are never the same client.
  const sql = open();
  const drizzleClient = open();
  const clients = [sql, drizzleClient];
  return {
    url: throwaway.url,
    sql,
    db: drizzle(drizzleClient),
    // A second Drizzle client on the same database, for tests that need two
    // connections.
    connect() {
      const extra = open();
      clients.push(extra);
      return { db: drizzle(extra) };
    },
    async close() {
      await Promise.all(clients.map((c) => c.end()));
      await throwaway.drop();
    },
  };
}
