import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHANNEL_DESCRIPTION_MAX,
  CHANNEL_NAME_PATTERN,
  GROUP_DM_MAX_PEOPLE,
  CHANNEL_TOPIC_MAX,
  isValidChannelDescription,
  isValidChannelTopic,
} from "@toki/shared";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayDb } from "./throwaway-db.js";
import { migrationsFolder, runMigrations } from "../src/db/migrate.js";
import {
  insertConversation,
  insertConversationMember,
  insertDevice,
  insertDirectConversation,
  insertLoginCode,
  insertSession,
  insertUser,
  insertWorkspace,
} from "./test-rows.js";

// The constraint tests send SQL text, so they prove what the database enforces
// whatever the Drizzle definitions say (R1 to R10, R12 to R14, R16, R17, R19 to
// R23). Every "must fail" case asserts the constraint or trigger name in the
// Postgres error, and every refused row is otherwise valid.

type PgError = Error & {
  code?: string;
  constraint_name?: string;
  column_name?: string;
};

let throwaway: Awaited<ReturnType<typeof createThrowawayDb>>;
let sql: Sql;
let sqlA: Sql;
let sqlB: Sql;
let ws: string;
let u1: string;
let u2: string;
let u3: string;
let emptyConversations = -1;
let emptyMembers = -1;

const FIXED = new Date("2026-01-01T00:00:00.000Z");

beforeAll(async () => {
  throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  const open = () => postgres(throwaway.url, { max: 1, onnotice: () => {} });
  sql = open();
  sqlA = open();
  sqlB = open();
  const count = async (table: string) =>
    (
      await sql<{ n: number }[]>`select count(*)::int as n from ${sql(table)}`
    )[0]!.n;
  emptyConversations = await count("conversations");
  emptyMembers = await count("conversation_members");
  ws = await insertWorkspace(sql);
  u1 = await insertUser(sql, { workspace_id: ws });
  u2 = await insertUser(sql, { workspace_id: ws });
  u3 = await insertUser(sql, { workspace_id: ws });
});
afterAll(async () => {
  await sql?.end();
  await sqlA?.end();
  await sqlB?.end();
  await throwaway?.drop();
});

async function fails(run: PromiseLike<unknown>): Promise<PgError> {
  let error: unknown = null;
  try {
    await run;
  } catch (e) {
    error = e;
  }
  expect(error, "the statement should have failed").not.toBeNull();
  return error as PgError;
}

async function failsWith(
  run: PromiseLike<unknown>,
  code: string,
  constraint?: string,
): Promise<PgError> {
  const error = await fails(run);
  expect(error.code, error.message).toBe(code);
  if (constraint) expect(error.constraint_name, error.message).toBe(constraint);
  return error;
}

const CHECK = "23514";
const UNIQUE = "23505";
const FK = "23503";
const NOT_NULL = "23502";

let n = 0;
const chan = (over: Record<string, unknown> = {}) =>
  insertConversation(sql, {
    workspace_id: ws,
    created_by: u1,
    name: `c-${(n += 1)}-${crypto.randomUUID().slice(0, 6)}`,
    ...over,
  });
const rowOf = async (id: string) =>
  (await sql`select * from conversations where id = ${id}`)[0]!;
const uuids = (count: number) =>
  Array.from(
    { length: count },
    (_, i) => `0190a000-0000-7000-8000-${String(i + 1).padStart(12, "0")}`,
  );

// A raw insert with a key and no member rows is only valid in a transaction
// that adds the members; these helpers state the whole conversation.
const rawDm = (over: Record<string, unknown>) =>
  sql`insert into conversations ${sql({
    id: crypto.randomUUID(),
    workspace_id: ws,
    kind: "dm",
    name: null,
    topic: null,
    description: null,
    is_private: true,
    is_general: false,
    dm_key: null,
    created_by: u1,
    created_at: FIXED,
    archived_at: null,
    ...over,
  } as unknown as Record<string, never>)}`;

