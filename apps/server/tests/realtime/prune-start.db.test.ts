import { createTestClock, type TestClock } from "@toki/shared";
import { sql as q } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../src/db/client.js";
import {
  recordEvent,
  startEventPruning,
} from "../../src/modules/realtime/index.js";
import { hold, input, setup, waitForLockOf } from "./helpers.js";

// The run of the pruning (TOKI-036 R21), with a schedule the test fires itself
// and a controllable clock. No test waits for a real timer.

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  t = await setup();
});
afterAll(async () => {
  await t?.close();
});
beforeEach(async () => {
  await t.sql`truncate events, event_counters`;
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function fakeSchedule() {
  const calls: { run: () => void; intervalMs: number }[] = [];
  let cancelled = 0;
  return {
    calls,
    cancelled: () => cancelled,
    schedule(run: () => void, intervalMs: number) {
      calls.push({ run, intervalMs });
      return () => {
        cancelled += 1;
      };
    },
    fire: () => calls[0]!.run(),
  };
}

type Line = { level: "info" | "error"; fields: unknown; message: string };

// A log that records its lines. `next` resolves with the next one, one turn of
// the event loop later, when the run that wrote it has also ended.
function fakeLog() {
  const lines: Line[] = [];
  let waiting: ((line: Line) => void)[] = [];
  const write =
    (level: Line["level"]) => (fields: unknown, message: string) => {
      const line = { level, fields, message };
      lines.push(line);
      for (const resolve of waiting) resolve(line);
      waiting = [];
    };
  return {
    lines,
    next: () =>
      new Promise<Line>((resolve) =>
        waiting.push((line) => setImmediate(resolve, line)),
      ),
    log: { info: write("info"), error: write("error") } as never,
  };
}

async function eventNow(clock: TestClock) {
  const { workspace } = await t.scene();
  await t.db.transaction((tx) =>
    recordEvent(tx, input(workspace, { at: new Date(clock.now()) })),
  );
  return workspace;
}

const numbers = async (workspace: string) =>
  (await t.visible(workspace)).numbers;

async function started(db: Db = t.db, clock = createTestClock()) {
  const timer = fakeSchedule();
  const log = fakeLog();
  const first = log.next();
  const stop = startEventPruning({
    db,
    clock,
    schedule: timer.schedule,
    log: log.log,
  });
  return { clock, timer, log, first, stop };
}

describe("R21: startEventPruning", () => {
  it("R21: asks for one run an hour and runs at once", async () => {
    const run = await started();
    expect(await run.first).toEqual({
      level: "info",
      fields: { count: 0 },
      message: "events_pruned",
    });
    expect(run.timer.calls.map((c) => c.intervalMs)).toEqual([HOUR]);
    await run.stop();
  });

  it.each([
    ["8 days", 8 * DAY, []],
    ["6 days and 23 hours", 6 * DAY + 23 * HOUR, [1]],
  ])("R21: a run %s after an event", async (_name, later, left) => {
    const clock = createTestClock();
    const workspace = await eventNow(clock);
    const run = await started(t.db, clock);
    await run.first;
    clock.advance(later);
    const second = run.log.next();
    run.timer.fire();
    await second;
    expect(await numbers(workspace)).toEqual(left);
    await run.stop();
  });

  it("R21: logs a run that fails, and the next one still prunes", async () => {
    const clock = createTestClock();
    const workspace = await eventNow(clock);
    clock.advance(8 * DAY);
    let failures = 1;
    const flaky = new Proxy(t.db, {
      get(target, name, receiver) {
        if (name === "select" && failures > 0) {
          failures -= 1;
          return () => {
            throw new Error("the database is away");
          };
        }
        return Reflect.get(target, name, receiver);
      },
    });
    const run = await started(flaky, clock);
    expect(await run.first).toEqual({
      level: "error",
      fields: {
        err: new Error("the database is away"),
        count: 0,
      },
      message: "event_pruning_failed",
    });
    expect(await numbers(workspace)).toEqual([1]);
    const second = run.log.next();
    run.timer.fire();
    expect(await second).toMatchObject({ fields: { count: 1 } });
    expect(await numbers(workspace)).toEqual([]);
    await run.stop();
  });

  it("R21: stop cancels the schedule and waits for the run in progress", async () => {
    const clock = createTestClock();
    const workspace = await eventNow(clock);
    clock.advance(8 * DAY);
    const locker = hold(t.connect(), (tx) =>
      tx.execute(
        q`select number from events where workspace_id = ${workspace} for update`,
      ),
    );
    await locker.result;
    const db = t.connect();
    const [backend] = await db.execute(q`select pg_backend_pid() as pid`);
    const run = await started(db, clock);
    await waitForLockOf(t.sql, Number(backend!.pid));
    // A tick while a run is in progress starts no second one.
    run.timer.fire();
    let stopped = false;
    const stopping = run.stop().then(() => {
      stopped = true;
    });
    expect(run.timer.cancelled()).toBe(1);
    await t.sql`select 1`;
    expect(stopped).toBe(false);
    expect(run.log.lines).toEqual([]);
    await locker.rollback();
    await stopping;
    expect(run.log.lines.map((l) => l.message)).toEqual([
      "events_pruned",
      "event_pruning_stopped",
    ]);
    expect(await numbers(workspace)).toEqual([]);
  });
});
