import { eq } from "drizzle-orm";
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