describe("R1, R19, R20: the tables exist and are empty", () => {
  it("has exactly the columns of the spec", async () => {
    const cols = async (table: string) =>
      (
        await sql<
          { column_name: string; data_type: string; is_nullable: string }[]
        >`
          select column_name, data_type, is_nullable from information_schema.columns
          where table_schema = 'public' and table_name = ${table} order by ordinal_position`
      ).map((c) => `${c.column_name}:${c.data_type}:${c.is_nullable}`);
    expect(await cols("conversations")).toEqual([
      "id:uuid:NO",
      "workspace_id:uuid:NO",
      "kind:text:NO",
      "name:text:YES",
      "topic:text:YES",
      "description:text:YES",
      "is_private:boolean:NO",
      "is_general:boolean:NO",
      "dm_key:text:YES",
      "created_by:uuid:NO",
      "created_at:timestamp with time zone:NO",
      "archived_at:timestamp with time zone:YES",
    ]);
    expect(await cols("conversation_members")).toEqual([
      "conversation_id:uuid:NO",
      "user_id:uuid:NO",
      "workspace_id:uuid:NO",
      "notification_level:text:YES",
      "is_muted:boolean:NO",
      "is_starred:boolean:NO",
      "created_at:timestamp with time zone:NO",
    ]);
  });
  it("is empty after the migrations (R20: no row inserted)", () => {
    expect(emptyConversations).toBe(0);
    expect(emptyMembers).toBe(0);
  });
  it("is one migration file with two CREATE TABLE statements", () => {
    const text = readFileSync(
      join(migrationsFolder, "0002_conversation_tables.sql"),
      "utf8",
    );
    expect(
      text.match(/CREATE TABLE "(conversations|conversation_members)"/g),
    ).toHaveLength(2);
    expect(text).not.toMatch(/\bINSERT INTO\b/i);
    expect(text).not.toMatch(
      /\b(ALTER|DROP) TABLE "(workspaces|users|sessions|login_codes|devices)"/,
    );
  });
});

describe("R2, R17: id and time", () => {
  it("keeps an id passed in", async () => {
    const id = crypto.randomUUID();
    expect(await chan({ id })).toBe(id);
  });
  it("has timestamptz time columns with no default, and created_at required", async () => {
    const rows = await sql<
      {
        table_name: string;
        column_name: string;
        data_type: string;
        column_default: string | null;
        is_nullable: string;
      }[]
    >`
      select table_name, column_name, data_type, column_default, is_nullable
      from information_schema.columns
      where table_schema = 'public' and column_name in ('created_at', 'archived_at')
        and table_name in ('conversations', 'conversation_members')`;
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.data_type).toBe("timestamp with time zone");
      expect(r.column_default).toBeNull();
      if (r.column_name === "created_at") expect(r.is_nullable).toBe("NO");
    }
  });
  it("refuses an insert without created_at, naming the column", async () => {
    const error = await failsWith(
      sql`insert into conversations (id, workspace_id, kind, name, created_by)
          values (${crypto.randomUUID()}, ${ws}, 'channel', 'no-time', ${u1})`,
      NOT_NULL,
    );
    expect(error.column_name).toBe("created_at");
  });
});

describe("R3: kind and name", () => {
  it.each(["qa-team", "a", "a".repeat(80), "0-9"])(
    "accepts the name %j",
    async (name) => {
      const w = await insertWorkspace(sql);
      const u = await insertUser(sql, { workspace_id: w });
      await insertConversation(sql, { workspace_id: w, created_by: u, name });
    },
  );
  it.each([
    ["a name of 81 characters", "a".repeat(81)],
    ["an empty name", ""],
    ["Q&A Team!", "Q&A Team!"],
    ["qa team", "qa team"],
    ["QA", "QA"],
    ["null", null],
  ])("refuses %s with conversations_name_check", async (_label, name) => {
    const w = await insertWorkspace(sql);
    const u = await insertUser(sql, { workspace_id: w });
    await failsWith(
      insertConversation(sql, { workspace_id: w, created_by: u, name }),
      CHECK,
      "conversations_name_check",
    );
  });
  it("refuses a kind that is not channel, dm or group_dm", async () => {
    await failsWith(
      rawDm({
        kind: "other",
        dm_key: `${u1},${u2}`.split(",").sort().join(","),
      }),
      CHECK,
      "conversations_kind_check",
    );
  });
});

