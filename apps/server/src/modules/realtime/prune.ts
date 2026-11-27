import {
  type Clock,
  EVENT_PRUNE_INTERVAL_MS,
  EVENT_RETENTION_DAYS,
} from "@toki/shared";
import { and, asc, eq, lt, lte, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { Db } from "../../db/client.js";
import { events } from "./schema.js";

// The removal of old events (TOKI-036 R20) and its run (R21). It never touches
// the counter, so the numbers go on.

const BATCH_SIZE = 5_000;
const DAY_MS = 86_400_000;

// Removes, for every workspace, the events older than `before` and every event
// with a smaller number, so the kept events stay a whole run up to the last
// number. Each batch is its own statement: a run that is cut off leaves such a
// run too. Safe to run twice, or from two copies of the server at once.
export async function pruneEvents(
  db: Db,
  { before, batchSize = BATCH_SIZE }: { before: Date; batchSize?: number },
): Promise<number> {
  // A batch of 0 removes nothing and would never be the last one.
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("'batchSize' is not a whole number of 1 or more.");
  }
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

// Calls `run` every `intervalMs` and returns what cancels it.
export type Schedule = (run: () => void, intervalMs: number) => () => void;

// Prunes at once and then on the schedule. A run that fails is logged and the
// later ones go on. A tick during a run starts no second one. The function that
// is returned cancels the schedule and resolves when the run in progress ended.
export function startEventPruning({
  db,
  clock,
  schedule,
  log,
}: {
  db: Db;
  clock: Clock;
  schedule: Schedule;
  log: Pick<FastifyBaseLogger, "info" | "error">;
}): () => Promise<void> {
  let running: Promise<void> | null = null;
  const prune = async () => {
    try {
      const before = new Date(clock.now() - EVENT_RETENTION_DAYS * DAY_MS);
      const count = await pruneEvents(db, { before });
      log.info({ count }, "events_pruned");
    } catch (error) {
      // The queries of the pruning carry no payload.
      log.error({ err: error, count: 0 }, "event_pruning_failed");
    }
  };
  const run = () => {
    running ??= prune().finally(() => {
      running = null;
    });
  };
  const cancel = schedule(run, EVENT_PRUNE_INTERVAL_MS);
  run();
  return async () => {
    cancel();
    await running;
    log.info({}, "event_pruning_stopped");
  };
}
