import { count, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { DbClient } from "../../db/client.js";
import { users } from "./schema.js";

export type Account = {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: "member" | "admin";
  status: "active" | "deactivated";
  language: "en" | "vi";
};

const columns = {
  id: users.id,
  workspaceId: users.workspaceId,
  email: users.email,
  displayName: users.displayName,
  role: users.role,
  status: users.status,
  language: users.language,
};

// The email address is compared as stored: lower case (the caller normalises
// it with parseEmail). An address with no users row returns no account.
export async function findAccountByEmail(
  client: DbClient,
  email: string,
): Promise<Account | null> {
  const [row] = await client
    .select(columns)
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return (row as Account | undefined) ?? null;
}

export async function getAccountById(
  client: DbClient,
  id: string,
): Promise<Account | null> {
  const [row] = await client
    .select(columns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return (row as Account | undefined) ?? null;
}

// The number of accounts in the database (TOKI-020 R14).
export async function countAccounts(client: DbClient): Promise<number> {
  const [row] = await client.select({ n: count() }).from(users);
  return row?.n ?? 0;
}

// Inserts the first Admin. Narrow on purpose: the role and the status are
// fixed here and are not arguments, so no caller can make an Admin through it
// around the rules of the last Admin and of invitations (TOKI-024). The
// language keeps the table default. Returns the new id.
export async function createFirstAdminAccount(
  client: DbClient,
  input: {
    workspaceId: string;
    email: string;
    displayName: string;
    createdAt: Date;
  },
): Promise<string> {
  const id = uuidv7();
  await client.insert(users).values({
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
