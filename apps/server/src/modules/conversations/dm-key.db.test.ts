import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  insertConversation,
  insertConversationMember,
  insertUser,
  insertWorkspace,
} from "../../tests/test-rows.js";
import { createMigratedDb } from "../../tests/migrated-db.js";
import { buildDmKey } from "./index.js";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
let ws: string;
let people: string[];

beforeAll(async () => {
  t = await createMigratedDb();
  ws = await insertWorkspace(t.sql);
  people = [];
  for (let i = 0; i < 12; i += 1)
    people.push(await insertUser(t.sql, { workspace_id: ws }));
});
afterAll(async () => {
  await t?.close();
});

// The conversation and all its member rows in one transaction (R21).
async function insertBuilt(ids: string[]) {
  const { kind, key } = buildDmKey(ids);
  return t.sql.begin(async (tx) => {
    const db = tx as unknown as typeof t.sql;
    const id = await insertConversation(db, {
      workspace_id: ws,
      created_by: ids[0]!,
      kind,
      name: null,
      is_private: true,
      dm_key: key,
    });
    for (const user_id of ids) {
      await insertConversationMember(db, {
        conversation_id: id,
        user_id,
        workspace_id: ws,
      });
    }
    return id;
  });
}

describe("buildDmKey against the database (R11)", () => {
  it("inserts the DM of [a, b], and [b, a] fails with the unique key", async () => {
    const [a, b] = [people[0]!, people[1]!];
    await insertBuilt([a, b]);
    await expect(insertBuilt([b, a])).rejects.toMatchObject({
      code: "23505",
      constraint_name: "conversations_workspace_id_dm_key_key",
    });
  });

  it("200 random sets of 2 to 8 people: the sort in the function and in the database agree", async () => {
    let seed = 0x9e3779b9;
    const next = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    const seen = new Set<string>([buildDmKey([people[0]!, people[1]!]).key]);
    let inserted = 0;
    while (inserted < 200) {
      const size = 2 + Math.floor(next() * 7);
      const pool = [...people];
      const pick: string[] = [];
      while (pick.length < size)
        pick.push(pool.splice(Math.floor(next() * pool.length), 1)[0]!);
      const { key } = buildDmKey(pick);
      if (seen.has(key)) continue;
      seen.add(key);
      await insertBuilt(pick);
      inserted += 1;
    }
    const [row] = await t.sql<
      { n: number }[]
    >`select count(*)::int as n from conversations where kind <> 'channel'`;
    expect(row!.n).toBe(201);
  });
});
