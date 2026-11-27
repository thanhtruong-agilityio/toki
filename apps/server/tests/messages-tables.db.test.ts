import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MESSAGE_KINDS, MESSAGE_TEXT_MAX } from "@toki/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrationsFolder } from "../src/db/migrate.js";
import { messages } from "../src/modules/messages/schema.js";
import { createMigratedDb } from "./migrated-db.js";
import {
  insertConversation,
  insertMessage,
  insertUser,
  insertWorkspace,
} from "./test-rows.js";

// The table `messages` (TOKI-036 R1 to R10, R22, R23). The constraint tests
// send SQL text, so they prove what the database enforces whatever the Drizzle
// definitions say. Every "must fail" case asserts the constraint or trigger
// name in the Postgres error, and every refused row is otherwise valid.

type PgError = Error & {
  code?: string;
  constraint_name?: string;
  column_name?: string;
};

const CHECK = "23514";
const UNIQUE = "23505";
const FK = "23503";
const NOT_NULL = "23502";

const LATER = new Date("2026-01-02T00:00:00.000Z");
const NOWHERE = "0190a000-0000-7000-8000-000000000099";

// The columns that later tickets add (TOKI-045 and TOKI-069). A ticket that
// adds a column to `messages` adds its name here in its own change.
const LATER_COLUMNS = [
  "reply_count",
  "last_reply_at",
  "reply_user_ids",
  "summary_version",
  "search_vector",
];

let t: Awaited<ReturnType<typeof createMigratedDb>>;
let ws: string;
let author: string;
let other: string;
let conversation: string;
let elsewhere: string;
let rowsAfterMigrations = -1;

