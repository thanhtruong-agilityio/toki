import { sql as q } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Tx } from "../../src/db/client.js";
import { recordEvent } from "../../src/modules/realtime/index.js";
import { gate, hold, input, listen, setup, waitForLockOf } from "./helpers.js";

// The writer of the event log (TOKI-036 R15 to R18), with real connections.

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  t = await setup();
});
afterAll(async () => {
  await t?.close();
});

const record = (workspace: string) => (tx: Tx) =>
  recordEvent(tx, input(workspace));

describe("R15: recordEvent", () => {
  it("R15: numbers three events of one transaction and makes the counter", async () => {
    const { workspace } = await t.scene();
    const numbers = await t.db.transaction(async (tx) => {
      const made = [];
      for (let i = 0; i < 3; i += 1) {
        made.push((await recordEvent(tx, input(workspace))).number);
      }
      return made;
    });
    expect(numbers).toEqual([1, 2, 3]);
    expect(await t.visible(workspace)).toEqual({
      counter: 3,
      numbers: [1, 2, 3],
    });
  });

  it("R15: returns the event it stored, for each scope", async () => {
    const s = await t.scene();
    const at = new Date("2026-02-03T04:05:06.007Z");
    const targets = [
      { scope: "workspace" as const },
      { scope: "conversation" as const, conversationId: s.conversation },
      { scope: "user" as const, userId: s.user },
    ];
    for (const [i, target] of targets.entries()) {
      const given = input(s.workspace, { ...target, at, payload: { i } });
      const event = await t.db.transaction((tx) => recordEvent(tx, given));
      expect(event).toStrictEqual({
        workspaceId: s.workspace,
        number: i + 1,
        scope: target.scope,
        conversationId: "conversationId" in target ? s.conversation : null,
        userId: "userId" in target ? s.user : null,
        type: "message.created",
        payload: { i },
        createdAt: at,
      });
    }
    const rows = await t.sql`
      select number, scope, conversation_id, user_id, payload, created_at
      from events where workspace_id = ${s.workspace} order by number`;
    expect(rows.map((r) => r.payload)).toEqual([{ i: 0 }, { i: 1 }, { i: 2 }]);
    expect(rows[1]).toMatchObject({
      scope: "conversation",
      conversation_id: s.conversation,
      user_id: null,
      created_at: at,
    });
  });

  it("R15: sends three statements: the counter, the event, the signal", async () => {
    const { workspace } = await t.scene();
    const { db, log } = await t.counted();
    await db.transaction((tx) => recordEvent(tx, input(workspace)));
    const sent = log.map((s) => s.text.toLowerCase());
    expect(sent).toHaveLength(5);
    expect(sent[1]).toMatch(/^insert into "event_counters".*on conflict/);
    expect(sent[2]).toMatch(/^insert into "events"/);
    expect(sent[3]).toContain("pg_notify('toki_events'");
  });

  it("R15: a refused scope raises no counter", async () => {
    const { workspace } = await t.scene();
    await t.db.transaction(record(workspace));
    const { db, log } = await t.counted();
    await db.transaction(async (tx) => {
      await expect(
        recordEvent(tx, input(workspace, { scope: "conversation" })),
      ).rejects.toThrow(/An event of scope/);
    });
    // Nothing between the two statements of the transaction itself.
    expect(log.map((s) => s.text.trim().toLowerCase())).toEqual([
      "begin",
      "commit",
    ]);
    expect(await t.visible(workspace)).toEqual({ counter: 1, numbers: [1] });
  });

  it("R15: a rule of the table reaches the caller with its name", async () => {
    const { workspace } = await t.scene();
    await expect(
      t.db.transaction((tx) =>
        recordEvent(tx, input(workspace, { type: "Not A Type" })),
      ),
    ).rejects.toMatchObject({
      cause: { constraint_name: "events_type_check" },
    });
    expect(await t.visible(workspace)).toEqual({ counter: null, numbers: [] });
  });

  it("R15: the signal arrives after the commit and not after a rollback", async () => {
    const { workspace } = await t.scene();
    const listener = await listen(t.url, t.sql);
    try {
      const open = hold(t.connect(), record(workspace));
      await open.result;
      await listener.marker("while-open");
      expect(listener.received).toEqual(["while-open"]);
      await open.commit();
      await listener.marker("after-commit");
      expect(listener.received).toEqual([
        "while-open",
        workspace,
        "after-commit",
      ]);

      const undone = hold(t.connect(), record(workspace));
      await undone.result;
      await undone.rollback();
      await listener.marker("after-rollback");
      expect(listener.received.slice(3)).toEqual(["after-rollback"]);
    } finally {
      await listener.close();
    }
  });

  it.each([3_000_000_000, 9_007_199_254_740_990])(
    "R15: reads the number after %d as a JavaScript number",
    async (last) => {
      const { workspace } = await t.scene();
      await t.sql.begin(async (tx) => {
        await tx`alter table event_counters disable trigger event_counters_step_trg`;
        await tx`insert into event_counters (workspace_id, last_number) values (${workspace}, ${last})`;
        await tx`alter table event_counters enable trigger event_counters_step_trg`;
      });
      const event = await t.db.transaction(record(workspace));
      expect(event.number).toBe(last + 1);
    },
  );

  it("R15: a REPEATABLE READ writer behind another commit fails with 40001", async () => {
    const { workspace } = await t.scene();
    await t.db.transaction(record(workspace));
    const other = t.connect();
    await expect(
      t.db.transaction(
        async (tx) => {
          await tx.execute(
            q`select last_number from event_counters where workspace_id = ${workspace}`,
          );
          await other.transaction(record(workspace));
          await recordEvent(tx, input(workspace));
        },
        { isolationLevel: "repeatable read" },
      ),
    ).rejects.toMatchObject({ cause: { code: "40001" } });
    expect(await t.visible(workspace)).toEqual({ counter: 2, numbers: [1, 2] });
  });
});