describe("R4: names are unique, also at the same moment", () => {
  it("refuses the same name twice, and an archived name", async () => {
    const w = await insertWorkspace(sql);
    const user = await insertUser(sql, { workspace_id: w });
    const first = await insertConversation(sql, {
      workspace_id: w,
      created_by: user,
      name: "launch",
    });
    await failsWith(
      insertConversation(sql, {
        workspace_id: w,
        created_by: user,
        name: "launch",
      }),
      UNIQUE,
      "conversations_workspace_id_name_key",
    );
    await sql`update conversations set archived_at = ${FIXED} where id = ${first}`;
    await failsWith(
      insertConversation(sql, {
        workspace_id: w,
        created_by: user,
        name: "launch",
      }),
      UNIQUE,
      "conversations_workspace_id_name_key",
    );
  });
  it("accepts the same name in another workspace", async () => {
    const w1 = await insertWorkspace(sql);
    const w2 = await insertWorkspace(sql);
    const a = await insertUser(sql, { workspace_id: w1 });
    const b = await insertUser(sql, { workspace_id: w2 });
    await insertConversation(sql, {
      workspace_id: w1,
      created_by: a,
      name: "same",
    });
    await insertConversation(sql, {
      workspace_id: w2,
      created_by: b,
      name: "same",
    });
  });
  it("(c) two connections insert the same name at once: one row, the other unique error", async () => {
    const w = await insertWorkspace(sql);
    const user = await insertUser(sql, { workspace_id: w });
    const error = await raceInserts(
      (tx) =>
        insertConversation(tx, {
          workspace_id: w,
          created_by: user,
          name: "release",
        }),
      (db) =>
        insertConversation(db, {
          workspace_id: w,
          created_by: user,
          name: "release",
        }),
    );
    expect(error.code).toBe(UNIQUE);
    expect(error.constraint_name).toBe("conversations_workspace_id_name_key");
    const [row] = await sql<
      { n: number }[]
    >`select count(*)::int as n from conversations where workspace_id = ${w} and name = 'release'`;
    expect(row!.n).toBe(1);
  });
});

// The first connection inserts and holds the transaction open; the second
// starts the same insert and must wait on a lock (polled in pg_stat_activity,
// so the test proves a real race); then the first commits.
async function raceInserts(
  first: (tx: Sql) => Promise<unknown>,
  second: (db: Sql) => Promise<unknown>,
): Promise<PgError> {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let inserted!: () => void;
  const insertedP = new Promise<void>((r) => (inserted = r));
  const firstDone = sqlA.begin(async (tx) => {
    await first(tx as unknown as Sql);
    inserted();
    await gate;
  });
  // If the first insert fails, firstDone rejects and the race ends here.
  await Promise.race([insertedP, firstDone]);
  const secondDone = Promise.resolve(second(sqlB)).then(
    () => null,
    (e: PgError) => e,
  );
  const deadline = Date.now() + 5000;
  for (;;) {
    const [w] = await sql<
      { n: number }[]
    >`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`;
    if (w!.n > 0) break;
    if (Date.now() > deadline)
      throw new Error("the second insert never waited on the lock");
    await new Promise((r) => setTimeout(r, 20));
  }
  release();
  await firstDone;
  const error = await secondDone;
  expect(error, "the second insert should have failed").not.toBeNull();
  return error!;
}

describe("R5: direct messages and groups have no channel columns", () => {
  const key = () => [u1, u2].sort().join(",");
  it("accepts a valid DM with its members", async () => {
    const id = await insertDirectConversation(sql, {
      workspace_id: ws,
      user_ids: [u1, u3],
    });
    expect((await rowOf(id)).kind).toBe("dm");
  });
  it.each([
    ["a name", { name: "x" }],
    ["a topic", { topic: "t" }],
    ["a description", { description: "d" }],
    ["is_private false", { is_private: false }],
    ["an archive time", { archived_at: FIXED }],
  ])("refuses a DM with %s", async (_l, over) => {
    await failsWith(
      rawDm({ dm_key: key(), ...over }),
      CHECK,
      "conversations_dm_shape_check",
    );
  });
  it("refuses a channel with a dm_key", async () => {
    await failsWith(
      chan({ dm_key: key() }),
      CHECK,
      "conversations_channel_shape_check",
    );
  });
});

describe("R6, R7: topic and description limits count code points", () => {
  const cases = [
    [
      "topic",
      CHANNEL_TOPIC_MAX,
      isValidChannelTopic,
      "conversations_topic_check",
    ],
    [
      "description",
      CHANNEL_DESCRIPTION_MAX,
      isValidChannelDescription,
      "conversations_description_check",
    ],
  ] as const;
  for (const [column, max, valid, constraint] of cases) {
    it.each([
      ["letters", "a"],
      ["Vietnamese", "ệ"],
      ["emoji", "😀"],
    ])(
      `${column}: ${max} ${"%s"} accepted, ${max + 1} refused`,
      async (_l, ch) => {
        const ok = ch.repeat(max);
        const bad = ch.repeat(max + 1);
        expect(valid(ok)).toBe(true);
        expect(valid(bad)).toBe(false);
        await chan({ [column]: ok });
        await failsWith(chan({ [column]: bad }), CHECK, constraint);
      },
    );
    it(`${column}: null accepted, empty string refused`, async () => {
      await chan({ [column]: null });
      expect(valid("")).toBe(false);
      await failsWith(chan({ [column]: "" }), CHECK, constraint);
    });
  }
});