beforeAll(async () => {
  t = await createMigratedDb();
  const [count] = await t.sql<
    { n: number }[]
  >`select count(*)::int as n from messages`;
  rowsAfterMigrations = count!.n;
  ws = await insertWorkspace(t.sql);
  author = await insertUser(t.sql, { workspace_id: ws });
  other = await insertUser(t.sql, { workspace_id: ws });
  conversation = await insertConversation(t.sql, {
    workspace_id: ws,
    created_by: author,
  });
  elsewhere = await insertConversation(t.sql, {
    workspace_id: ws,
    created_by: author,
  });
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

const message = (over: Record<string, unknown> = {}) =>
  insertMessage(t.sql, {
    workspace_id: ws,
    conversation_id: conversation,
    author_id: author,
    ...over,
  });
const reply = async (over: Record<string, unknown> = {}) =>
  message({ parent_id: await message(), ...over });
const SYSTEM = {
  kind: "system",
  system_type: "member_joined",
  system_user_ids: "{}",
  body: "",
};
const systemLine = (over: Record<string, unknown> = {}) =>
  message({ ...SYSTEM, ...over });
const rowOf = async (id: string) =>
  (await t.sql`select * from messages where id = ${id}`)[0]!;

describe("R1: the table exists and is empty", () => {
  it("R1: has the fourteen columns and no column outside the allow-list", async () => {
    const columns = await t.sql<
      { name: string; type: string; required: boolean; def: string | null }[]
    >`
      select a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
             a.attnotnull as required, pg_get_expr(d.adbin, d.adrelid) as def
      from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = 'messages'::regclass and a.attnum > 0 and not a.attisdropped
      order by a.attnum`;
    const described = new Map(
      columns.map((c) => [
        c.name,
        `${c.type}${c.required ? " not null" : ""}${c.def ? ` default ${c.def}` : ""}`,
      ]),
    );
    const expected: Record<string, string> = {
      id: "uuid not null",
      workspace_id: "uuid not null",
      conversation_id: "uuid not null",
      author_id: "uuid not null",
      kind: "text not null",
      system_type: "text",
      system_user_ids: "uuid[]",
      body: "text not null",
      parent_id: "uuid",
      also_in_channel: "boolean not null default false",
      edited_at: "timestamp with time zone",
      deleted_at: "timestamp with time zone",
      deleted_by: "uuid",
      created_at: "timestamp with time zone not null",
    };
    for (const [name, wanted] of Object.entries(expected)) {
      expect(described.get(name), name).toBe(wanted);
    }
    const rest = [...described.keys()].filter((name) => !(name in expected));
    expect(rest.filter((name) => !LATER_COLUMNS.includes(name))).toEqual([]);
    expect(rowsAfterMigrations).toBe(0);
  });
});

describe("R2: the id", () => {
  it("R2: makes a UUIDv7, keeps a given id, refuses a repeat", async () => {
    // The default is the database client's (the column has none).
    const [made] = await t.db
      .insert(messages)
      .values({
        workspaceId: ws,
        conversationId: conversation,
        authorId: author,
        kind: "user",
        body: "made",
        createdAt: LATER,
      })
      .returning({ id: messages.id });
    expect(made!.id[14]).toBe("7");
    const [read] = await t.db
      .select({ body: messages.body })
      .from(messages)
      .where(eq(messages.id, made!.id));
    expect(read!.body).toBe("made");

    // A version 4 id is taken as given.
    const given = crypto.randomUUID();
    expect(await message({ id: given, body: "first" })).toBe(given);
    await failsWith(
      message({ id: given, body: "second" }),
      UNIQUE,
      "messages_pkey",
    );
    await t.sql`
      insert into messages (id, workspace_id, conversation_id, author_id, kind, body, created_at)
      values (${given}, ${ws}, ${conversation}, ${author}, 'user', 'third', ${LATER})
      on conflict (id) do nothing`;
    const rows = await t.sql`select body from messages where id = ${given}`;
    expect(rows.map((r) => r.body)).toEqual(["first"]);
  });
});

describe("R3: the two kinds and their shapes", () => {
  it("R3: accepts a user message and a system line", async () => {
    await message();
    await systemLine();
    await systemLine({
      system_type: "members_added",
      system_user_ids: `{${author},${other}}`,
    });
    await systemLine({ system_type: `a${"b".repeat(63)}` });
  });

  const refused: [string, Record<string, unknown>, string][] = [
    [
      "a user message with a system_type",
      { system_type: "member_joined" },
      "messages_user_shape_check",
    ],
    [
      "a user message with system_user_ids",
      { system_user_ids: "{}" },
      "messages_user_shape_check",
    ],
    [
      "a system line with no type",
      { ...SYSTEM, system_type: null },
      "messages_system_shape_check",
    ],
    [
      "a system line with the type Joined",
      { ...SYSTEM, system_type: "Joined" },
      "messages_system_shape_check",
    ],
    [
      "a system line with a type of 65 characters",
      { ...SYSTEM, system_type: `a${"b".repeat(64)}` },
      "messages_system_shape_check",
    ],
    [
      "a system line with no system_user_ids",
      { ...SYSTEM, system_user_ids: null },
      "messages_system_shape_check",
    ],
    [
      "a system line with a body",
      { ...SYSTEM, body: "hi" },
      "messages_system_shape_check",
    ],
    [
      "a system line with an edited_at",
      { ...SYSTEM, edited_at: LATER },
      "messages_system_shape_check",
    ],
    ["a kind other", { kind: "other" }, "messages_kind_check"],
  ];
  it.each(refused)("R3: refuses %s", async (_name, values, constraint) => {
    await failsWith(message(values), CHECK, constraint);
  });

  it("R3: refuses a system line with a parent", async () => {
    const root = await message();
    await failsWith(
      systemLine({ parent_id: root }),
      CHECK,
      "messages_system_shape_check",
    );
  });

  it("R3: refuses a system line that is deleted", async () => {
    // deleted_by is set too, so messages_deleted_check passes.
    await failsWith(
      systemLine({ deleted_at: LATER, deleted_by: author }),
      CHECK,
      "messages_system_shape_check",
    );
  });

  it("R3: refuses a system line sent also to the channel", async () => {
    // Postgres evaluates checks in name order, so this one answers first.
    await failsWith(
      systemLine({ also_in_channel: true }),
      CHECK,
      "messages_also_in_channel_check",
    );
  });
});

describe("R4: the body", () => {
  it.each([
    ["letters", "a"],
    ["emoji outside the Basic Multilingual Plane", "😀"],
  ])("R4: counts 10,000 code points of %s", async (_name, char) => {
    await message({ body: char.repeat(MESSAGE_TEXT_MAX) });
    await failsWith(
      message({ body: char.repeat(MESSAGE_TEXT_MAX + 1) }),
      CHECK,
      "messages_body_check",
    );
  });

  it("R4: accepts the empty string and refuses no body", async () => {
    await message({ body: "" });
    const error = await failsWith(message({ body: null }), NOT_NULL);
    expect(error.column_name).toBe("body");
  });
});

describe("R5: one level, one conversation", () => {
  it("R5: accepts a root and a reply, also sent to the channel or not", async () => {
    await reply();
    await reply({ also_in_channel: true });
  });

  it("R5: refuses a reply to a reply and a reply to a system line", async () => {
    await failsWith(
      message({ parent_id: await reply() }),
      CHECK,
      "messages_thread_depth_trg",
    );
    await failsWith(
      message({ parent_id: await systemLine() }),
      CHECK,
      "messages_thread_depth_trg",
    );
  });

  it("R5: refuses a parent that does not exist, and a row that is its own parent", async () => {
    await failsWith(
      message({ parent_id: NOWHERE }),
      CHECK,
      "messages_thread_depth_trg",
    );
    const id = crypto.randomUUID();
    await failsWith(
      message({ id, parent_id: id }),
      CHECK,
      "messages_thread_depth_trg",
    );
  });

  it("R5: refuses a parent of another conversation", async () => {
    const root = await message({ conversation_id: elsewhere });
    await failsWith(
      message({ parent_id: root }),
      FK,
      "messages_parent_id_fkey",
    );
  });

  it("R5: refuses also_in_channel on a root", async () => {
    await failsWith(
      message({ also_in_channel: true }),
      CHECK,
      "messages_also_in_channel_check",
    );
  });
});

describe("R6: the lifecycle columns", () => {
  it("R6: deleted_at and deleted_by go together", async () => {
    await failsWith(
      message({ deleted_at: LATER }),
      CHECK,
      "messages_deleted_check",
    );
    await failsWith(
      message({ deleted_by: author }),
      CHECK,
      "messages_deleted_check",
    );
    await message({ deleted_at: LATER, deleted_by: author });
    await message({ deleted_at: LATER, deleted_by: other });
  });

  it("R6: an edit and then a soft delete keep the row and its replies", async () => {
    const root = await message();
    const answer = await message({ parent_id: root });
    await t.sql`update messages set edited_at = ${LATER} where id = ${root}`;
    await t.sql`update messages set deleted_at = ${LATER}, deleted_by = ${other} where id = ${root}`;
    expect(await rowOf(root)).toMatchObject({
      edited_at: LATER,
      deleted_at: LATER,
      deleted_by: other,
      body: "Test message",
    });
    expect(await rowOf(answer)).toMatchObject({ parent_id: root });
  });

  it("R6: refuses a deleted_by that is no user", async () => {
    await failsWith(
      message({ deleted_at: LATER, deleted_by: NOWHERE }),
      FK,
      "messages_deleted_by_fkey",
    );
  });
});

describe("R7: the columns that fix a message never change", () => {
  const changes: [string, "reply" | "line", () => Promise<string>][] = [
    ["workspace_id", "reply", () => insertWorkspace(t.sql)],
    ["conversation_id", "reply", async () => elsewhere],
    ["author_id", "reply", async () => other],
    ["kind", "reply", async () => "system"],
    ["system_type", "line", async () => "member_left"],
    ["system_user_ids", "line", async () => `{${other}}`],
    ["parent_id", "reply", () => message()],
    ["created_at", "reply", async () => LATER.toISOString()],
  ];
  it.each(changes)(
    "R7: refuses a change of %s",
    async (column, subject, different) => {
      const id = await (subject === "line" ? systemLine() : reply());
      const before = await rowOf(id);
      await failsWith(
        t.sql`update messages set ${t.sql(column)} = ${await different()} where id = ${id}`,
        CHECK,
        "messages_immutable_trg",
      );
      expect(await rowOf(id)).toEqual(before);
      // The value it has is no change.
      await t.sql`update messages set ${t.sql(column)} = ${t.sql(column)} where id = ${id}`;
    },
  );

  it("R7: accepts a change of the five editable columns", async () => {
    const id = await reply();
    await t.sql`
      update messages set body = 'edited', also_in_channel = true,
        edited_at = ${LATER}, deleted_at = ${LATER}, deleted_by = ${author}
      where id = ${id}`;
    expect(await rowOf(id)).toMatchObject({
      body: "edited",
      also_in_channel: true,
    });
  });
});

describe("R8: a message is never removed", () => {
  it("R8: refuses every delete", async () => {
    const ids = [await message(), await systemLine(), await reply()];
    for (const id of ids) {
      await failsWith(
        t.sql`delete from messages where id = ${id}`,
        CHECK,
        "messages_no_delete_trg",
      );
      expect(await rowOf(id)).toBeTruthy();
    }
  });
});

describe("R9: the keys", () => {
  it("R9: every key is enforced and restricts", async () => {
    const unknown = await insertWorkspace(t.sql);
    await failsWith(
      message({ workspace_id: NOWHERE }),
      FK,
      "messages_workspace_id_fkey",
    );
    await failsWith(
      message({ conversation_id: NOWHERE }),
      FK,
      "messages_conversation_id_fkey",
    );
    // A workspace that exists and is not the one of the conversation.
    await failsWith(
      message({ workspace_id: unknown }),
      FK,
      "messages_conversation_id_fkey",
    );
    await failsWith(
      message({ author_id: NOWHERE }),
      FK,
      "messages_author_id_fkey",
    );

    const keys = await t.sql<{ conname: string; confdeltype: string }[]>`
      select conname, confdeltype from pg_constraint
      where contype = 'f' and conrelid in
        ('messages'::regclass, 'events'::regclass, 'event_counters'::regclass)
      order by conname`;
    expect(keys.map((k) => k.conname)).toEqual([
      "event_counters_workspace_id_fkey",
      "events_conversation_id_fkey",
      "events_user_id_fkey",
      "events_workspace_id_fkey",
      "messages_author_id_fkey",
      "messages_conversation_id_fkey",
      "messages_deleted_by_fkey",
      "messages_parent_id_fkey",
      "messages_workspace_id_fkey",
    ]);
    expect(keys.filter((k) => k.confdeltype !== "r")).toEqual([]);
  });
});

describe("R10: the times", () => {
  it("R10: three timestamptz columns with no default", async () => {
    const columns = await t.sql<
      {
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }[]
    >`
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = 'messages'
        and (data_type like 'timestamp%' or column_name = 'updated_at')
      order by column_name`;
    expect(
      columns.map(
        (c) =>
          `${c.column_name}:${c.data_type}:${c.is_nullable}:${c.column_default}`,
      ),
    ).toEqual([
      "created_at:timestamp with time zone:NO:null",
      "deleted_at:timestamp with time zone:YES:null",
      "edited_at:timestamp with time zone:YES:null",
    ]);
    const error = await failsWith(
      t.sql`
        insert into messages (id, workspace_id, conversation_id, author_id, kind, body)
        values (${crypto.randomUUID()}, ${ws}, ${conversation}, ${author}, 'user', 'x')`,
      NOT_NULL,
    );
    expect(error.column_name).toBe("created_at");
  });
});

describe("R22: the checks hold the shared values", () => {
  const definition = async (name: string) =>
    (
      await t.sql<{ def: string }[]>`
        select pg_get_constraintdef(oid) as def from pg_constraint where conname = ${name}`
    )[0]!.def;

  it("R22: the body check holds the limit", async () => {
    expect(await definition("messages_body_check")).toContain(
      `<= ${MESSAGE_TEXT_MAX}`,
    );
  });

  it("R22: the kind check holds the kinds", async () => {
    // Postgres rewrites `in (...)` as `= ANY (ARRAY[...])`.
    const quoted = [
      ...(await definition("messages_kind_check")).matchAll(/'([a-z_]+)'/g),
    ].map((m) => m[1]);
    expect(quoted).toEqual([...MESSAGE_KINDS]);
  });
});

describe("R23: one migration", () => {
  it("R23: three CREATE TABLE statements and none for another table", () => {
    const files = readdirSync(migrationsFolder).filter((f) =>
      f.endsWith("_messages_events_tables.sql"),
    );
    expect(files).toHaveLength(1);
    const text = readFileSync(join(migrationsFolder, files[0]!), "utf8");
    const created = [...text.matchAll(/CREATE TABLE "([a-z_]+)"/gi)].map(
      (m) => m[1],
    );
    expect(created.sort()).toEqual(["event_counters", "events", "messages"]);
    expect(text.match(/create\s+table/gi)).toHaveLength(3);
  });
});
