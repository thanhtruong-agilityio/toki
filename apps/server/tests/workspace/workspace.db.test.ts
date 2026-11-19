import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../../src/db/client.js";
import { migrationsFolder, runMigrations } from "../../src/db/migrate.js";
import { insertWorkspace } from "../test-rows.js";
import { createThrowawayDb } from "../throwaway-db.js";
import { getWorkspace } from "../../src/modules/workspace/index.js";

let throwaway: Awaited<ReturnType<typeof createThrowawayDb>>;
let conn: ReturnType<typeof createDb>;
let sql: Sql;
beforeAll(async () => {
  throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  conn = createDb(throwaway.url);
  sql = postgres(throwaway.url, { max: 1, onnotice: () => {} });
});
afterAll(async () => {
  await conn?.close();
  await sql?.end();
  await throwaway?.drop();
});

describe("getWorkspace (R55)", () => {
  it("returns null before the workspace exists", async () => {
    expect(await getWorkspace(conn.db)).toBeNull();
  });
  it("returns the id and the name of the one workspace, also in a transaction", async () => {
    const id = await insertWorkspace(sql, { name: "Acme" });
    expect(await getWorkspace(conn.db)).toEqual({ id, name: "Acme" });
    await conn.db.transaction(async (tx) => {
      expect(await getWorkspace(tx)).toEqual({ id, name: "Acme" });
    });
  });
});
