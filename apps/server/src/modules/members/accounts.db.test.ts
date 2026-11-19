import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb } from "../../tests/migrated-db.js";
import { insertWorkspace } from "../../tests/test-rows.js";
import * as mod from "./index.js";
import * as schema from "./schema.js";
import { countAccounts, createFirstAdminAccount } from "./index.js";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
beforeAll(async () => {
  t = await createMigratedDb();
});
afterAll(async () => {
  await t?.close();
});

const NOW = new Date("2026-03-01T10:00:00.000Z");

describe("the members module surface (TOKI-020 R14)", () => {
  it("exports its two functions and no table", () => {
    expect(Object.keys(mod).sort()).toEqual(["countAccounts", "createFirstAdminAccount"]);
    const tables = new Set<unknown>(Object.values(schema));
    for (const value of Object.values(mod)) expect(tables.has(value)).toBe(false);
  });
});

describe("countAccounts and createFirstAdminAccount", () => {
  it("counts zero, then inserts one active Admin with the default language", async () => {
    expect(await countAccounts(t.db)).toBe(0);
    const workspaceId = await insertWorkspace(t.sql);
    const id = await createFirstAdminAccount(t.db, {
      workspaceId,
      email: "minh@example.com",
      displayName: "Minh",
      createdAt: NOW,
    });
    expect(await countAccounts(t.db)).toBe(1);
    const [row] = await t.sql`select * from users where id = ${id}`;
    expect(row).toMatchObject({
      workspace_id: workspaceId,
      email: "minh@example.com",
      display_name: "Minh",
      role: "admin",
      status: "active",
      language: "en",
    });
    expect((row?.created_at as Date).toISOString()).toBe(NOW.toISOString());
  });

  it("takes neither the role nor the status as an argument", () => {
    // A call that tries to pass them does not compile.
    // @ts-expect-error role is not an argument
    void ((): unknown => createFirstAdminAccount(t.db, { workspaceId: "w", email: "a@b.co", displayName: "A", createdAt: NOW, role: "member" }));
    expect(createFirstAdminAccount.length).toBe(2);
  });

  it("writes with the caller's transaction", async () => {
    const before = await countAccounts(t.db);
    const workspaceId = await insertWorkspace(t.sql);
    await expect(
      t.db.transaction(async (tx) => {
        await createFirstAdminAccount(tx, {
          workspaceId,
          email: "other@example.com",
          displayName: "Other",
          createdAt: NOW,
        });
        throw new Error("stop");
      }),
    ).rejects.toThrow("stop");
    expect(await countAccounts(t.db)).toBe(before);
  });
});