describe("R8: what never changes", () => {
  it.each([
    ["is_private", true],
    ["is_general", true],
    ["workspace_id", "other"],
    [
      "dm_key",
      `${"0190a000-0000-7000-8000-000000000001"},${"0190a000-0000-7000-8000-000000000002"}`,
    ],
    ["kind", "dm"],
  ])(
    "refuses an update of %s, naming conversations_immutable_trg",
    async (column, value) => {
      const id = await chan();
      const before = await rowOf(id);
      const v = value === "other" ? await insertWorkspace(sql) : value;
      await failsWith(
        sql`update conversations set ${sql(column)} = ${v as never} where id = ${id}`,
        CHECK,
        "conversations_immutable_trg",
      );
      expect(await rowOf(id)).toEqual(before);
    },
  );
  it("accepts topic, description and archived_at, and a column set to its own value", async () => {
    const id = await chan();
    await sql`update conversations set topic = 't', description = 'd', archived_at = ${FIXED} where id = ${id}`;
    await sql`update conversations set archived_at = null where id = ${id}`;
    await sql`update conversations set kind = kind, is_private = is_private where id = ${id}`;
    const row = await rowOf(id);
    expect(row.topic).toBe("t");
    expect(row.archived_at).toBeNull();
  });
});

describe("R9: #general", () => {
  const general = async (
    w: string,
    u: string,
    over: Record<string, unknown> = {},
  ) =>
    insertConversation(sql, {
      workspace_id: w,
      created_by: u,
      name: "general",
      is_general: true,
      ...over,
    });
  it("accepts one general row per workspace, and one in a second workspace", async () => {
    const w1 = await insertWorkspace(sql);
    const w2 = await insertWorkspace(sql);
    const a = await insertUser(sql, { workspace_id: w1 });
    const b = await insertUser(sql, { workspace_id: w2 });
    await general(w1, a);
    await general(w2, b);
    await failsWith(
      general(w1, a),
      UNIQUE,
      "conversations_workspace_id_name_key",
    );
  });
  it("refuses a private, archived or non-channel general row, and a wrong name", async () => {
    const w = await insertWorkspace(sql);
    const a = await insertUser(sql, { workspace_id: w });
    await failsWith(
      general(w, a, { is_private: true }),
      CHECK,
      "conversations_general_shape_check",
    );
    await failsWith(
      general(w, a, { archived_at: FIXED }),
      CHECK,
      "conversations_general_shape_check",
    );
    await failsWith(
      general(w, a, { name: "random" }),
      CHECK,
      "conversations_general_name_check",
    );
    await failsWith(
      rawDm({
        workspace_id: w,
        created_by: a,
        is_general: true,
        dm_key: [a, u1].sort().join(","),
      }),
      CHECK,
      "conversations_general_shape_check",
    );
  });
  it("refuses a channel named general whose flag is false", async () => {
    const w = await insertWorkspace(sql);
    const a = await insertUser(sql, { workspace_id: w });
    await failsWith(
      insertConversation(sql, {
        workspace_id: w,
        created_by: a,
        name: "general",
        is_general: false,
      }),
      CHECK,
      "conversations_general_name_check",
    );
  });
  it("cannot be archived, while another channel can", async () => {
    const w = await insertWorkspace(sql);
    const a = await insertUser(sql, { workspace_id: w });
    const g = await general(w, a);
    await failsWith(
      sql`update conversations set archived_at = ${FIXED} where id = ${g}`,
      CHECK,
      "conversations_general_shape_check",
    );
    const other = await insertConversation(sql, {
      workspace_id: w,
      created_by: a,
    });
    await sql`update conversations set archived_at = ${FIXED} where id = ${other}`;
  });
});

