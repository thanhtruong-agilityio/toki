import { and, asc, eq, lt, lte, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { events } from "./schema.js";

// The removal of old events (TOKI-036 R20). It never touches the counter, so
// the numbers go on.

const BATCH_SIZE = 5_000;

// Removes, for every workspace, the events older than `before` and every event
// with a smaller number, so the kept events stay a whole run up to the last
// number. Each batch is its own statement: a run that is cut off leaves such a
// run too. Safe to run twice, or from two copies of the server at once.
export async function pruneEvents(
  db: Db,
  { before, batchSize = BATCH_SIZE }: { before: Date; batchSize?: number },
): Promise<number> {
  const cuts = await db
    .select({
      workspaceId: events.workspaceId,
      last: sql<string>`max(${events.number})`,
    })
    .from(events)
    .where(lt(events.createdAt, before))
    .groupBy(events.workspaceId);
  let removed = 0;
  for (const { workspaceId, last } of cuts) {
    // Numbers repeat across workspaces, so both levels filter by workspace.
    const ofWorkspace = eq(events.workspaceId, workspaceId);
    let count: number;
    do {
      // The oldest first, so two runs lock rows in one order and one waits for
      // the other. A row that the other removed does not count to the limit.
      const batch = db
        .select({ number: events.number })
        .from(events)
        .where(and(ofWorkspace, lte(events.number, Number(last))))
        .orderBy(asc(events.number))
        .limit(batchSize)
        .for("update");
      // array(...) runs the sub-select once. With `in (...)` the planner may
      // run it again for each row and remove more than one batch.
      const result = await db
        .delete(events)
        .where(and(ofWorkspace, sql`${events.number} = any(array${batch})`));
      count = result.count;
      removed += count;
    } while (count === batchSize);
  }
  return removed;
}
