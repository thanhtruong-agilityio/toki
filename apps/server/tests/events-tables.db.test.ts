import { EVENT_SCOPES } from "@toki/shared";
import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb } from "./migrated-db.js";
import {
  insertConversation,
  insertUser,
  insertWorkspace,
} from "./test-rows.js";

// The tables `events` and `event_counters` (TOKI-036 R13, R14, R22), in SQL
// text. Two triggers fire before the checks, so a test of a check that a
// trigger would answer first disables that one trigger, always inside a
// transaction that rolls back.

type PgError = Error & {
  code?: string;
  constraint_name?: string;
  column_name?: string;
};

const CHECK = "23514";
const FK = "23503";
const NOT_NULL = "23502";

const FIXED = new Date("2026-01-01T00:00:00.000Z");
const NOWHERE = "0190a000-0000-7000-8000-000000000099";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
let countersAfterMigrations = -1;
let eventsAfterMigrations = -1;

beforeAll(async () => {
  t = await createMigratedDb();
  const count = async (table: string) =>
    (
      await t.sql<
        { n: number }[]
      >`select count(*)::int as n from ${t.sql(table)}`
    )[0]!.n;
  countersAfterMigrations = await count("event_counters");
  eventsAfterMigrations = await count("events");
});
afterAll(async () => {
  await t?.close();
});

async function failsWith(
  run: PromiseLike<unknown>,
  code: string,
  constraint?: string,
): Promise<PgError> {
  let error: PgError | null = null;
  try {
    await run;
  } catch (e) {
    error = e as PgError;
  }
  expect(error, "the statement should have failed").not.toBeNull();
  expect(error!.code, error!.message).toBe(code);
  if (constraint) {
    expect(error!.constraint_name, error!.message).toBe(constraint);
  }
  return error!;
}

// A workspace with a user and a channel, and its counter at 1 unless asked
// otherwise.
async function scene(counter: 0 | 1 | null = 1) {
  const workspace = await insertWorkspace(t.sql);
  const user = await insertUser(t.sql, { workspace_id: workspace });
  const conversation = await insertConversation(t.sql, {
    workspace_id: workspace,
    created_by: user,
  });
  if (counter !== null) {
    await t.sql`insert into event_counters (workspace_id, last_number) values (${workspace}, ${counter})`;
  }
  return { workspace, user, conversation };
}

// `payload` is the JSON value to store; `undefined` stores SQL null.
function event(
  workspace: string,
  over: Record<string, unknown> = {},
  sql: Sql = t.sql,
) {
  const row: Record<string, unknown> = {
    workspace_id: workspace,
    number: 1,
    scope: "workspace",
    conversation_id: null,
    user_id: null,
    type: "message.created",
    payload: {},
    created_at: FIXED,
    ...over,
  };
  row.payload =
    row.payload === undefined ? null : sql.json(row.payload as never);
  return sql`insert into events ${sql(row as Record<string, never>)}`;
}

class Rollback extends Error {}

// Runs a statement with one trigger off, and rolls the transaction back: the
// trigger is on again whatever happens.
async function withoutTrigger(
  table: string,
  trigger: string,
  run: (sql: Sql) => PromiseLike<unknown>,
) {
  await t.sql
    .begin(async (tx) => {
      const sql = tx as unknown as Sql;
      await sql`alter table ${sql(table)} disable trigger ${sql(trigger)}`;
      await run(sql);
      throw new Rollback();
    })
    .catch((error: unknown) => {
      if (!(error instanceof Rollback)) throw error;
    });
}

const columnsOf = async (table: string) =>
  (
    await t.sql<
      {
        name: string;
        type: string;
        required: boolean;
        def: string | null;
      }[]
    >`
      select a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
             a.attnotnull as required, pg_get_expr(d.adbin, d.adrelid) as def
      from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = ${table}::regclass and a.attnum > 0 and not a.attisdropped
      order by a.attnum`
  ).map(
    (c) =>
      `${c.name}:${c.type}${c.required ? " not null" : ""}${c.def ? ` default ${c.def}` : ""}`,
  );

