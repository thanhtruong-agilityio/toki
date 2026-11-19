import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertUser, insertWorkspace } from "../../tests/test-rows.js";
import { createMigratedDb } from "../../tests/migrated-db.js";
import {
  addMemberToGeneral,
  createGeneralChannel,
  getConversationFacts,
  isConversationMember,
} from "./index.js";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
beforeAll(async () => {
  t = await createMigratedDb();
});
afterAll(async () => {
  await t?.close();
});

const NOW = new Date("2026-03-01T10:00:00.000Z");
const LATER = new Date("2026-03-02T10:00:00.000Z");

async function workspaceWithAdmin() {
  const workspaceId = await insertWorkspace(t.sql);
  const adminId = await insertUser(t.sql, { workspace_id: workspaceId });
  return { workspaceId, adminId };
}
const count = async (table: string, where = "true") =>
  (
    await t.sql.unsafe<{ n: number }[]>(
      `select count(*)::int as n from ${table} where ${where}`,
    )
  )[0]!.n;

describe("createGeneralChannel (R25)", () => {
  it("writes the #general row and the creator's member row, column by column", async () => {
    const { workspaceId, adminId } = await workspaceWithAdmin();
    const id = await createGeneralChannel(t.db, {
      workspaceId,
      createdBy: adminId,
      createdAt: NOW,
    });
    expect(id[14]).toBe("7"); // the 13th hex digit, with the 4 hyphens (R2)
    const [c] = await t.sql`select * from conversations where id = ${id}`;
    expect(c).toMatchObject({
      workspace_id: workspaceId,
      kind: "channel",
      name: "general",
      topic: null,
      description: null,
      is_private: false,
      is_general: true,
      dm_key: null,
      created_by: adminId,
      archived_at: null,
    });
    expect(c!.created_at).toEqual(NOW);
    const [m] =
      await t.sql`select * from conversation_members where conversation_id = ${id}`;
    expect(m).toMatchObject({
      user_id: adminId,
      workspace_id: workspaceId,
      notification_level: null,
      is_muted: false,
      is_starred: false,
    });
    expect(m!.created_at).toEqual(NOW);
    expect(await isConversationMember(t.db, adminId, id)).toBe(true);
    expect((await getConversationFacts(t.db, adminId, id))?.isGeneral).toBe(
      true,
    );
  });

  it("fails a second call for the same workspace and leaves one member row", async () => {
    const { workspaceId, adminId } = await workspaceWithAdmin();
    await createGeneralChannel(t.db, {
      workspaceId,
      createdBy: adminId,
      createdAt: NOW,
    });
    const other = await insertUser(t.sql, { workspace_id: workspaceId });
    await expect(
      t.db.transaction((tx) =>
        createGeneralChannel(tx, {
          workspaceId,
          createdBy: other,
          createdAt: NOW,
        }),
      ),
    ).rejects.toMatchObject({
      cause: { constraint_name: "conversations_workspace_id_name_key" },
    });
    expect(
      await count("conversation_members", `workspace_id = '${workspaceId}'`),
    ).toBe(1);
  });

  it("succeeds for a second workspace", async () => {
    const a = await workspaceWithAdmin();
    const b = await workspaceWithAdmin();
    await createGeneralChannel(t.db, {
      ...a,
      createdBy: a.adminId,
      createdAt: NOW,
    });
    await createGeneralChannel(t.db, {
      ...b,
      createdBy: b.adminId,
      createdAt: NOW,
    });
  });

  it("fails an unknown createdBy and writes nothing", async () => {
    const workspaceId = await insertWorkspace(t.sql);
    await expect(
      t.db.transaction((tx) =>
        createGeneralChannel(tx, {
          workspaceId,
          createdBy: crypto.randomUUID(),
          createdAt: NOW,
        }),
      ),
    ).rejects.toMatchObject({
      cause: { constraint_name: "conversations_created_by_fkey" },
    });
    expect(
      await count("conversations", `workspace_id = '${workspaceId}'`),
    ).toBe(0);
  });
});

