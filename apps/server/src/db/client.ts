import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Builds a client from the value it is given and reads no environment. The
// connection opens on the first query, so an unreachable Postgres does not
// stop the caller from starting. Each module imports its own tables.
export function createDb(connection: string) {
  const client = postgres(connection);
  return { db: drizzle(client), close: () => client.end() };
}

export type Db = ReturnType<typeof createDb>["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
// What a function that reads or writes takes first: the database, or an open
// transaction when the caller wants its work to commit or roll back with it.
export type DbClient = Db | Tx;