describe("R10: the key of a direct message or group", () => {
  const ids = uuids(10);
  const keyOf = (list: string[]) => list.join(",");
  // Members are the ids of the key, so each one needs a users row.
  let people: string[];
  beforeAll(async () => {
    people = [];
    for (let i = 0; i < 10; i += 1)
      people.push(await insertUser(sql, { workspace_id: ws }));
  });
  const dmOf = (list: string[], over: Record<string, unknown> = {}) =>
    insertDirectConversation(sql, {
      workspace_id: ws,
      user_ids: list,
      ...over,
    });

  it("accepts a DM of 2 sorted ids and a group of 8", async () => {
    await dmOf([people[0]!, people[1]!]);
    await dmOf(people.slice(0, 8));
  });
  it("refuses the unsorted order and a repeated id, with the order check", async () => {
    const [a, b] = [ids[0]!, ids[1]!];
    await failsWith(
      rawDm({ dm_key: keyOf([b, a]) }),
      CHECK,
      "conversations_dm_key_order_check",
    );
    await failsWith(
      rawDm({ dm_key: keyOf([a, a]) }),
      CHECK,
      "conversations_dm_key_order_check",
    );
  });
  it("refuses the wrong number of people", async () => {
    await failsWith(
      rawDm({ kind: "dm", dm_key: keyOf(ids.slice(0, 3)) }),
      CHECK,
      "conversations_dm_key_size_check",
    );
    await failsWith(
      rawDm({ kind: "group_dm", dm_key: keyOf(ids.slice(0, 2)) }),
      CHECK,
      "conversations_dm_key_size_check",
    );
    await failsWith(
      rawDm({ kind: "group_dm", dm_key: keyOf(ids.slice(0, 9)) }),
      CHECK,
      "conversations_dm_key_size_check",
    );
  });
  it.each([
    ["upper case", () => keyOf(ids.slice(0, 2)).toUpperCase()],
    ["not a UUID", () => "abc,def"],
    ["an empty id", () => `,${ids[1]}`],
    ["a trailing comma", () => `${ids[0]},${ids[1]},`],
    ["spaces", () => `${ids[0]}, ${ids[1]}`],
  ])("refuses a key with %s", async (_l, make) => {
    const error = await fails(rawDm({ dm_key: make() }));
    expect(error.code).toBe(CHECK);
    expect([
      "conversations_dm_key_shape_check",
      "conversations_dm_key_order_check",
    ]).toContain(error.constraint_name);
  });
  it("refuses a channel with a key and a DM with a null key", async () => {
    await failsWith(
      chan({ dm_key: keyOf(ids.slice(0, 2)) }),
      CHECK,
      "conversations_channel_shape_check",
    );
    await failsWith(
      rawDm({ dm_key: null }),
      CHECK,
      "conversations_dm_key_shape_check",
    );
  });
  it("refuses the same set twice, also at the same moment", async () => {
    const w = await insertWorkspace(sql);
    const x = await insertUser(sql, { workspace_id: w });
    const y = await insertUser(sql, { workspace_id: w });
    const key = [x, y].sort().join(",");
    const dm = (db: Sql) => insertConversationFor(db, w, x, key, [x, y]);
    const error = await raceInserts(
      (tx) => dm(tx),
      (db) => dm(db),
    );
    expect(error.code).toBe(UNIQUE);
    expect(error.constraint_name).toBe("conversations_workspace_id_dm_key_key");
    const [row] = await sql<
      { n: number }[]
    >`select count(*)::int as n from conversations where workspace_id = ${w}`;
    expect(row!.n).toBe(1);
  });
});

// One DM and its member rows in the caller's transaction (or a new one).
async function insertConversationFor(
  db: Sql,
  w: string,
  creator: string,
  key: string,
  members: string[],
) {
  const id = await insertConversation(db, {
    workspace_id: w,
    created_by: creator,
    kind: "dm",
    name: null,
    is_private: true,
    dm_key: key,
  });
  for (const user_id of members)
    await insertConversationMember(db, {
      conversation_id: id,
      user_id,
      workspace_id: w,
    });
  return id;
}

