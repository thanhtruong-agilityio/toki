import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../../src/db/client.js";
import { migrationsFolder, runMigrations } from "../../src/db/migrate.js";
import { insertUser, insertWorkspace } from "../../src/tests/test-rows.js";
import { createThrowawayDb } from "../../src/tests/throwaway-db.js";
import {
  findAccountByEmail,
  getAccountById,
} from "../../src/modules/members/index.js";

let throwaway: Awaited<ReturnType<typeof createThrowawayDb>>;
let conn: ReturnType<typeof createDb>;
let sql: Sql;
let ws: string;
let userId: string;
beforeAll(async () => {
  throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  conn = createDb(throwaway.url);
  sql = postgres(throwaway.url, { max: 1, onnotice: () => {} });
  ws = await insertWorkspace(sql);
  userId = await insertUser(sql, {
    workspace_id: ws,
    email: "sam@example.com",
    display_name: "Sam",
    role: "admin",
    status: "deactivated",
    language: "vi",
  });
});
afterAll(async () => {
  await conn?.close();
  await sql?.end();
  await throwaway?.drop();
});

const expected = () => ({
  id: userId,
  workspaceId: ws,
  email: "sam@example.com",
  displayName: "Sam",
  role: "admin",
  status: "deactivated",
  language: "vi",
});

describe("account reads (R55)", () => {
  it("finds an account by its address, with workspaceId", async () => {
    expect(await findAccountByEmail(conn.db, "sam@example.com")).toEqual(
      expected(),
    );
  });
  it("returns no account for an address with no users row", async () => {
    expect(await findAccountByEmail(conn.db, "nobody@example.com")).toBeNull();
  });
  it("gets an account by id and returns null for an unknown id", async () => {
    expect(await getAccountById(conn.db, userId)).toEqual(expected());
    expect(await getAccountById(conn.db, crypto.randomUUID())).toBeNull();
  });
  it("accepts an open transaction as client", async () => {
    await conn.db.transaction(async (tx) => {
      expect(await findAccountByEmail(tx, "sam@example.com")).toEqual(
        expected(),
      );
      expect(await getAccountById(tx, userId)).toEqual(expected());
    });
  });
});
