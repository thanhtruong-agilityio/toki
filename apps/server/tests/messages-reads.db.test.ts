import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb } from "./migrated-db.js";
import {
  insertConversation,
  insertMessage,
  insertUser,
  insertWorkspace,
} from "./test-rows.js";

// The two reads of a conversation (TOKI-036 R11, R12): the indexes serve them
// with no sort, and the pair (created_at, id) pages them in both directions.
// The `where` of the main list is written as the predicate of its partial index.

const MAIN = "conversation_id = $1 and (parent_id is null or also_in_channel)";
const THREAD = "parent_id = $1";
const NEWEST = "order by created_at desc, id desc limit";
const OLDEST = "order by created_at, id limit";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
let ws: string;
let author: string;
let conversation: string;
let thread: string;
let cursor: { createdAt: Date; id: string };
let threadCursor: { createdAt: Date; id: string };

beforeAll(async () => {
  t = await createMigratedDb();
  ws = await insertWorkspace(t.sql);
  author = await insertUser(t.sql, { workspace_id: ws });
  const conversations: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    conversations.push(
      await insertConversation(t.sql, {
        workspace_id: ws,
        created_by: author,
      }),
    );
  }
  conversation = conversations[0]!;
  // 18,000 roots over the 40 conversations, then 100 replies on each of 20.
  await t.sql`
    insert into messages (id, workspace_id, conversation_id, author_id, kind, body, created_at)
    select gen_random_uuid(), ${ws}, (${conversations}::uuid[])[1 + i % 40], ${author},
           'user', 'root', timestamptz '2026-01-01' + make_interval(secs => i)
    from generate_series(1, 18000) as i`;
  await t.sql`
    insert into messages (id, workspace_id, conversation_id, author_id, kind, body, parent_id, also_in_channel, created_at)
    select gen_random_uuid(), ${ws}, p.conversation_id, ${author}, 'user', 'reply', p.id,
           i % 10 = 0, p.created_at + make_interval(secs => i)
    from (select id, conversation_id, created_at from messages
          where parent_id is null order by created_at, id limit 20) as p
    cross join generate_series(1, 100) as i`;
  await t.sql`analyze messages`;
  const [middle] = await t.sql<{ created_at: Date; id: string }[]>`
    select created_at, id from messages
    where conversation_id = ${conversation} and parent_id is null
    order by created_at, id offset 200 limit 1`;
  cursor = { createdAt: middle!.created_at, id: middle!.id };
  const [root] = await t.sql<{ parent_id: string }[]>`
    select parent_id from messages where parent_id is not null limit 1`;
  thread = root!.parent_id;
  const [inThread] = await t.sql<{ created_at: Date; id: string }[]>`
    select created_at, id from messages where parent_id = ${thread}
    order by created_at, id offset 40 limit 1`;
  threadCursor = { createdAt: inThread!.created_at, id: inThread!.id };
}, 60_000);
afterAll(async () => {
  await t?.close();
});

type Node = {
  "Node Type": string;
  "Index Name"?: string;
  Plans?: Node[];
};
const nodesOf = (node: Node): Node[] => [
  node,
  ...(node.Plans ?? []).flatMap(nodesOf),
];

async function planOf(query: string, values: unknown[]): Promise<Node[]> {
  const rows = await t.sql.begin(async (tx) => {
    await tx`set local enable_seqscan = off`;
    await tx`set local enable_bitmapscan = off`;
    return tx.unsafe(`explain (format json) ${query}`, values as never[]);
  });
  const [row] = rows as unknown as { "QUERY PLAN": [{ Plan: Node }] }[];
  return nodesOf(row!["QUERY PLAN"][0].Plan);
}

