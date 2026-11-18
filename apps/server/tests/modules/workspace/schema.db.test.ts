import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../../../src/db/client.js";
import { migrationsFolder, runMigrations } from "../../../src/db/migrate.js";
import { createThrowawayDb } from "../../support/throwaway-db.js";
import { workspaces } from "../../../src/modules/workspace/schema.js";

let throwaway: Awaited<ReturnType<typeof createThrowawayDb>>;
let conn: ReturnType<typeof createDb>;
beforeAll(async () => {
  throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  conn = createDb(throwaway.url);
});
afterAll(async () => {
  await conn?.close();
  await throwaway?.drop();
});

// Drizzle wraps the Postgres error; the original sits in `cause`.
async function failure(run: Promise<unknown>) {
  const error = await run.then(
    () => null,
    (e: unknown) => e as Error & { cause?: Error & { code?: string } },
  );
  expect(error).not.toBeNull();
  return error!.cause ?? error!;
}

describe("workspaces", () => {
  it("makes a UUIDv7 id in the server when none is passed (R8)", async () => {
    const [row] = await conn.db
      .insert(workspaces)
      .values({ name: "Acme" })
      .returning();
    expect(row?.id[14]).toBe("7");
  });

  it("requires a name (R9a)", async () => {
    const cause = (await failure(
      conn.db
        .insert(workspaces)
        .values({ id: crypto.randomUUID() } as never) as never,
    )) as Error & { code?: string; column_name?: string };
    expect(cause.code).toBe("23502");
    expect(cause.message).toMatch(/"name"/);
  });

  it("rejects an empty name and a 101-character name (R9b, R9c)", async () => {
    for (const name of ["", "x".repeat(101)]) {
      const cause = (await failure(
        conn.db
          .insert(workspaces)
          .values({ id: crypto.randomUUID(), name }) as never,
      )) as Error & { code?: string };
      expect(cause.code).toBe("23514");
    }
  });

  it("accepts a 100-character name (R9d)", async () => {
    await conn.db
      .insert(workspaces)
      .values({ id: crypto.randomUUID(), name: "x".repeat(100) });
  });

  it("sets created_at, allows several rows and has exactly three columns (R15)", async () => {
    const before = Date.now();
    const [one, two] = await Promise.all([
      conn.db.insert(workspaces).values({ name: "One" }).returning(),
      conn.db.insert(workspaces).values({ name: "Two" }).returning(),
    ]);
    expect(Math.abs(one![0]!.createdAt.getTime() - before)).toBeLessThan(
      60_000,
    );
    expect(two![0]).toBeDefined();
    const columns = await conn.db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns where table_name = 'workspaces' order by column_name`,
    );
    expect(columns.map((c) => c.column_name)).toEqual([
      "created_at",
      "id",
      "name",
    ]);
  });
});