describe("R12, R13, R14: member columns", () => {
  it("has the primary key, the user index and refuses the same pair twice", async () => {
    const [pk] = await sql<{ conname: string; cols: string[] }[]>`
      select conname, array(select attname from pg_attribute where attrelid = conrelid and attnum = any (conkey) order by attname) as cols
      from pg_constraint where conrelid = 'conversation_members'::regclass and contype = 'p'`;
    expect(pk).toEqual({
      conname: "conversation_members_pkey",
      cols: ["conversation_id", "user_id"],
    });
    const idx = await sql<
      { indexname: string }[]
    >`select indexname from pg_indexes where tablename = 'conversation_members'`;
    expect(idx.map((i) => i.indexname)).toContain(
      "conversation_members_user_id_idx",
    );
    const c = await chan();
    await insertConversationMember(sql, {
      conversation_id: c,
      user_id: u1,
      workspace_id: ws,
    });
    await failsWith(
      insertConversationMember(sql, {
        conversation_id: c,
        user_id: u1,
        workspace_id: ws,
      }),
      UNIQUE,
      "conversation_members_pkey",
    );
  });
  it("keeps mute and star per row", async () => {
    const c = await chan();
    await insertConversationMember(sql, {
      conversation_id: c,
      user_id: u1,
      workspace_id: ws,
    });
    await insertConversationMember(sql, {
      conversation_id: c,
      user_id: u2,
      workspace_id: ws,
    });
    await sql`update conversation_members set is_muted = true, is_starred = true where conversation_id = ${c} and user_id = ${u1}`;
    const rows =
      await sql`select user_id, is_muted, is_starred from conversation_members where conversation_id = ${c}`;
    const other = rows.find((r) => r.user_id === u2)!;
    expect([other.is_muted, other.is_starred]).toEqual([false, false]);
  });
  it("accepts all, mentions, none and null; refuses loud and nothing", async () => {
    for (const level of ["all", "mentions", "none", null]) {
      const c = await chan();
      await insertConversationMember(sql, {
        conversation_id: c,
        user_id: u1,
        workspace_id: ws,
        notification_level: level,
      });
    }
    for (const level of ["loud", "nothing"]) {
      const c = await chan();
      await failsWith(
        insertConversationMember(sql, {
          conversation_id: c,
          user_id: u1,
          workspace_id: ws,
          notification_level: level,
        }),
        CHECK,
        "conversation_members_notification_level_check",
      );
    }
  });
});

describe("R15: the shared values agree with the database", () => {
  it("accepts and refuses the same names", async () => {
    const names = ["a", "a".repeat(80), "a".repeat(81), "", "QA", "q a", "x-1"];
    for (const name of names) {
      const w = await insertWorkspace(sql);
      const u = await insertUser(sql, { workspace_id: w });
      let accepted = true;
      try {
        await insertConversation(sql, { workspace_id: w, created_by: u, name });
      } catch {
        accepted = false;
      }
      expect(accepted, JSON.stringify(name)).toBe(
        CHANNEL_NAME_PATTERN.test(name),
      );
    }
  });

  it("accepts and refuses the same group sizes", async () => {
    for (const size of [2, 3, GROUP_DM_MAX_PEOPLE, GROUP_DM_MAX_PEOPLE + 1]) {
      const w = await insertWorkspace(sql);
      const people: string[] = [];
      for (let i = 0; i < size; i += 1) {
        people.push(await insertUser(sql, { workspace_id: w }));
      }
      let accepted = true;
      try {
        await insertDirectConversation(sql, {
          workspace_id: w,
          user_ids: people,
        });
      } catch {
        accepted = false;
      }
      expect(accepted, `${size} people`).toBe(size <= GROUP_DM_MAX_PEOPLE);
    }
  });
});

