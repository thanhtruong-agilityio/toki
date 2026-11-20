import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb } from "../migrated-db.js";
import { insertUser, insertWorkspace } from "../test-rows.js";
import { listPeople } from "../../src/modules/members/index.js";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
beforeAll(async () => {
  t = await createMigratedDb();
});
afterAll(async () => {
  await t?.close();
});

describe("listPeople (TOKI-031 R5, R15)", () => {
  it("returns every account of the workspace with four keys, in byte order of the lower-cased name, then id", async () => {
    const ws = await insertWorkspace(t.sql);
    const make = (display_name: string, extra: Record<string, unknown> = {}) =>
      insertUser(t.sql, { workspace_id: ws, display_name, ...extra });
    const zed = await make("zed");
    const bob = await make("Bob", { role: "admin" });
    const bobLower = await make("bob");
    const ann = await make("Ann", { status: "deactivated" });
    const ine = await make("Éva");

    const rows = await listPeople(t.db, ws);
    // "bob" and "Bob" tie once lower-cased: the id decides, in byte order.
    const bobs = [bob, bobLower].sort();
    expect(rows.map((r) => r.id)).toEqual([ann, ...bobs, zed, ine]);
    expect(rows.find((r) => r.id === ann)).toEqual({
      id: ann,
      displayName: "Ann",
      role: "member",
      status: "deactivated",
    });
    expect(rows.find((r) => r.id === bob)).toEqual({
      id: bob,
      displayName: "Bob",
      role: "admin",
      status: "active",
    });
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(
        ["displayName", "id", "role", "status"].sort(),
      );
    }
  });

  it("does not return an account of another workspace", async () => {
    const ws = await insertWorkspace(t.sql);
    const other = await insertWorkspace(t.sql);
    const mine = await insertUser(t.sql, { workspace_id: ws });
    await insertUser(t.sql, { workspace_id: other });
    const rows = await listPeople(t.db, ws);
    expect(rows.map((r) => r.id)).toEqual([mine]);
    expect(await listPeople(t.db, crypto.randomUUID())).toEqual([]);
  });

  it("holds no email address", async () => {
    const ws = await insertWorkspace(t.sql);
    await insertUser(t.sql, { workspace_id: ws, email: "sam@example.com" });
    const body = JSON.stringify(await listPeople(t.db, ws));
    expect(body).not.toContain("sam@example.com");
    expect(body).not.toContain("@");
  });

  it("works inside a read-only repeatable-read transaction", async () => {
    const ws = await insertWorkspace(t.sql);
    const a = await insertUser(t.sql, { workspace_id: ws });
    const rows = await t.db.transaction((tx) => listPeople(tx, ws), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
    expect(rows.map((r) => r.id)).toEqual([a]);
  });
});
