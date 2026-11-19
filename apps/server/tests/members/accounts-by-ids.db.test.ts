import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb } from "../migrated-db.js";
import { insertUser, insertWorkspace } from "../test-rows.js";
import { getAccountsByIds } from "../../src/modules/members/index.js";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
beforeAll(async () => {
  t = await createMigratedDb();
});
afterAll(async () => {
  await t?.close();
});

describe("getAccountsByIds (TOKI-029 R19)", () => {
  it("returns the four fields for each id that has a row, in id order", async () => {
    const workspaceId = await insertWorkspace(t.sql);
    const a = await insertUser(t.sql, {
      workspace_id: workspaceId,
      role: "admin",
    });
    const b = await insertUser(t.sql, {
      workspace_id: workspaceId,
      status: "deactivated",
    });
    const rows = await getAccountsByIds(t.db, [b, a]);
    expect(rows).toEqual(
      [
        { id: a, workspaceId, role: "admin", status: "active" },
        { id: b, workspaceId, role: "member", status: "deactivated" },
      ].sort((x, y) => (x.id < y.id ? -1 : 1)),
    );
  });

  it("holds no email address and no display name", async () => {
    const workspaceId = await insertWorkspace(t.sql);
    const a = await insertUser(t.sql, { workspace_id: workspaceId });
    const [row] = await getAccountsByIds(t.db, [a]);
    expect(Object.keys(row!).sort()).toEqual(
      ["id", "role", "status", "workspaceId"].sort(),
    );
  });

  it("returns nothing for an unknown id and for no ids, and counts a repeated id once", async () => {
    const workspaceId = await insertWorkspace(t.sql);
    const a = await insertUser(t.sql, { workspace_id: workspaceId });
    const unknown = "01930b7e-7a53-7c2e-9f1a-000000000001";
    expect(await getAccountsByIds(t.db, [unknown])).toEqual([]);
    expect(await getAccountsByIds(t.db, [])).toEqual([]);
    expect(await getAccountsByIds(t.db, [a, a])).toHaveLength(1);
  });

  it("takes no lock without the option and a share lock with it", async () => {
    const workspaceId = await insertWorkspace(t.sql);
    const a = await insertUser(t.sql, { workspace_id: workspaceId });
    const other = postgres(t.url, { max: 1, onnotice: () => {} });
    try {
      const waiting = async () =>
        (
          await t.sql<{ n: number }[]>`
            select count(*)::int as n from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'`
        )[0]!.n;

      // No option: an update on the other connection is not held back.
      await t.db.transaction(async (tx) => {
        await getAccountsByIds(tx, [a]);
        await other`update users set display_name = 'x' where id = ${a}`;
      });

      // With the option: the update waits for the commit of the reader.
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let locked!: () => void;
      const lockedP = new Promise<void>((r) => (locked = r));
      const reader = t.db.transaction(async (tx) => {
        await getAccountsByIds(tx, [a], { lock: "share" });
        locked();
        await gate;
      });
      await lockedP;
      let updated = false;
      const update =
        other`update users set display_name = 'y' where id = ${a}`.then(() => {
          updated = true;
        });
      const deadline = Date.now() + 5000;
      while ((await waiting()) === 0) {
        if (Date.now() > deadline) throw new Error("the update never waited");
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(updated).toBe(false);
      release();
      await reader;
      await update;
      expect(updated).toBe(true);
    } finally {
      await other.end();
    }
  });
});