describe("R16: foreign keys", () => {
  it("has the five keys, all ON DELETE RESTRICT, with these names", async () => {
    const rows = await sql<{ conname: string; confdeltype: string }[]>`
      select conname, confdeltype from pg_constraint
      where contype = 'f' and conrelid in ('conversations'::regclass, 'conversation_members'::regclass)`;
    expect(
      Object.fromEntries(rows.map((r) => [r.conname, r.confdeltype])),
    ).toEqual({
      conversations_workspace_id_fkey: "r",
      conversations_created_by_fkey: "r",
      conversation_members_workspace_id_fkey: "r",
      conversation_members_user_id_fkey: "r",
      conversation_members_conversation_id_fkey: "r",
    });
  });
  it("refuses an id that does not exist, per key", async () => {
    const ghost = crypto.randomUUID();
    await failsWith(
      chan({ workspace_id: ghost }),
      FK,
      "conversations_workspace_id_fkey",
    );
    await failsWith(
      chan({ created_by: ghost }),
      FK,
      "conversations_created_by_fkey",
    );
    const c = await chan();
    await failsWith(
      insertConversationMember(sql, {
        conversation_id: c,
        user_id: ghost,
        workspace_id: ws,
      }),
      FK,
      "conversation_members_user_id_fkey",
    );
    await failsWith(
      insertConversationMember(sql, {
        conversation_id: c,
        user_id: u1,
        workspace_id: ghost,
      }),
      FK,
      "conversation_members_workspace_id_fkey",
    );
    await failsWith(
      insertConversationMember(sql, {
        conversation_id: ghost,
        user_id: u1,
        workspace_id: ws,
      }),
      FK,
      "conversation_members_conversation_id_fkey",
    );
  });
  it("refuses a member row with another workspace than its conversation", async () => {
    const other = await insertWorkspace(sql);
    const c = await chan();
    await failsWith(
      insertConversationMember(sql, {
        conversation_id: c,
        user_id: u1,
        workspace_id: other,
      }),
      FK,
      "conversation_members_conversation_id_fkey",
    );
  });
  it("refuses to delete a user or a workspace a row points to", async () => {
    const w = await insertWorkspace(sql);
    const u = await insertUser(sql, { workspace_id: w });
    const c = await insertConversation(sql, { workspace_id: w, created_by: u });
    await insertConversationMember(sql, {
      conversation_id: c,
      user_id: u,
      workspace_id: w,
    });
    const e1 = await failsWith(sql`delete from users where id = ${u}`, FK);
    expect([
      "conversations_created_by_fkey",
      "conversation_members_user_id_fkey",
    ]).toContain(e1.constraint_name);
    // A person that only a member row points to names the member key.
    const member = await insertUser(sql, { workspace_id: w });
    await insertConversationMember(sql, {
      conversation_id: c,
      user_id: member,
      workspace_id: w,
    });
    await failsWith(
      sql`delete from users where id = ${member}`,
      FK,
      "conversation_members_user_id_fkey",
    );
    const e2 = await failsWith(sql`delete from workspaces where id = ${w}`, FK);
    expect([
      "conversations_workspace_id_fkey",
      "conversation_members_workspace_id_fkey",
      "users_workspace_id_fkey",
    ]).toContain(e2.constraint_name);
    // A workspace that only a conversation points to names the conversation key.
    const w0 = await insertWorkspace(sql);
    const creator = await insertUser(sql, { workspace_id: w0 });
    const w2 = await insertWorkspace(sql);
    await insertConversation(sql, { workspace_id: w2, created_by: creator });
    await failsWith(
      sql`delete from workspaces where id = ${w2}`,
      FK,
      "conversations_workspace_id_fkey",
    );
  });
});

describe("R21: members of a direct message or group", () => {
  const dmKey = (a: string, b: string) => [a, b].sort().join(",");
  it("refuses a member outside the key, and accepts the pair in one transaction", async () => {
    const w = await insertWorkspace(sql);
    const [a, b, c] = [
      await insertUser(sql, { workspace_id: w }),
      await insertUser(sql, { workspace_id: w }),
      await insertUser(sql, { workspace_id: w }),
    ] as [string, string, string];
    await sql.begin(async (tx) => {
      const db = tx as unknown as Sql;
      const id = await insertConversation(db, {
        workspace_id: w,
        created_by: a,
        kind: "dm",
        name: null,
        is_private: true,
        dm_key: dmKey(a, b),
      });
      // A failed statement aborts the transaction, so it runs in a savepoint.
      const error = await fails(
        tx.savepoint((sp) =>
          insertConversationMember(sp as unknown as Sql, {
            conversation_id: id,
            user_id: c,
            workspace_id: w,
          }),
        ),
      );
      expect(error.code).toBe(CHECK);
      expect(error.constraint_name).toBe("conversation_members_fixed_trg");
      await insertConversationMember(db, {
        conversation_id: id,
        user_id: a,
        workspace_id: w,
      });
      await insertConversationMember(db, {
        conversation_id: id,
        user_id: b,
        workspace_id: w,
      });
    });
  });
  it("refuses at commit a DM with a missing member, naming the trigger", async () => {
    const w = await insertWorkspace(sql);
    const a = await insertUser(sql, { workspace_id: w });
    const b = await insertUser(sql, { workspace_id: w });
    const error = await fails(
      sql.begin(async (tx) => {
        const db = tx as unknown as Sql;
        const id = await insertConversation(db, {
          workspace_id: w,
          created_by: a,
          kind: "dm",
          name: null,
          is_private: true,
          dm_key: dmKey(a, b),
        });
        await insertConversationMember(db, {
          conversation_id: id,
          user_id: a,
          workspace_id: w,
        });
      }),
    );
    expect(error.code).toBe(CHECK);
    expect(error.constraint_name).toBe("conversations_members_complete_trg");
  });
  it("commits a group of 8 with 8 rows and refuses one with 7", async () => {
    const w = await insertWorkspace(sql);
    const people = async () => {
      const list: string[] = [];
      for (let i = 0; i < 8; i += 1)
        list.push(await insertUser(sql, { workspace_id: w }));
      return list;
    };
    await insertDirectConversation(sql, {
      workspace_id: w,
      user_ids: await people(),
    });
    const second = await people();
    const error = await fails(
      sql.begin(async (tx) => {
        const db = tx as unknown as Sql;
        const id = await insertConversation(db, {
          workspace_id: w,
          created_by: second[0]!,
          kind: "group_dm",
          name: null,
          is_private: true,
          dm_key: [...second].sort().join(","),
        });
        for (const p of second.slice(0, 7))
          await insertConversationMember(db, {
            conversation_id: id,
            user_id: p,
            workspace_id: w,
          });
      }),
    );
    expect(error.code).toBe(CHECK);
    expect(error.constraint_name).toBe("conversations_members_complete_trg");
  });
  it("refuses to delete or move a DM member row, accepts a mute", async () => {
    const w = await insertWorkspace(sql);
    const a = await insertUser(sql, { workspace_id: w });
    const b = await insertUser(sql, { workspace_id: w });
    const id = await insertDirectConversation(sql, {
      workspace_id: w,
      user_ids: [a, b],
    });
    await failsWith(
      sql`delete from conversation_members where conversation_id = ${id} and user_id = ${a}`,
      CHECK,
      "conversation_members_fixed_trg",
    );
    await failsWith(
      sql`update conversation_members set user_id = ${crypto.randomUUID()} where conversation_id = ${id} and user_id = ${a}`,
      CHECK,
      "conversation_members_fixed_trg",
    );
    await sql`update conversation_members set is_muted = true where conversation_id = ${id} and user_id = ${a}`;
  });
  it("lets a channel's members come, go and change their level", async () => {
    const c = await chan();
    await insertConversationMember(sql, {
      conversation_id: c,
      user_id: u1,
      workspace_id: ws,
    });
    await sql`update conversation_members set notification_level = 'none' where conversation_id = ${c} and user_id = ${u1}`;
    await failsWith(
      sql`update conversation_members set user_id = ${u2} where conversation_id = ${c}`,
      CHECK,
      "conversation_members_fixed_trg",
    );
    await sql`delete from conversation_members where conversation_id = ${c} and user_id = ${u1}`;
  });
});

