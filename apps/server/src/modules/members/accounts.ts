import { count, eq, inArray } from "drizzle-orm";
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

// What the channel code needs to know about a person: who, which workspace,
// which role (as stored text, so a role the permission functions do not know
// reaches them) and whether the account is in use. No address, no name.
export type AccountFacts = {
  id: string;
  workspaceId: string;
  role: string;
  status: "active" | "deactivated";
};

// One statement for every id that has a row, in id order. With
// `lock: "share"` the rows are read `FOR SHARE`, so a demotion or a
// deactivation that holds a row finishes first and the caller reads its
// result, and a person cannot be deactivated between the check and the
// insert that follows (TOKI-029 R15, TOKI-024 R39). Without the option no
// lock is taken, which is how a read-only transaction calls it.
export async function getAccountsByIds(
  client: DbClient,
  ids: readonly string[],
  options: { lock?: "share" } = {},
): Promise<AccountFacts[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const query = client
    .select({
      id: users.id,
      workspaceId: users.workspaceId,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(inArray(users.id, unique))
    .orderBy(users.id);
  const rows = await (options.lock === "share" ? query.for("share") : query);
  return rows as AccountFacts[];
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
