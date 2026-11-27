import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getLastEventNumber,
  getOldestEventNumber,
  pruneEvents,
  readEventsAfter,
  recordEvent,
  type StoredEvent,
} from "../../src/modules/realtime/index.js";
import { input, setup } from "./helpers.js";

// The reads of the log and the removal of old events (TOKI-036 R19, R20, R26).

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  t = await setup();
});
afterAll(async () => {
  await t?.close();
});
// A prune covers every workspace, so each test starts with an empty log.
beforeEach(async () => {
  await t.sql`truncate events, event_counters`;
});

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

// One event for each time, in this order, so numbers follow the list.
async function record(workspace: string, times: Date[]) {
  const made: StoredEvent[] = [];
  for (const at of times) {
    made.push(
      await t.db.transaction((tx) => recordEvent(tx, input(workspace, { at }))),
    );
  }
  return made;
}

// `count` old events of one workspace, in one transaction.
async function old(workspace: string, count: number) {
  await t.db.transaction(async (tx) => {
    for (let i = 0; i < count; i += 1) {
      await recordEvent(tx, input(workspace, { at: day(1) }));
    }
  });
}

const numbers = async (workspace: string) =>
  (await t.visible(workspace)).numbers;

const deletes = (log: { text: string }[]) =>
  log.filter((s) => s.text.trim().toLowerCase().startsWith("delete from"));

describe("R19: getLastEventNumber", () => {
  it("R19: is 0 with no event and the last number otherwise", async () => {
    const { workspace } = await t.scene();
    expect(await getLastEventNumber(t.db, workspace)).toBe(0);
    await record(workspace, [day(1), day(2), day(3)]);
    expect(await getLastEventNumber(t.db, workspace)).toBe(3);
    await t.db.transaction(async (tx) => {
      expect(await getLastEventNumber(tx, workspace)).toBe(3);
    });
  });

  it("R19: reads the counter, so it stays when the log is emptied", async () => {
    const { workspace } = await t.scene();
    await record(workspace, [day(1), day(2)]);
    await pruneEvents(t.db, { before: day(9) });
    expect(await getLastEventNumber(t.db, workspace)).toBe(2);
  });

  it("R19: sends one statement, on the counter", async () => {
    const { workspace } = await t.scene();
    const { db, log } = await t.counted();
    await getLastEventNumber(db, workspace);
    expect(log).toHaveLength(1);
    expect(log[0]!.text).toContain('from "event_counters"');
  });
});

describe("R20: the oldest number and the pruning", () => {
  it("R20: removes the events older than the time and keeps the rest", async () => {
    const { workspace } = await t.scene();
    expect(await getOldestEventNumber(t.db, workspace)).toBeNull();
    await record(workspace, [1, 2, 3, 4, 5, 6].map(day));
    expect(await getOldestEventNumber(t.db, workspace)).toBe(1);
    expect(await pruneEvents(t.db, { before: day(4) })).toBe(3);
    expect(await numbers(workspace)).toEqual([4, 5, 6]);
    expect(await getOldestEventNumber(t.db, workspace)).toBe(4);
    expect(await getLastEventNumber(t.db, workspace)).toBe(6);
    expect(await pruneEvents(t.db, { before: day(4) })).toBe(0);
    const [next] = await record(workspace, [day(7)]);
    expect(next!.number).toBe(7);
  });

  it("R20: a prune of every event leaves the counter", async () => {
    const { workspace } = await t.scene();
    await record(workspace, [1, 2, 3, 4, 5, 6].map(day));
    expect(await pruneEvents(t.db, { before: day(30) })).toBe(6);
    expect(await getOldestEventNumber(t.db, workspace)).toBeNull();
    expect(await t.visible(workspace)).toEqual({ counter: 6, numbers: [] });
  });

  it("R20: removes a lower number with a later time, so no hole is left", async () => {
    const { workspace } = await t.scene();
    // Number 2 read its clock before the lock and carries a later time.
    await record(workspace, [day(1), day(5), day(2), day(6)]);
    expect(await pruneEvents(t.db, { before: day(3) })).toBe(3);
    expect(await numbers(workspace)).toEqual([4]);
  });

  it("R20: cuts each workspace by its own number", async () => {
    const a = (await t.scene()).workspace;
    const b = (await t.scene()).workspace;
    const c = (await t.scene()).workspace;
    await record(a, [day(1), day(1), day(1), day(9)]);
    await record(b, [day(1), day(9), day(9), day(9)]);
    await record(c, [day(9), day(9)]);
    expect(await pruneEvents(t.db, { before: day(5) })).toBe(4);
    expect(await numbers(a)).toEqual([4]);
    expect(await numbers(b)).toEqual([2, 3, 4]);
    expect(await numbers(c)).toEqual([1, 2]);
  });

  it.each([
    [2, 4],
    [7, 2],
  ])(
    "R20: removes 7 events in batches of %d with %d deletes",
    async (batchSize, statements) => {
      const { workspace } = await t.scene();
      await old(workspace, 7);
      const { db, log } = await t.counted();
      expect(await pruneEvents(db, { before: day(2), batchSize })).toBe(7);
      expect(deletes(log)).toHaveLength(statements);
      expect(deletes(log)[0]!.text.toLowerCase()).toContain(
        "= any(array(select",
      );
      // Each delete is its own statement, outside a transaction.
      expect(log.filter((s) => /^(begin|commit)/i.test(s.text.trim()))).toEqual(
        [],
      );
      expect(await numbers(workspace)).toEqual([]);
    },
  );

  it("R20: two prunes at once leave what one leaves", async () => {
    const { workspace } = await t.scene();
    await old(workspace, 200);
    await record(workspace, [day(9), day(9)]);
    const [one, two] = await Promise.all(
      [t.connect(), t.connect()].map((db) =>
        pruneEvents(db, { before: day(2), batchSize: 7 }),
      ),
    );
    expect(one! + two!).toBe(200);
    expect(await t.visible(workspace)).toEqual({
      counter: 202,
      numbers: [201, 202],
    });
  });
});