describe("R11: the two indexes serve the reads", () => {
  const main = "messages_conversation_main_idx";
  const threadIndex = "messages_thread_idx";
  const select = "select * from messages where";
  const reads: [string, string, () => [string, unknown[]]][] = [
    [
      "the newest of the main list",
      main,
      () => [`${select} ${MAIN} ${NEWEST} 50`, [conversation]],
    ],
    [
      "the main list before a cursor",
      main,
      () => [
        `${select} ${MAIN} and (created_at, id) < ($2, $3) ${NEWEST} 50`,
        [conversation, cursor.createdAt, cursor.id],
      ],
    ],
    [
      "the main list after a cursor",
      main,
      () => [
        `${select} ${MAIN} and (created_at, id) > ($2, $3) ${OLDEST} 50`,
        [conversation, cursor.createdAt, cursor.id],
      ],
    ],
    [
      "the newest of a thread",
      threadIndex,
      () => [`${select} ${THREAD} ${NEWEST} 50`, [thread]],
    ],
    [
      "a thread before a cursor",
      threadIndex,
      () => [
        `${select} ${THREAD} and (created_at, id) < ($2, $3) ${NEWEST} 50`,
        [thread, threadCursor.createdAt, threadCursor.id],
      ],
    ],
    [
      "a thread after a cursor",
      threadIndex,
      () => [
        `${select} ${THREAD} and (created_at, id) > ($2, $3) ${OLDEST} 50`,
        [thread, threadCursor.createdAt, threadCursor.id],
      ],
    ],
  ];
  it.each(reads)(
    "R11: %s uses the index with no Sort",
    async (_name, indexName, read) => {
      const nodes = await planOf(...read());
      expect(nodes.map((n) => n["Index Name"])).toContain(indexName);
      expect(
        nodes.map((n) => n["Node Type"]).filter((type) => /Sort/.test(type)),
      ).toEqual([]);
    },
  );
});

type Row = { id: string; created_at: Date };

describe("R12: the order is the time and then the id", () => {
  it("R12: pages of 7 return every row once, both ways", async () => {
    const paged = await insertConversation(t.sql, {
      workspace_id: ws,
      created_by: author,
    });
    const times = [1, 2, 3].map((day) => new Date(Date.UTC(2026, 2, day)));
    const inserted: Row[] = [];
    for (let i = 0; i < 25; i += 1) {
      const created_at = times[(i * 7) % 3]!;
      const id = await insertMessage(t.sql, {
        workspace_id: ws,
        conversation_id: paged,
        author_id: author,
        created_at,
      });
      inserted.push({ id, created_at });
    }
    const walk = async (direction: "older" | "newer") => {
      const seen: string[] = [];
      let at: Row | undefined;
      for (;;) {
        const order = direction === "older" ? NEWEST : OLDEST;
        const compare = direction === "older" ? "<" : ">";
        const page = (await t.sql.unsafe(
          `select id, created_at from messages where ${MAIN}
           ${at ? `and (created_at, id) ${compare} ($2, $3)` : ""} ${order} 7`,
          (at ? [paged, at.created_at, at.id] : [paged]) as never[],
        )) as unknown as Row[];
        if (page.length === 0) return seen;
        seen.push(...page.map((r) => r.id));
        at = page.at(-1);
      }
    };
    const backward = await walk("older");
    const forward = await walk("newer");
    const expected = [...inserted]
      .sort(
        (a, b) =>
          a.created_at.getTime() - b.created_at.getTime() ||
          (a.id < b.id ? -1 : 1),
      )
      .map((r) => r.id);
    expect(forward).toEqual(expected);
    expect(backward).toEqual([...expected].reverse());
  });

  it("R12: an old id with a time of today comes at today", async () => {
    const paged = await insertConversation(t.sql, {
      workspace_id: ws,
      created_by: author,
    });
    const add = (values: Record<string, unknown>) =>
      insertMessage(t.sql, {
        workspace_id: ws,
        conversation_id: paged,
        author_id: author,
        ...values,
      });
    const first = await add({ created_at: new Date("2026-03-01T00:00:00Z") });
    // A UUIDv7 whose time part is 1 January 2001.
    const hex = Date.UTC(2001, 0, 1).toString(16).padStart(12, "0");
    const old = await add({
      id: `${hex.slice(0, 8)}-${hex.slice(8)}-7000-8000-000000000001`,
      created_at: new Date("2026-03-02T00:00:00Z"),
    });
    const rows = await t.sql.unsafe(
      `select id from messages where ${MAIN} ${OLDEST} 10`,
      [paged],
    );
    expect(rows.map((r) => r.id)).toEqual([first, old]);
  });
});
