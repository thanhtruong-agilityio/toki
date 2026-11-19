import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../../src/db/client.js";
import { migrationsFolder, runMigrations } from "../../src/db/migrate.js";
import { insertUser, insertWorkspace } from "../../src/tests/test-rows.js";
import { createThrowawayDb } from "../../src/tests/throwaway-db.js";
import { loginCodes, sessions } from "../../src/modules/auth/schema.js";

let throwaway: Awaited<ReturnType<typeof createThrowawayDb>>;
let conn: ReturnType<typeof createDb>;
let sql: Sql;
let ws: string;
let user: string;
beforeAll(async () => {
  throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  conn = createDb(throwaway.url);
  sql = postgres(throwaway.url, { max: 1, onnotice: () => {} });
  ws = await insertWorkspace(sql);
  user = await insertUser(sql, { workspace_id: ws });
});
afterAll(async () => {
  await conn?.close();
  await sql?.end();
  await throwaway?.drop();
});

type Cause = Error & {
  cause?: Error & { code?: string; column_name?: string };
};
const failure = (run: PromiseLike<unknown>) =>
  run.then(
    () => null,
    (e: unknown) => (e as Cause).cause,
  );
const at = new Date("2026-01-01T00:00:00Z");

describe("auth table objects", () => {
  it("make a UUIDv7 id in the server when none is passed (R3)", async () => {
    const [code] = await conn.db
      .insert(loginCodes)
      .values({
        workspaceId: ws,
        createdAt: at,
        purpose: "sign_in",
        email: "code@example.com",
        requestHash: "a".repeat(64),
        codeHash: "b".repeat(64),
        expiresAt: new Date(at.getTime() + 600000),
        wrongTries: 0,
      })
      .returning();
    expect(code?.id[14]).toBe("7");
    const [session] = await conn.db
      .insert(sessions)
      .values({
        workspaceId: ws,
        createdAt: at,
        userId: user,
        secretHash: "c".repeat(64),
        kind: "cookie",
        lastUsedAt: at,
      })
      .returning();
    expect(session?.id[14]).toBe("7");
  });

  it("have no default for created_at (R6)", async () => {
    const cause = await failure(
      conn.db.insert(sessions).values({
        workspaceId: ws,
        userId: user,
        secretHash: "d".repeat(64),
        kind: "cookie",
        lastUsedAt: at,
      } as never),
    );
    expect(cause?.code).toBe("23502");
    expect(cause?.column_name).toBe("created_at");
  });
});
