import { count } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { uuidv7 } from "uuidv7";
import { users } from "./schema.js";

// The caller's database client or open transaction (TOKI-020 R14).
type Db = PostgresJsDatabase;

// The number of accounts in the database.
export async function countAccounts(tx: Db): Promise<number> {
  const [row] = await tx.select({ n: count() }).from(users);
  return row?.n ?? 0;
}

// Inserts the first Admin. Narrow on purpose: the role and the status are
// fixed here and are not arguments, so no caller can make an Admin through it
// around the rules of the last Admin and of invitations (TOKI-024). The
// language keeps the table default. Returns the new id.
export async function createFirstAdminAccount(
  tx: Db,
  input: {
    workspaceId: string;
    email: string;
    displayName: string;
    createdAt: Date;
  },
): Promise<string> {
  const id = uuidv7();
  await tx.insert(users).values({
    id,
    workspaceId: input.workspaceId,
    email: input.email,
    displayName: input.displayName,
    role: "admin",
    status: "active",
    createdAt: input.createdAt,
  });
  return id;
}
