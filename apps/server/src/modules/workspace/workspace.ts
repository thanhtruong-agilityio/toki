import type { DbClient } from "../../db/client.js";
import { workspaces } from "./schema.js";

// The one workspace of the installation (D-004): its id and its name.
export async function getWorkspace(
  client: DbClient,
): Promise<{ id: string; name: string } | null> {
  const [row] = await client
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .limit(1);
  return row ?? null;
}
