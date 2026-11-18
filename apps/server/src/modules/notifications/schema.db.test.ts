import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../../db/client.js";
import { migrationsFolder, runMigrations } from "../../db/migrate.js";
import {
  insertSession,
  insertUser,
  insertWorkspace,
} from "../../tests/test-rows.js";
import { createThrowawayDb } from "../../tests/throwaway-db.js";
import { devices } from "./schema.js";

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

describe("devices table object", () => {
  it("makes a UUIDv7 id in the server when none is passed (R3)", async () => {
    const session = await insertSession(sql, {
      workspace_id: ws,
      user_id: user,
    });
    const [row] = await conn.db
      .insert(devices)
      .values({
        workspaceId: ws,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        userId: user,
        sessionId: session,
        pushChannel: "web_push",
        pushAddress: { endpoint: "https://push.example.com/x" },
      })
      .returning();
    expect(row?.id[14]).toBe("7");
  });

  it("has no default for created_at (R6)", async () => {
    const session = await insertSession(sql, {
      workspace_id: ws,
      user_id: user,
    });
    const error = await conn.db
      .insert(devices)
      .values({
        workspaceId: ws,
        userId: user,
        sessionId: session,
        pushChannel: "web_push",
        pushAddress: {},
      } as never)
      .then(
        () => null,
        (e: unknown) =>
          e as Error & {
            cause?: Error & { code?: string; column_name?: string };
          },
      );
    expect(error?.cause?.code).toBe("23502");
    expect(error?.cause?.column_name).toBe("created_at");
  });
});
