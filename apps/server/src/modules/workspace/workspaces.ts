import { uuidv7 } from "uuidv7";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { workspaces } from "./schema.js";

// The caller's database client or open transaction (TOKI-020 R14).
type Db = PostgresJsDatabase;

// The ids of every workspace row, oldest first.
export async function listWorkspaceIds(tx: Db): Promise<string[]> {
  const rows = await tx
    .select({ id: workspaces.id })
    .from(workspaces)
    .orderBy(workspaces.createdAt, workspaces.id);
  return rows.map((r) => r.id);
}

// Inserts one workspace and returns its id; created_at keeps its default.
export async function createWorkspace(
  tx: Db,
  input: { name: string },
): Promise<string> {
  const id = uuidv7();
  await tx.insert(workspaces).values({ id, name: input.name });
  return id;
}