describe("R26: readEventsAfter", () => {
  async function ten() {
    const { workspace } = await t.scene();
    const made = await record(
      workspace,
      Array.from({ length: 10 }, (_, i) => day(i + 1)),
    );
    return { workspace, made };
  }
  const read = async (workspace: string, after: number, limit: number) =>
    (await readEventsAfter(t.db, workspace, after, limit)).map((e) => e.number);

  it("R26: returns the events after a number, in order, at most the limit", async () => {
    const { workspace, made } = await ten();
    expect(await read(workspace, 0, 4)).toEqual([1, 2, 3, 4]);
    expect(await read(workspace, 4, 100)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(await read(workspace, 10, 100)).toEqual([]);
    // The fields of recordEvent, numbers as JavaScript numbers.
    expect(await readEventsAfter(t.db, workspace, 0, 1000)).toStrictEqual(made);
  });

  it("R26: after a prune it starts at the oldest kept number", async () => {
    const { workspace } = await ten();
    await pruneEvents(t.db, { before: day(6) });
    expect(await read(workspace, 2, 100)).toEqual([6, 7, 8, 9, 10]);
    expect(await getOldestEventNumber(t.db, workspace)).toBe(6);
  });

  it("R26: returns no event of another workspace", async () => {
    const mine = await ten();
    const theirs = await ten();
    const events = await readEventsAfter(t.db, mine.workspace, 0, 1000);
    expect(events).toHaveLength(10);
    expect(events.map((e) => e.workspaceId)).not.toContain(theirs.workspace);
  });

  it.each([
    [0, 0],
    [0, 1001],
    [0, 1.5],
    [-1, 10],
    [1.5, 10],
    [Number.NaN, 10],
  ])(
    "R26: refuses after %d with limit %d before a statement",
    async (after, limit) => {
      const { workspace } = await t.scene();
      const { db, log } = await t.counted();
      await expect(
        readEventsAfter(db, workspace, after, limit),
      ).rejects.toThrow(/'(after|limit)'/);
      expect(log).toEqual([]);
    },
  );

  it("R26: one statement on the primary key range, with no Sort", async () => {
    const { workspace } = await ten();
    const { db, log } = await t.counted();
    await readEventsAfter(db, workspace, 2, 5);
    expect(log).toHaveLength(1);
    const rows = await t.sql.begin(async (tx) => {
      await tx`set local enable_seqscan = off`;
      await tx`set local enable_bitmapscan = off`;
      return tx.unsafe(
        `explain (format json) ${log[0]!.text}`,
        log[0]!.params as never[],
      );
    });
    const plan = JSON.stringify(rows);
    expect(plan).toContain('"Index Name":"events_pkey"');
    expect(plan).not.toMatch(/Sort/);
  });
});