const primaryKeyOf = async (table: string) =>
  (
    await t.sql<{ conname: string; def: string }[]>`
      select conname, pg_get_constraintdef(oid) as def from pg_constraint
      where conrelid = ${table}::regclass and contype = 'p'`
  ).map((k) => `${k.conname}:${k.def}`);

describe("R13: the table events", () => {
  it("R13: has the eight columns and the key of workspace and number", async () => {
    expect(await columnsOf("events")).toEqual([
      "workspace_id:uuid not null",
      "number:bigint not null",
      "scope:text not null",
      "conversation_id:uuid",
      "user_id:uuid",
      "type:text not null",
      "payload:jsonb not null",
      "created_at:timestamp with time zone not null",
    ]);
    expect(await primaryKeyOf("events")).toEqual([
      "events_pkey:PRIMARY KEY (workspace_id, number)",
    ]);
    const indexes = await t.sql<{ indexname: string }[]>`
      select indexname from pg_indexes where tablename = 'events' order by indexname`;
    expect(indexes.map((i) => i.indexname)).toEqual([
      "events_created_at_idx",
      "events_pkey",
    ]);
    expect(eventsAfterMigrations).toBe(0);
  });

  const shapes = EVENT_SCOPES.flatMap((scope) =>
    [false, true].flatMap((withConversation) =>
      [false, true].map((withUser) => ({
        scope,
        withConversation,
        withUser,
        ok:
          withConversation === (scope === "conversation") &&
          withUser === (scope === "user"),
      })),
    ),
  );
  it.each(shapes)(
    "R13: scope $scope, conversation $withConversation, user $withUser: accepted $ok",
    async ({ scope, withConversation, withUser, ok }) => {
      const s = await scene();
      const run = event(s.workspace, {
        scope,
        conversation_id: withConversation ? s.conversation : null,
        user_id: withUser ? s.user : null,
      });
      if (ok) await run;
      else await failsWith(run, CHECK, "events_scope_shape_check");
    },
  );

  it("R13: refuses an unknown scope", async () => {
    const s = await scene();
    await failsWith(
      event(s.workspace, { scope: "team" }),
      CHECK,
      "events_scope_check",
    );
  });

  it("R13: refuses the number 0", async () => {
    // The counter may hold 0, so the trigger passes and the check answers.
    const s = await scene(0);
    await failsWith(
      event(s.workspace, { number: 0 }),
      CHECK,
      "events_number_check",
    );
  });

  it.each(["-1", "9007199254740992"])(
    "R13: refuses the number %s",
    async (number) => {
      const s = await scene();
      await failsWith(
        withoutTrigger("events", "events_number_trg", (sql) =>
          event(s.workspace, { number }, sql),
        ),
        CHECK,
        "events_number_check",
      );
    },
  );

  it("R13: accepts the largest number a client can hold", async () => {
    const s = await scene();
    await withoutTrigger("events", "events_number_trg", (sql) =>
      event(s.workspace, { number: "9007199254740991" }, sql),
    );
  });

  it.each(["Message", "message created", `a${"b".repeat(64)}`, ""])(
    "R13: refuses the type %j",
    async (type) => {
      const s = await scene();
      await failsWith(event(s.workspace, { type }), CHECK, "events_type_check");
    },
  );

  it.each(["member.joined", `a${"b".repeat(63)}`])(
    "R13: accepts the type %j",
    async (type) => {
      const s = await scene();
      await event(s.workspace, { type });
    },
  );

  it.each([[[]], ["text"], [1]])(
    "R13: refuses the payload %j",
    async (payload) => {
      const s = await scene();
      await failsWith(
        event(s.workspace, { payload }),
        CHECK,
        "events_payload_check",
      );
    },
  );

  it("R13: refuses no payload", async () => {
    const s = await scene();
    const error = await failsWith(
      event(s.workspace, { payload: undefined }),
      NOT_NULL,
    );
    expect(error.column_name).toBe("payload");
  });

  it("R13: refuses every update and allows a delete", async () => {
    const s = await scene();
    await event(s.workspace);
    for (const column of [
      "workspace_id",
      "number",
      "scope",
      "conversation_id",
      "user_id",
      "type",
      "payload",
      "created_at",
    ]) {
      await failsWith(
        t.sql`update events set ${t.sql(column)} = ${t.sql(column)} where workspace_id = ${s.workspace}`,
        CHECK,
        "events_no_update_trg",
      );
    }
    const gone =
      await t.sql`delete from events where workspace_id = ${s.workspace}`;
    expect(gone.count).toBe(1);
  });

  it("R13: refuses a conversation of another workspace and an unknown user", async () => {
    const s = await scene();
    const foreign = await scene(null);
    await failsWith(
      event(s.workspace, {
        scope: "conversation",
        conversation_id: foreign.conversation,
      }),
      FK,
      "events_conversation_id_fkey",
    );
    await failsWith(
      event(s.workspace, { scope: "user", user_id: NOWHERE }),
      FK,
      "events_user_id_fkey",
    );
  });
});

