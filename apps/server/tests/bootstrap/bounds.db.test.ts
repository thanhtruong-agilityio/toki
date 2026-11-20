import { CHANNEL_NAME_MAX, CHANNEL_TOPIC_MAX } from "@toki/shared";
import { afterAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import { person, send } from "../conversations/channel-helpers.js";

const URL_PATH = "/api/v1/bootstrap";
const harnesses: Harness[] = [];
afterAll(async () => {
  await Promise.all(harnesses.map((h) => h.close()));
});

async function insertRows(
  h: Harness,
  table: string,
  rows: Record<string, unknown>[],
) {
  for (let i = 0; i < rows.length; i += 500) {
    await h.sql`insert into ${h.sql(table)} ${h.sql(rows.slice(i, i + 500) as never)}`;
  }
}

// One reader in a workspace of `people` people with `channels` channels,
// `dms` direct messages and `groups` groups of three, all with the reader.
async function fill(options: {
  people: number;
  channels: number;
  dms: number;
  groups: number;
  nameLength: number;
  topicLength: number;
  personNameLength: number;
}) {
  const h = await createHarness();
  harnesses.push(h);
  const reader = await person(h, "reader", "admin", {
    display_name: "R".repeat(options.personNameLength),
  });
  const at = new Date("2026-01-01T00:00:00Z");
  const others: string[] = [];
  const users: Record<string, unknown>[] = [];
  for (let i = 0; i < options.people - 1; i++) {
    const id = crypto.randomUUID();
    others.push(id);
    users.push({
      id,
      workspace_id: h.workspaceId,
      email: `p${i}@example.com`,
      display_name: `P${i}`.padEnd(options.personNameLength, "x"),
      role: "member",
      status: "active",
      language: "en",
      created_at: at,
    });
  }
  await insertRows(h, "users", users);

  const conversations: Record<string, unknown>[] = [];
  const members: Record<string, unknown>[] = [];
  const add = (row: Record<string, unknown>) => {
    const id = crypto.randomUUID();
    conversations.push({
      id,
      workspace_id: h.workspaceId,
      kind: "channel",
      name: null,
      topic: null,
      description: null,
      is_private: false,
      is_general: false,
      dm_key: null,
      created_by: reader.id,
      created_at: at,
      archived_at: null,
      ...row,
    });
    return id;
  };
  const join = (conversation_id: string, user_id: string) =>
    members.push({
      conversation_id,
      user_id,
      workspace_id: h.workspaceId,
      notification_level: null,
      is_muted: false,
      is_starred: false,
      created_at: at,
    });
  for (let i = 0; i < options.channels; i++) {
    const id = add({
      name: `c${i}`.padEnd(options.nameLength, "x"),
      topic: "t".repeat(options.topicLength),
    });
    join(id, reader.id);
  }
  const direct = (ids: string[]) => {
    const sorted = [...ids].sort();
    const id = add({
      kind: ids.length === 2 ? "dm" : "group_dm",
      is_private: true,
      dm_key: sorted.join(","),
    });
    for (const user of ids) join(id, user);
  };
  for (let i = 0; i < options.dms; i++) direct([reader.id, others[i]!]);
  for (let i = 0; i < options.groups; i++) {
    direct([
      reader.id,
      others[(options.dms + i * 2) % others.length]!,
      others[(options.dms + i * 2 + 1) % others.length]!,
    ]);
  }
  // A direct message needs its member rows in the same transaction.
  await h.sql.begin(async (tx) => {
    for (const [table, rows] of [
      ["conversations", conversations],
      ["conversation_members", members],
    ] as const) {
      for (let i = 0; i < rows.length; i += 500) {
        await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + 500) as never)}`;
      }
    }
  });
  return { h, reader };
}

const ordinary = {
  people: 200,
  channels: 300,
  dms: 150,
  groups: 50,
  nameLength: 20,
  topicLength: 60,
  personNameLength: 30,
};

describe("everything comes, and not much of it (R9, R20)", () => {
  it("returns all 500 conversations and no cursor, under 250,000 bytes at the stated lengths", async () => {
    const { h, reader } = await fill(ordinary);
    const res = await send(h, reader, "GET", URL_PATH);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.conversations).toHaveLength(500);
    expect(body.members).toHaveLength(200);
    expect(Object.keys(body).sort()).toEqual([
      "conversations",
      "eventNumber",
      "members",
      "user",
      "workspace",
    ]);
    expect(res.body).not.toMatch(/nextCursor|cursor/);
    const bytes = Buffer.byteLength(res.body, "utf8");
    expect(bytes).toBeGreaterThan(100_000); // the fixture is really that big
    expect(bytes).toBeLessThan(250_000);
  });

  it("stays under 400,000 bytes with every text at its limit", async () => {
    const { h, reader } = await fill({
      ...ordinary,
      nameLength: CHANNEL_NAME_MAX,
      topicLength: CHANNEL_TOPIC_MAX,
      personNameLength: 80,
    });
    const res = await send(h, reader, "GET", URL_PATH);
    expect(res.statusCode).toBe(200);
    const bytes = Buffer.byteLength(res.body, "utf8");
    expect(bytes).toBeGreaterThan(250_000); // over the first bound, by design
    expect(bytes).toBeLessThan(400_000);
  });
});

describe("the number of statements does not grow with the answer (R14)", () => {
  async function count(h: Harness, reader: { headers: { cookie: string } }) {
    const before = h.statementLog.length;
    const res = await h.call({
      method: "GET",
      url: URL_PATH,
      headers: reader.headers,
    });
    expect(res.statusCode).toBe(200);
    const all = h.statementLog.slice(before);
    const begin = all.findIndex((s) => /^begin isolation level/i.test(s.query));
    expect(begin).toBeGreaterThanOrEqual(0);
    const connection = all[begin]!.connection;
    const mine = all.slice(begin).filter((s) => s.connection === connection);
    const end = mine.findIndex((s) => /^commit$/i.test(s.query));
    expect(end).toBeGreaterThan(0);
    return {
      transaction: mine.slice(0, end + 1).map((s) => s.query),
      total: all.length,
    };
  }

  it("counts 7 or fewer on the transaction, equal for 3 and for 500 conversations, and equal totals", async () => {
    const small = await fill({
      ...ordinary,
      people: 3,
      channels: 1,
      dms: 1,
      groups: 0,
    });
    const big = await fill(ordinary);
    const a = await count(small.h, small.reader);
    const b = await count(big.h, big.reader);
    expect(a.transaction.length).toBeLessThanOrEqual(7);
    expect(a.transaction.length).toBe(b.transaction.length);
    expect(a.total).toBe(b.total);
    // What the seven are: begin, account, accounts by ids, workspace, people,
    // conversations, commit. The event number reads nothing yet.
    expect(a.transaction[0]!.toLowerCase()).toBe(
      "begin isolation level repeatable read read only",
    );
    expect(a.transaction.at(-1)!.toLowerCase()).toBe("commit");
    expect(a.transaction).toHaveLength(7);
    // The five reads in between, by what each selects.
    const reads = a.transaction.slice(1, -1).map((q) => q.toLowerCase());
    expect(reads[0]).toMatch(/from "users"/); // the account
    expect(reads[0]).toMatch(/"email"/);
    expect(reads[1]).toMatch(/from "users"/); // the facts by ids
    expect(reads[1]).not.toMatch(/"email"/);
    expect(reads[2]).toMatch(/from "workspaces"/);
    expect(reads[3]).toMatch(/from "users"/); // the people
    expect(reads[3]).toMatch(/collate "c"/);
    expect(reads[4]).toMatch(/from "conversations"/);
    expect(reads[4]).toMatch(/inner join "conversation_members"/);
  });
});