describe("R16: numbers become visible in order, with no gap", () => {
  it("R16: B waits and no number is visible", async () => {
    const { workspace } = await t.scene();
    const a = hold(t.connect(), record(workspace));
    expect((await a.result).number).toBe(1);
    const b = hold(t.connect(), record(workspace));
    await waitForLockOf(t.sql, await b.pid);
    expect(await t.visible(workspace)).toEqual({ counter: null, numbers: [] });
    await a.commit();
    expect((await b.result).number).toBe(2);
    expect(await t.visible(workspace)).toEqual({ counter: 1, numbers: [1] });
    await b.commit();
    expect(await t.visible(workspace)).toEqual({ counter: 2, numbers: [1, 2] });
  });

  it("R16: a rollback gives its number back", async () => {
    const { workspace } = await t.scene();
    const a = hold(t.connect(), record(workspace));
    await a.result;
    const b = hold(t.connect(), record(workspace));
    await waitForLockOf(t.sql, await b.pid);
    await a.rollback();
    expect((await b.result).number).toBe(1);
    await b.commit();
    expect(await t.visible(workspace)).toEqual({ counter: 1, numbers: [1] });
  });

  it("R16: 24 transactions leave 1 to M, and a reader never sees a gap", async () => {
    const { workspace } = await t.scene();
    // mulberry32 with a fixed seed: the same rule on every run.
    let seed = 36;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    const plan = Array.from({ length: 24 }, () => ({
      events: 1 + Math.floor(random() * 3),
      commits: random() < 0.7,
    }));
    const committed = plan.filter((p) => p.commits);
    expect(committed.length).toBeGreaterThan(0);
    expect(committed.length).toBeLessThan(24);
    const total = committed.reduce((sum, p) => sum + p.events, 0);

    const connections = Array.from({ length: 8 }, () => t.connect());
    class Undo extends Error {}
    const writers = plan.map((p, i) =>
      connections[i % 8]!.transaction(async (tx) => {
        for (let n = 0; n < p.events; n += 1) {
          await recordEvent(tx, input(workspace));
        }
        if (!p.commits) throw new Undo();
      }).catch((error: unknown) => {
        if (!(error instanceof Undo)) throw error;
      }),
    );
    const reader = t.connect();
    const read = async () => {
      for (let i = 0; i < 200; i += 1) {
        await reader.transaction(
          async (tx) => {
            const [counter] = await tx.execute(
              q`select last_number from event_counters where workspace_id = ${workspace}`,
            );
            const rows = await tx.execute(
              q`select number from events where workspace_id = ${workspace} order by number`,
            );
            const last = counter ? Number(counter.last_number) : 0;
            expect(rows.map((r) => Number(r.number))).toEqual(
              Array.from({ length: last }, (_, n) => n + 1),
            );
          },
          { isolationLevel: "repeatable read" },
        );
      }
    };
    await Promise.all([read(), ...writers]);
    expect(await t.visible(workspace)).toEqual({
      counter: total,
      numbers: Array.from({ length: total }, (_, n) => n + 1),
    });
  }, 60_000);
});

const insertMessage = (
  tx: Tx,
  s: { workspace: string; conversation: string; user: string },
  body = "made up",
) =>
  tx.execute(q`
    insert into messages (id, workspace_id, conversation_id, author_id, kind, body, created_at)
    values (${crypto.randomUUID()}, ${s.workspace}, ${s.conversation}, ${s.user}, 'user', ${body}, now())`);

