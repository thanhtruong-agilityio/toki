import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb } from "../migrated-db.js";
import {
  insertConversation,
  insertConversationMember,
  insertDirectConversation,
  insertUser,
  insertWorkspace,
} from "../test-rows.js";
import { listConversationSummaries } from "../../src/modules/conversations/index.js";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
beforeAll(async () => {
  t = await createMigratedDb();
});
afterAll(async () => {
  await t?.close();
});

async function world() {
  const ws = await insertWorkspace(t.sql);
  const me = await insertUser(t.sql, { workspace_id: ws });
  const other = await insertUser(t.sql, { workspace_id: ws });
  const third = await insertUser(t.sql, { workspace_id: ws });
  const join = (conversation_id: string, user_id = me, extra = {}) =>
    insertConversationMember(t.sql, {
      conversation_id,
      user_id,
      workspace_id: ws,
      ...extra,
    });
  const channel = async (
    name: string,
    values: Record<string, unknown> = {},
    members: string[] = [me],
  ) => {
    const id = await insertConversation(t.sql, {
      workspace_id: ws,
      created_by: other,
      name,
      ...values,
    });
    for (const m of members) await join(id, m);
    return id;
  };
  return { ws, me, other, third, join, channel };
}

describe("listConversationSummaries (TOKI-031 R6, R7, R15)", () => {
  it("returns the conversations the person has a member row in and that are not archived", async () => {
    const w = await world();
    const joined = await w.channel("joined", { topic: "Plans" });
    const priv = await w.channel("priv", { is_private: true });
    const general = await w.channel("general", { is_general: true });
    const dm = await insertDirectConversation(t.sql, {
      workspace_id: w.ws,
      user_ids: [w.me, w.other],
    });
    const group = await insertDirectConversation(t.sql, {
      workspace_id: w.ws,
      user_ids: [w.me, w.other, w.third],
    });
    await w.channel("unjoined", {}, [w.other]);
    await w.channel("secret", { is_private: true }, [w.other]);
    await insertDirectConversation(t.sql, {
      workspace_id: w.ws,
      user_ids: [w.other, w.third],
    });
    await w.channel("archived", { archived_at: new Date("2026-02-01") });

    const rows = await listConversationSummaries(t.db, w.ws, w.me);
    expect(rows.map((r) => r.id).sort()).toEqual(
      [joined, priv, general, dm, group].sort(),
    );
  });

  it("omits a conversation after the member row is deleted and after it is archived", async () => {
    const w = await world();
    const a = await w.channel("aaa");
    const b = await w.channel("bbb");
    const c = await w.channel("ccc");
    expect(
      (await listConversationSummaries(t.db, w.ws, w.me)).map((r) => r.id),
    ).toHaveLength(3);
    await t.sql`delete from conversation_members where conversation_id = ${a}`;
    await t.sql`update conversations set archived_at = ${new Date("2026-03-01")} where id = ${b}`;
    const rows = await listConversationSummaries(t.db, w.ws, w.me);
    expect(rows.map((r) => r.id)).toEqual([c]);
  });

  it("returns an empty list for a person with no conversation", async () => {
    const w = await world();
    expect(await listConversationSummaries(t.db, w.ws, w.me)).toEqual([]);
  });

  it("does not return a conversation or a member row of another workspace", async () => {
    const w = await world();
    const mine = await w.channel("mine");
    const w2 = await world();
    await w2.channel("theirs");
    // The same person id asked for in the other workspace sees nothing of it.
    expect(
      (await listConversationSummaries(t.db, w2.ws, w.me)).map((r) => r.id),
    ).toEqual([]);
    expect(
      (await listConversationSummaries(t.db, w.ws, w.me)).map((r) => r.id),
    ).toEqual([mine]);
  });

  it("returns a channel with its flags, topic, own stored level, mute and star, and null memberIds", async () => {
    const w = await world();
    const id = await w.channel(
      "rooms",
      { topic: "Plans", is_private: true },
      [],
    );
    await w.join(id, w.me, {
      notification_level: "none",
      is_muted: true,
      is_starred: true,
    });
    await w.join(id, w.other, { is_starred: false });
    const [row] = await listConversationSummaries(t.db, w.ws, w.me);
    expect(row).toEqual({
      id,
      kind: "channel",
      name: "rooms",
      topic: "Plans",
      isPrivate: true,
      isGeneral: false,
      notificationLevel: "none",
      isMuted: true,
      isStarred: true,
      memberIds: null,
    });
  });

  it("returns the stored level as null when none is stored, not the default", async () => {
    const w = await world();
    await w.channel("plain");
    const [row] = await listConversationSummaries(t.db, w.ws, w.me);
    expect(row!.notificationLevel).toBeNull();
    expect(row!.isMuted).toBe(false);
    expect(row!.isStarred).toBe(false);
  });

  it("returns for a dm and a group the ids of the key in key order, a group of 8 with 8", async () => {
    const w = await world();
    const ids = [w.me];
    for (let i = 0; i < 7; i++) {
      ids.push(await insertUser(t.sql, { workspace_id: w.ws }));
    }
    const group = await insertDirectConversation(t.sql, {
      workspace_id: w.ws,
      user_ids: ids,
    });
    const dm = await insertDirectConversation(t.sql, {
      workspace_id: w.ws,
      user_ids: [w.me, w.other],
    });
    const rows = await listConversationSummaries(t.db, w.ws, w.me);
    const g = rows.find((r) => r.id === group)!;
    expect(g.kind).toBe("group_dm");
    expect(g.memberIds).toEqual([...ids].sort());
    expect(g.memberIds).toHaveLength(8);
    const d = rows.find((r) => r.id === dm)!;
    expect(d).toMatchObject({
      kind: "dm",
      name: null,
      topic: null,
      isPrivate: true,
      isGeneral: false,
      memberIds: [w.me, w.other].sort(),
    });
  });

  it("orders by id in byte order", async () => {
    const w = await world();
    // Lower-case hex ids sort the same in every collation (digits before
    // letters, the hyphens at fixed places), so the spec's "pair that differs
    // from the default collation" cannot exist for a uuid; the order is still
    // written as byte order in the statement and this test pins the result.
    const ids = [
      "a0000000-0000-4000-8000-000000000003",
      "0a000000-0000-4000-8000-000000000001",
      "00a00000-0000-4000-8000-000000000004",
      "9f000000-0000-4000-8000-000000000002",
    ];
    for (const [i, id] of ids.entries()) {
      await insertConversation(t.sql, {
        workspace_id: w.ws,
        created_by: w.other,
        id,
        name: `c-${i}`,
      });
      await w.join(id);
    }
    const rows = await listConversationSummaries(t.db, w.ws, w.me);
    expect(rows.map((r) => r.id)).toEqual([...ids].sort());
  });

  it("is one statement and works in a read-only repeatable-read transaction", async () => {
    const w = await world();
    const id = await w.channel("one");
    const rows = await t.db.transaction(
      (tx) => listConversationSummaries(tx, w.ws, w.me),
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
    expect(rows.map((r) => r.id)).toEqual([id]);
  });
});
