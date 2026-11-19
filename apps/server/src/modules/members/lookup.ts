// The one read the command `emergency:link` needs: the account of an address, with no import of another
// module (TOKI-026 R23). `accounts.ts` reaches the `auth` module, and through it the mail layer.
import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/client.js";
import { users } from "./schema.js";

// The address is compared as stored: lower case (the caller normalises it with parseEmail). An address
// with no users row, as one that has only been invited, returns no account.
export async function findAccountForEmergencyLink(
  client: DbClient,
  email: string,
): Promise<{
  id: string;
  workspaceId: string;
  status: "active" | "deactivated";
} | null> {
  const [row] = await client
    .select({
      id: users.id,
      workspaceId: users.workspaceId,
      status: users.status,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return (
    (row as
      | { id: string; workspaceId: string; status: "active" | "deactivated" }
      | undefined) ?? null
  );
}
