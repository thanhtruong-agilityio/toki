import { sql as q } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import type { Db, Tx } from "../../src/db/client.js";
import type { EventInput } from "../../src/modules/realtime/index.js";
import { createMigratedDb } from "../migrated-db.js";
import {
  insertConversation,
  insertUser,
  insertWorkspace,
} from "../test-rows.js";

// Test-only (TOKI-036): rows, held transactions, the wait for a lock and a
// client that records its statements. Nothing here sleeps for a result.

export type Statement = { text: string; params: unknown[] };

export async function setup() {
  const t = await createMigratedDb();
  const clients: Sql[] = [];

  // A workspace with a user and a channel, and no counter.
  async function scene() {
    const workspace = await insertWorkspace(t.sql);
    const user = await insertUser(t.sql, { workspace_id: workspace });
    const conversation = await insertConversation(t.sql, {
      workspace_id: workspace,
      created_by: user,
    });
    return { workspace, user, conversation };
  }

  // A client of one connection that records every statement it sends.
  async function counted() {
    const log: Statement[] = [];
    const client = postgres(t.url, {
      max: 1,
      onnotice: () => {},
      debug: (_connection, text, params) => log.push({ text, params }),
    });
    clients.push(client);
    const db = drizzle(client);
    // The first query of a connection also reads the types.
    await db.execute(q`select 1`);
    log.length = 0;
    return { db: db as Db, log };
  }

  const connect = () => t.connect().db as Db;

  // The counter and the numbers a reader sees now.
  async function visible(workspace: string) {
    const [counter] = await t.sql<{ last_number: string }[]>`
      select last_number from event_counters where workspace_id = ${workspace}`;
    const rows = await t.sql<{ number: string }[]>`
      select number from events where workspace_id = ${workspace} order by number`;
    return {
      counter: counter ? Number(counter.last_number) : null,
      numbers: rows.map((r) => Number(r.number)),
    };
  }

  return {
    ...t,
    db: t.db as Db,
    scene,
    counted,
    connect,
    visible,
    async close() {
      await Promise.all(clients.map((c) => c.end()));
      await t.close();
    },
  };
}

export const input = (
  workspaceId: string,
  over: Partial<EventInput> = {},
): EventInput => ({
  workspaceId,
  scope: "workspace",
  type: "message.created",
  payload: { text: "made up" },
  at: new Date("2026-01-01T00:00:00.000Z"),
  ...over,
});

export function gate<T = void>() {
  let open!: (value: T) => void;
  const promise = new Promise<T>((resolve) => (open = resolve));
  return { promise, open };
}

class Rollback extends Error {}

// A transaction that runs `body` and then stays open until commit or rollback.
// `pid` is its backend, known before the body starts, so a test can watch it
// wait. `result` is what the body returned.
export function hold<T>(db: Db, body: (tx: Tx) => Promise<T>) {
  const pid = gate<number>();
  const decision = gate<boolean>();
  let returned!: (value: T) => void;
  let threw!: (error: unknown) => void;
  const result = new Promise<T>((resolve, reject) => {
    returned = resolve;
    threw = reject;
  });
  const done = db
    .transaction(async (tx) => {
      const [row] = await tx.execute(q`select pg_backend_pid() as pid`);
      pid.open(Number(row!.pid));
      returned(await body(tx));
      if (!(await decision.promise)) throw new Rollback();
    })
    .catch((error: unknown) => {
      if (error instanceof Rollback) return;
      threw(error);
      throw error;
    });
  // A failure reaches the test through `result`, `commit` or `rollback`.
  done.catch(() => {});
  result.catch(() => {});
  return {
    pid: pid.promise,
    result,
    async commit() {
      decision.open(true);
      await done;
    },
    async rollback() {
      decision.open(false);
      await done;
    },
  };
}

async function until(
  check: () => boolean | Promise<boolean>,
  what: string,
  timeoutMs = 5000,
) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`never happened: ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

// Resolves when that backend waits on a lock, as pg_stat_activity shows it.
export const waitForLockOf = (sql: Sql, pid: number) =>
  until(async () => {
    const [row] = await sql<{ wait_event_type: string | null }[]>`
      select wait_event_type from pg_stat_activity where pid = ${pid}`;
    return row?.wait_event_type === "Lock";
  }, `a lock wait of backend ${pid}`);

// A connection that listens on the channel of the events. `marker` sends a
// notification of its own and waits for it: everything sent before it has
// arrived by then.
export async function listen(url: string, sender: Sql) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const received: string[] = [];
  await client.listen("toki_events", (payload) => received.push(payload));
  return {
    received,
    async marker(name: string) {
      await sender`select pg_notify('toki_events', ${name})`;
      await until(() => received.includes(name), `the marker ${name}`);
    },
    close: () => client.end(),
  };
}
