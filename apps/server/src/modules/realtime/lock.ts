import { eq } from "drizzle-orm";
import type { Tx } from "../../db/client.js";
import { eventCounters } from "./schema.js";

// Takes the lock of the counter row of the workspace and keeps it to the end of
// the transaction, without raising the number (TOKI-036 R27). The writer of a
// user message calls it after its other locks and before it reads the clock, so
// the times of user messages follow the order in which they commit. It writes
// no event and sends no signal.
export async function lockEventCounter(
  tx: Tx,
  workspaceId: string,
): Promise<void> {
  // A workspace with no event gets a row to lock, with 0.
  await tx
    .insert(eventCounters)
    .values({ workspaceId, lastNumber: 0 })
    .onConflictDoNothing({ target: eventCounters.workspaceId });
  await tx
    .select({ lastNumber: eventCounters.lastNumber })
    .from(eventCounters)
    .where(eq(eventCounters.workspaceId, workspaceId))
    .for("no key update");
}
