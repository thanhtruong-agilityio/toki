import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../../db/client.js";
import { migrationsFolder, runMigrations } from "../../db/migrate.js";
import {
  insertDevice,
  insertSession,
  insertUser,
  insertWorkspace,
} from "../../db/test-rows.js";
import { createThrowawayDb } from "../../test/throwaway-db.js";
import { users } from "./schema.js";

let throwaway: Awaited<ReturnType<typeof createThrowawayDb>>;
let conn: ReturnType<typeof createDb>;
let sql: Sql;
let ws: string;
beforeAll(async () => {
  throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  conn = createDb(throwaway.url);
  sql = postgres(throwaway.url, { max: 1, onnotice: () => {} });
  ws = await insertWorkspace(sql);
});
afterAll(async () => {
  await conn?.close();
  await sql?.end();
  await throwaway?.drop();
});

describe("users table object", () => {
  it("makes a UUIDv7 id in the server when none is passed (R3)", async () => {
    const [row] = await conn.db
      .insert(users)
      .values({
        workspaceId: ws,
        email: "v7@example.com",
        displayName: "V7",
        role: "member",
        status: "active",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    expect(row?.id[14]).toBe("7");
  });

  it("has no default for created_at (R6)", async () => {
    const error = await conn.db
      .insert(users)
      .values({
        workspaceId: ws,
        email: "notime@example.com",
        displayName: "No time",
        role: "member",
        status: "active",
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

  it("deactivates and reactivates the same row without losing its sessions or devices (R12)", async () => {
    const id = await insertUser(sql, { workspace_id: ws });
    const session = await insertSession(sql, { workspace_id: ws, user_id: id });
    const device = await insertDevice(sql, {
      workspace_id: ws,
      user_id: id,
      session_id: session,
    });
    await sql`update users set status = 'deactivated' where id = ${id}`;
    await sql`update users set status = 'active' where id = ${id}`;
    const [{ n }] = await sql`select (
      (select count(*) from sessions where id = ${session}) +
      (select count(*) from devices where id = ${device}))::int as n`;
    expect(n).toBe(2);
    const [row] = await sql`select status from users where id = ${id}`;
    expect(row!.status).toBe("active");
  });
});
