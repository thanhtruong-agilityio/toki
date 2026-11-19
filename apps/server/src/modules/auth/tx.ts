import type { DbClient } from "../../db/client.js";

// Given the database, opens its own transaction; given a transaction, joins it
// and commits nothing (R53). `own` tells the caller which one it was, because
// a report after the commit is its own to make only when it opened it (R50).
export async function withTransaction<T>(
  client: DbClient,
  work: (tx: DbClient) => Promise<T>,
): Promise<{ result: T; own: boolean }> {
  if ("rollback" in client) {
    return { result: await work(client), own: false };
  }
  const result = await client.transaction((tx) => work(tx));
  return { result, own: true };
}
