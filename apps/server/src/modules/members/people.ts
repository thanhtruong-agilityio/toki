import { sql } from "drizzle-orm";
import type { DbClient } from "../../db/client.js";
import { users } from "./schema.js";

export type Person = {
  id: string;
  displayName: string;
  role: "member" | "admin";
  status: "active" | "deactivated";
};

// Every account of the workspace, active and deactivated, as the four fields
// the first screen needs (TOKI-031 R5, R15). No address and no session data
// is selected. Ordered by the lower-cased name and then the id, both compared
// byte by byte (collation "C"), so the order does not depend on the locale
// of the database. The caller passes the open transaction or the database.
export async function listPeople(
  client: DbClient,
  workspaceId: string,
): Promise<Person[]> {
  const rows = await client
    .select({
      id: users.id,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(sql`${users.workspaceId} = ${workspaceId}`)
    .orderBy(
      sql`lower(${users.displayName}) collate "C"`,
      sql`${users.id}::text collate "C"`,
    );
  return rows as Person[];
}
