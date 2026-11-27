import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { DbClient } from "../../db/client.js";
import type { StoredEvent } from "./append.js";
import { eventCounters, events } from "./schema.js";

// The reads of the event log (TOKI-036 R19, R20, R26). None applies an
// audience: a caller that serves a person filters by the scope of each event.

const MAX_LIMIT = 1000;

// The counter, not the largest number of `events`: pruning can empty the log
// while the numbers go on. 0 means "no event".
export async function getLastEventNumber(
  client: DbClient,
  workspaceId: string,
): Promise<number> {
  const [row] = await client
    .select({ lastNumber: eventCounters.lastNumber })
    .from(eventCounters)
    .where(eq(eventCounters.workspaceId, workspaceId));
  return row?.lastNumber ?? 0;
}

export async function getOldestEventNumber(
  client: DbClient,
  workspaceId: string,
): Promise<number | null> {
  const [row] = await client
    .select({ oldest: sql<string | null>`min(${events.number})` })
    .from(events)
    .where(eq(events.workspaceId, workspaceId));
  return row?.oldest == null ? null : Number(row.oldest);
}

// The one read of the log after a number: the events with a greater number, in
// order, which are consecutive (R16).
export async function readEventsAfter(
  client: DbClient,
  workspaceId: string,
  after: number,
  limit: number,
): Promise<StoredEvent[]> {
  if (!Number.isInteger(after) || after < 0) {
    throw new Error("'after' is not a whole number of 0 or more.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`'limit' is not a whole number from 1 to ${MAX_LIMIT}.`);
  }
  return client
    .select()
    .from(events)
    .where(and(eq(events.workspaceId, workspaceId), gt(events.number, after)))
    .orderBy(asc(events.number))
    .limit(limit);
}
