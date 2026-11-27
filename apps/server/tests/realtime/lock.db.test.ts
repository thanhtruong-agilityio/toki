import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Tx } from "../../src/db/client.js";
import {
  getLastEventNumber,
  lockEventCounter,
  recordEvent,
} from "../../src/modules/realtime/index.js";
import { hold, input, listen, setup, waitForLockOf } from "./helpers.js";

// The lock of the writer of a user message (TOKI-036 R27), with real
// connections.

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  t = await setup();
});
afterAll(async () => {
  await t?.close();
});

const lock = (workspace: string) => (tx: Tx) => lockEventCounter(tx, workspace);
const record = (workspace: string) => (tx: Tx) =>
  recordEvent(tx, input(workspace));

// A workspace that has one event, so its counter is 1.
async function used() {
  const { workspace } = await t.scene();
  await t.db.transaction(record(workspace));
  return workspace;
}

describe("R27: lockEventCounter", () => {
  it.each(["commit", "rollback"] as const)(
    "R27: B waits until A ends with a %s",
    async (end) => {
      const workspace = await used();
      const a = hold(t.connect(), lock(workspace));
      await a.result;
      const b = hold(t.connect(), lock(workspace));
      await waitForLockOf(t.sql, await b.pid);
      await a[end]();
      await b.result;
      await b.commit();
      expect(await t.visible(workspace)).toEqual({ counter: 1, numbers: [1] });
    },
  );

  it("R27: a workspace with no event gets one row with 0", async () => {
    const { workspace } = await t.scene();
    const a = hold(t.connect(), lock(workspace));
    await a.result;
    const b = hold(t.connect(), lock(workspace));
    await waitForLockOf(t.sql, await b.pid);
    await a.commit();
    await b.result;
    await b.commit();
    expect(await t.visible(workspace)).toEqual({ counter: 0, numbers: [] });
  });

  it("R27: raises no number, and the next event of the transaction takes the next one", async () => {
    const fresh = (await t.scene()).workspace;
    for (const [workspace, before] of [
      [fresh, 0],
      [await used(), 1],
    ] as const) {
      await t.db.transaction(async (tx) => {
        await lockEventCounter(tx, workspace);
        expect(await getLastEventNumber(tx, workspace)).toBe(before);
        const event = await recordEvent(tx, input(workspace));
        expect(event.number).toBe(before + 1);
      });
    }
  });

  it("R27: a writer of events waits for the holder that wrote none", async () => {
    const workspace = await used();
    const a = hold(t.connect(), lock(workspace));
    await a.result;
    const b = hold(t.connect(), record(workspace));
    await waitForLockOf(t.sql, await b.pid);
    await a.commit();
    expect((await b.result).number).toBe(2);
    await b.commit();
  });

  it("R27: a rollback in a workspace with no event leaves no row", async () => {
    const { workspace } = await t.scene();
    const a = hold(t.connect(), lock(workspace));
    await a.result;
    await a.rollback();
    expect(await t.visible(workspace)).toEqual({ counter: null, numbers: [] });
  });

  it("R27: sends no notification and writes no event", async () => {
    const { workspace } = await t.scene();
    const listener = await listen(t.url, t.sql);
    try {
      await t.db.transaction(lock(workspace));
      await listener.marker("after-lock");
      expect(listener.received).toEqual(["after-lock"]);
      expect(await t.visible(workspace)).toEqual({ counter: 0, numbers: [] });
    } finally {
      await listener.close();
    }
  });

  it("R27: sends the two statements", async () => {
    const { workspace } = await t.scene();
    const { db, log } = await t.counted();
    await db.transaction(lock(workspace));
    const sent = log.map((s) => s.text.trim().toLowerCase());
    expect(sent).toHaveLength(4);
    expect(sent[1]).toMatch(/^insert into "event_counters".*do nothing/);
    expect(sent[2]).toMatch(
      /^select .* from "event_counters".* for no key update$/,
    );
  });
});
