import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb } from "../migrated-db.js";
import { insertWorkspace } from "../test-rows.js";
import * as mod from "../../src/modules/workspace/index.js";
import * as schema from "../../src/modules/workspace/schema.js";
import {
  createWorkspace,
  listWorkspaceIds,
} from "../../src/modules/workspace/index.js";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
beforeAll(async () => {
  t = await createMigratedDb();
});
afterAll(async () => {
  await t?.close();
});

describe("the workspace module surface (TOKI-020 R14)", () => {
  it("exports its functions for the first set-up and no table", () => {
    expect(Object.keys(mod)).toEqual(
      expect.arrayContaining(["createWorkspace", "listWorkspaceIds"]),
    );
    const tables = new Set<unknown>(Object.values(schema));
    for (const value of Object.values(mod))
      expect(tables.has(value)).toBe(false);
  });
});

describe("listWorkspaceIds and createWorkspace", () => {
  it("lists nothing on an empty table, then the id createWorkspace returned", async () => {
    expect(await listWorkspaceIds(t.db)).toEqual([]);
    const id = await createWorkspace(t.db, { name: "Test Workspace" });
    expect(await listWorkspaceIds(t.db)).toEqual([id]);
    const rows =
      await t.sql`select name, created_at from workspaces where id = ${id}`;
    expect(rows[0]?.name).toBe("Test Workspace");
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it("lists every row, including one made by SQL", async () => {
    const other = await insertWorkspace(t.sql);
    expect(await listWorkspaceIds(t.db)).toContain(other);
    expect((await listWorkspaceIds(t.db)).length).toBeGreaterThanOrEqual(2);
  });

  it("writes with the caller's transaction: a rollback leaves nothing", async () => {
    const before = (await listWorkspaceIds(t.db)).length;
    await expect(
      t.db.transaction(async (tx) => {
        await createWorkspace(tx, { name: "Rolled back" });
        throw new Error("stop");
      }),
    ).rejects.toThrow("stop");
    expect((await listWorkspaceIds(t.db)).length).toBe(before);
  });
});
