import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// The folder of apps/server, with the SQL files and meta/ beside each other.
export const migrationsFolder = new URL("../../migrations", import.meta.url)
  .pathname;

// Applies every pending migration in order. A second run changes nothing.
export async function runMigrations(connection: string, folder: string) {
  const client = postgres(connection, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: folder });
  } finally {
    await client.end();
  }
}
