import type { Tx } from "../db/client.js";
import { getLastEventNumber } from "../modules/realtime/index.js";

// The number of the last event of the log at the moment of the snapshot
// (TOKI-031 R11, changed by TOKI-036 R19): 0 means no event. It reads with the
// transaction of the snapshot, so the answer holds every event up to its number
// and none after it.
export function readEventNumber(tx: Tx, workspaceId: string): Promise<number> {
  return getLastEventNumber(tx, workspaceId);
}
