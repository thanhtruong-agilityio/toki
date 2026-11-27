import { sql } from "drizzle-orm";
import type { Tx } from "../../db/client.js";
import { appendEvent, type EventInput, type StoredEvent } from "./append.js";

// The one writer of the event log (TOKI-036 R15 to R18). It runs on the
// transaction of the change and opens none. A caller takes every other lock
// first and writes its events last: the counter row stays locked until the
// commit (R18). The transaction runs at READ COMMITTED.
export async function recordEvent(
  tx: Tx,
  input: EventInput,
): Promise<StoredEvent> {
  const event = await appendEvent(tx, input);
  // Postgres delivers the signal at the commit and drops it at a rollback.
  await tx.execute(sql`select pg_notify('toki_events', ${input.workspaceId})`);
  return event;
}