const setCounter = (workspace: string, value: number | string) =>
  t.sql`update event_counters set last_number = ${value} where workspace_id = ${workspace}`;

describe("R14: the counter and the two triggers", () => {
  it("R14: has two columns, one row per workspace, and no row after the migrations", async () => {
    expect(await columnsOf("event_counters")).toEqual([
      "workspace_id:uuid not null",
      "last_number:bigint not null",
    ]);
    expect(await primaryKeyOf("event_counters")).toEqual([
      "event_counters_pkey:PRIMARY KEY (workspace_id)",
    ]);
    expect(countersAfterMigrations).toBe(0);
  });

  it("R14: starts at 0 or 1 and rises by exactly 1", async () => {
    const zero = await scene(0);
    await setCounter(zero.workspace, 1);
    const one = await scene(1);
    await setCounter(one.workspace, 2);
    await setCounter(one.workspace, 3);
    for (const value of [5, 2, 3]) {
      await failsWith(
        setCounter(one.workspace, value),
        CHECK,
        "event_counters_step_trg",
      );
    }
    await failsWith(
      t.sql`delete from event_counters where workspace_id = ${one.workspace}`,
      CHECK,
      "event_counters_step_trg",
    );
    await setCounter(one.workspace, 4);
  });

  it.each([5, 2, -1])(
    "R14: refuses a counter inserted with %d",
    async (value) => {
      const s = await scene(null);
      await failsWith(
        t.sql`insert into event_counters (workspace_id, last_number) values (${s.workspace}, ${value})`,
        CHECK,
        "event_counters_step_trg",
      );
    },
  );

  it.each(["-1", "9007199254740992"])(
    "R14: the check refuses a last number of %s",
    async (value) => {
      const s = await scene(null);
      await failsWith(
        withoutTrigger(
          "event_counters",
          "event_counters_step_trg",
          (sql) =>
            sql`insert into event_counters (workspace_id, last_number) values (${s.workspace}, ${value})`,
        ),
        CHECK,
        "event_counters_last_number_check",
      );
    },
  );

  it("R14: refuses a counter of an unknown workspace", async () => {
    await failsWith(
      t.sql`insert into event_counters (workspace_id, last_number) values (${NOWHERE}, 1)`,
      FK,
      "event_counters_workspace_id_fkey",
    );
  });

  it("R14: refuses an event whose number is not the counter's", async () => {
    const s = await scene();
    await setCounter(s.workspace, 2);
    for (const number of [3, 1]) {
      await failsWith(
        event(s.workspace, { number }),
        CHECK,
        "events_number_trg",
      );
    }
    const bare = await scene(null);
    await failsWith(event(bare.workspace), CHECK, "events_number_trg");
    await event(s.workspace, { number: 2 });
  });
});

describe("R22: the check holds the shared scopes", () => {
  it("R22: events_scope_check lists the scopes", async () => {
    const [row] = await t.sql<{ def: string }[]>`
      select pg_get_constraintdef(oid) as def from pg_constraint
      where conname = 'events_scope_check'`;
    const quoted = [...row!.def.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(quoted).toEqual([...EVENT_SCOPES]);
  });
});