describe("R17: an event is written in the transaction of its change", () => {
  const rows = async (workspace: string) => {
    const [n] = await t.sql<{ n: number }[]>`
      select count(*)::int as n from messages where workspace_id = ${workspace}`;
    return { messages: n!.n, ...(await t.visible(workspace)) };
  };
  class Undo extends Error {}

  it("R17: a rollback leaves no message, no event and no counter", async () => {
    const s = await t.scene();
    const change = async (tx: Tx) => {
      await insertMessage(tx, s);
      await recordEvent(tx, input(s.workspace));
    };
    const undone = () =>
      t.db
        .transaction(async (tx) => {
          await change(tx);
          throw new Undo();
        })
        .catch((error: unknown) => {
          if (!(error instanceof Undo)) throw error;
        });
    await undone();
    expect(await rows(s.workspace)).toEqual({
      messages: 0,
      counter: null,
      numbers: [],
    });
    await t.db.transaction(change);
    expect(await rows(s.workspace)).toEqual({
      messages: 1,
      counter: 1,
      numbers: [1],
    });
    // The counter keeps the value it had.
    await undone();
    expect(await rows(s.workspace)).toEqual({
      messages: 1,
      counter: 1,
      numbers: [1],
    });
  });

  it("R17: a refused change after the event removes the event too", async () => {
    const s = await t.scene();
    await expect(
      t.db.transaction(async (tx) => {
        await recordEvent(tx, input(s.workspace));
        await insertMessage(tx, s, "a".repeat(10_001));
      }),
    ).rejects.toMatchObject({
      cause: { constraint_name: "messages_body_check" },
    });
    expect(await rows(s.workspace)).toEqual({
      messages: 0,
      counter: null,
      numbers: [],
    });
  });
});

const lockConversation = (tx: Tx, id: string, level: "update" | "no key") =>
  tx.execute(
    level === "update"
      ? q`select id from conversations where id = ${id} for update`
      : q`select id from conversations where id = ${id} for no key update`,
  );

describe("R18: the numbers of a transaction and the order of locks", () => {
  it("R18: numbers stay together", async () => {
    const { workspace } = await t.scene();
    const first = gate<number>();
    const goOn = gate();
    const a = t.connect().transaction(async (tx) => {
      const one = (await recordEvent(tx, input(workspace))).number;
      first.open(one);
      await goOn.promise;
      const two = (await recordEvent(tx, input(workspace))).number;
      return [one, two];
    });
    await first.promise;
    const b = hold(t.connect(), record(workspace));
    await waitForLockOf(t.sql, await b.pid);
    goOn.open();
    expect(await a).toEqual([1, 2]);
    expect((await b.result).number).toBe(3);
    await b.commit();
  });

  it("R18: two writers of one conversation finish", async () => {
    const s = await t.scene();
    const write = () =>
      t.connect().transaction(async (tx) => {
        await lockConversation(tx, s.conversation, "no key");
        const event = await recordEvent(
          tx,
          input(s.workspace, {
            scope: "conversation",
            conversationId: s.conversation,
          }),
        );
        return event.number;
      });
    const numbers = await Promise.all([write(), write()]);
    expect(numbers.sort()).toEqual([1, 2]);
  });

  // This passes only while the deadlock happens: it is the reason for the rule.
  it("R18: documents the rule no FOR UPDATE on these rows", async () => {
    const s = await t.scene();
    const event = input(s.workspace, {
      scope: "conversation",
      conversationId: s.conversation,
    });
    const goOn = gate();
    // B holds the conversation FOR UPDATE and has written no event.
    const b = hold(t.connect(), async (tx) => {
      await lockConversation(tx, s.conversation, "update");
      await goOn.promise;
      await recordEvent(tx, event);
    });
    await b.pid;
    await waitForRowLock(s.conversation);
    // A takes the counter, then its event waits for B on the foreign key.
    const a = hold(t.connect(), (tx) => recordEvent(tx, event));
    await waitForLockOf(t.sql, await a.pid);
    goOn.open();
    // B waits for the counter: a cycle, and the database ends one of the two.
    const outcomes = await Promise.allSettled([
      a.result.then(() => a.commit()),
      b.result.then(() => b.commit()),
    ]);
    const refused = outcomes.filter((o) => o.status === "rejected");
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ reason: { cause: { code: "40P01" } } });
  }, 20_000);
});

// Resolves when some transaction holds that conversation row: a NOWAIT lock
// from outside is refused.
async function waitForRowLock(conversation: string) {
  const deadline = Date.now() + 5000;
  for (;;) {
    const refused = await t.sql`
      select id from conversations where id = ${conversation} for key share nowait`.then(
      () => false,
      (error: { code?: string }) => error.code === "55P03",
    );
    if (refused) return;
    if (Date.now() > deadline) throw new Error("the row was never locked");
    await new Promise((r) => setTimeout(r, 10));
  }
}