describe("addMemberToGeneral (R26)", () => {
  it("adds a person with the defaults, then returns false and changes nothing", async () => {
    const { workspaceId, adminId } = await workspaceWithAdmin();
    const general = await createGeneralChannel(t.db, {
      workspaceId,
      createdBy: adminId,
      createdAt: NOW,
    });
    const person = await insertUser(t.sql, { workspace_id: workspaceId });
    expect(
      await addMemberToGeneral(t.db, {
        workspaceId,
        userId: person,
        createdAt: LATER,
      }),
    ).toBe(true);
    const [row] =
      await t.sql`select * from conversation_members where conversation_id = ${general} and user_id = ${person}`;
    expect(row).toMatchObject({
      notification_level: null,
      is_muted: false,
      is_starred: false,
    });
    expect(row!.created_at).toEqual(LATER);
    expect(
      await addMemberToGeneral(t.db, {
        workspaceId,
        userId: person,
        createdAt: new Date("2027-01-01T00:00:00Z"),
      }),
    ).toBe(false);
    const rows =
      await t.sql`select * from conversation_members where conversation_id = ${general} and user_id = ${person}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.created_at).toEqual(LATER);
    const [admin] =
      await t.sql`select created_at from conversation_members where conversation_id = ${general} and user_id = ${adminId}`;
    expect(admin!.created_at).toEqual(NOW);
  });

  it("throws and writes nothing when the workspace has no #general", async () => {
    const workspaceId = await insertWorkspace(t.sql);
    const person = await insertUser(t.sql, { workspace_id: workspaceId });
    await expect(
      t.db.transaction((tx) =>
        addMemberToGeneral(tx, { workspaceId, userId: person, createdAt: NOW }),
      ),
    ).rejects.toThrow(new RegExp(`${workspaceId} has no #general`));
    expect(
      await count("conversation_members", `workspace_id = '${workspaceId}'`),
    ).toBe(0);
  });

  it("fails an unknown userId with conversation_members_user_id_fkey", async () => {
    const { workspaceId, adminId } = await workspaceWithAdmin();
    await createGeneralChannel(t.db, {
      workspaceId,
      createdBy: adminId,
      createdAt: NOW,
    });
    await expect(
      addMemberToGeneral(t.db, {
        workspaceId,
        userId: crypto.randomUUID(),
        createdAt: NOW,
      }),
    ).rejects.toMatchObject({
      cause: { constraint_name: "conversation_members_user_id_fkey" },
    });
  });

  it("puts the person in the #general of their own workspace only", async () => {
    const a = await workspaceWithAdmin();
    const b = await workspaceWithAdmin();
    const ga = await createGeneralChannel(t.db, {
      ...a,
      createdBy: a.adminId,
      createdAt: NOW,
    });
    const gb = await createGeneralChannel(t.db, {
      ...b,
      createdBy: b.adminId,
      createdAt: NOW,
    });
    const person = await insertUser(t.sql, { workspace_id: a.workspaceId });
    await addMemberToGeneral(t.db, {
      workspaceId: a.workspaceId,
      userId: person,
      createdAt: NOW,
    });
    expect(await isConversationMember(t.db, person, ga)).toBe(true);
    expect(await isConversationMember(t.db, person, gb)).toBe(false);
  });

  it("two calls for the same person on two connections leave one row and no error", async () => {
    const { workspaceId, adminId } = await workspaceWithAdmin();
    const general = await createGeneralChannel(t.db, {
      workspaceId,
      createdBy: adminId,
      createdAt: NOW,
    });
    const person = await insertUser(t.sql, { workspace_id: workspaceId });
    const second = t.connect();
    // The first call holds its transaction open; the second must wait on the
    // lock (polled in pg_stat_activity, so the two really overlap); then the
    // first commits.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let added!: () => void;
    const addedP = new Promise<void>((r) => (added = r));
    const first = t.db.transaction(async (tx) => {
      const result = await addMemberToGeneral(tx, {
        workspaceId,
        userId: person,
        createdAt: NOW,
      });
      added();
      await gate;
      return result;
    });
    await addedP;
    const secondCall = addMemberToGeneral(second.db, {
      workspaceId,
      userId: person,
      createdAt: NOW,
    });
    const deadline = Date.now() + 5000;
    for (;;) {
      const [w] = await t.sql<{ n: number }[]>`
        select count(*)::int as n from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock'`;
      if (w!.n > 0) break;
      if (Date.now() > deadline)
        throw new Error("the second call never waited");
      await new Promise((r) => setTimeout(r, 20));
    }
    release();
    expect(await first).toBe(true);
    expect(await secondCall).toBe(false);
    expect(
      await count(
        "conversation_members",
        `conversation_id = '${general}' and user_id = '${person}'`,
      ),
    ).toBe(1);
  });
});
