import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  insertConversation,
  insertConversationMember,
  insertDirectConversation,
  insertUser,
  insertWorkspace,
} from "../../db/test-rows.js";
import { createMigratedDb } from "../../test/migrated-db.js";
import {
  getConversationFacts,
  isConversationMember,
  listMemberIds,
} from "./index.js";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
let ws: string;
let me: string;
let other: string;
let third: string;

beforeAll(async () => {
  t = await createMigratedDb();
  ws = await insertWorkspace(t.sql);
  me = await insertUser(t.sql, { workspace_id: ws });
  other = await insertUser(t.sql, { workspace_id: ws });
  third = await insertUser(t.sql, { workspace_id: ws });
});
afterAll(async () => {
  await t?.close();
});

const channel = (over: Record<string, unknown> = {}) =>
  insertConversation(t.sql, { workspace_id: ws, created_by: me, ...over });
const join = (conversation_id: string, user_id: string) =>
  insertConversationMember(t.sql, {
    conversation_id,
    user_id,
    workspace_id: ws,
  });

describe("getConversationFacts (R18)", () => {
  const cases: [string, () => Promise<string>, object][] = [
    [
      "a public channel",
      () => channel(),
      { kind: "public_channel", isGeneral: false, archived: false },
    ],
    [
      "a private channel",
      () => channel({ is_private: true }),
      { kind: "private_channel", isGeneral: false, archived: false },
    ],
    [
      "an archived channel",
      () => channel({ archived_at: new Date("2026-02-01T00:00:00Z") }),
      { kind: "public_channel", isGeneral: false, archived: true },
    ],
    [
      "a DM",
      () =>
        insertDirectConversation(t.sql, {
          workspace_id: ws,
          user_ids: [me, other],
        }),
      { kind: "dm", isGeneral: false, archived: false },
    ],
    [
      "a group",
      () =>
        insertDirectConversation(t.sql, {
          workspace_id: ws,
          user_ids: [me, other, third],
        }),
      { kind: "group_dm", isGeneral: false, archived: false },
    ],
  ];
  it.each(cases)(
    "maps %s, for a member and for a non-member",
    async (_l, make, expected) => {
      const id = await make();
      // A DM or group has its members from the start; for a channel, join `me`.
      const memberAlready = (await listMemberIds(t.db, id)).includes(me);
      if (!memberAlready) await join(id, me);
      expect(await getConversationFacts(t.db, me, id)).toEqual({
        ...expected,
        isMember: true,
      });
      const outsider = await insertUser(t.sql, { workspace_id: ws });
      expect(await getConversationFacts(t.db, outsider, id)).toEqual({
        ...expected,
        isMember: false,
      });
    },
  );

  it("maps #general", async () => {
    const w = await insertWorkspace(t.sql);
    const u = await insertUser(t.sql, { workspace_id: w });
    const g = await insertConversation(t.sql, {
      workspace_id: w,
      created_by: u,
      name: "general",
      is_general: true,
    });
    expect(await getConversationFacts(t.db, u, g)).toEqual({
      kind: "public_channel",
      isGeneral: true,
      archived: false,
      isMember: false,
    });
  });

  it("returns null for an id that does not exist", async () => {
    expect(
      await getConversationFacts(t.db, me, crypto.randomUUID()),
    ).toBeNull();
  });
});

describe("isConversationMember and listMemberIds (R18)", () => {
  it("is true for a member and false for a person who is not", async () => {
    const c = await channel();
    await join(c, me);
    expect(await isConversationMember(t.db, me, c)).toBe(true);
    expect(await isConversationMember(t.db, other, c)).toBe(false);
  });
  it("lists every member id ordered, and nothing for a channel with none", async () => {
    const c = await channel();
    await join(c, other);
    await join(c, me);
    expect(await listMemberIds(t.db, c)).toEqual([me, other].sort());
    expect(await listMemberIds(t.db, await channel())).toEqual([]);
  });
});
