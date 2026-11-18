import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Builds a client from the value it is given and reads no environment. The
// connection opens on the first query, so an unreachable Postgres does not
// stop the caller from starting. Each module imports its own tables.
export function createDb(connection: string) {
  const client = postgres(connection);
  return { db: drizzle(client), close: () => client.end() };
}