describe("R22: a conversation is never deleted", () => {
  it("refuses to delete a channel with members, one with none, and a DM", async () => {
    const withMembers = await chan();
    await insertConversationMember(sql, {
      conversation_id: withMembers,
      user_id: u1,
      workspace_id: ws,
    });
    const empty = await chan();
    const dm = await insertDirectConversation(sql, {
      workspace_id: ws,
      user_ids: [u2, u3],
    });
    for (const id of [withMembers, empty, dm]) {
      await failsWith(
        sql`delete from conversations where id = ${id}`,
        CHECK,
        "conversations_no_delete_trg",
      );
      expect(await rowOf(id)).toBeTruthy();
    }
  });
});

describe("R23: one TRUNCATE empties every table", () => {
  it("empties the seven tables named, with no CASCADE", async () => {
    const t = await createThrowawayDb();
    try {
      await runMigrations(t.url, migrationsFolder);
      const db = postgres(t.url, { max: 1, onnotice: () => {} });
      try {
        const w = await insertWorkspace(db);
        const u = await insertUser(db, { workspace_id: w });
        const c = await insertConversation(db, {
          workspace_id: w,
          created_by: u,
        });
        await insertConversationMember(db, {
          conversation_id: c,
          user_id: u,
          workspace_id: w,
        });
        await insertLoginCode(db, { workspace_id: w, user_id: u });
        const session = await insertSession(db, {
          workspace_id: w,
          user_id: u,
        });
        await insertDevice(db, {
          workspace_id: w,
          user_id: u,
          session_id: session,
        });
        const tables = [
          "workspaces",
          "users",
          "login_codes",
          "sessions",
          "devices",
          "conversations",
          "conversation_members",
        ];
        for (const table of tables) {
          const [row] = await db.unsafe(
            `select count(*)::int as n from ${table}`,
          );
          expect(row!.n, `${table} has a row before`).toBeGreaterThan(0);
        }
        await db.unsafe(`truncate ${tables.join(", ")}`);
        for (const table of tables) {
          const [row] = await db.unsafe(
            `select count(*)::int as n from ${table}`,
          );
          expect(row!.n, table).toBe(0);
        }
      } finally {
        await db.end();
      }
    } finally {
      await t.drop();
    }
  });
});
