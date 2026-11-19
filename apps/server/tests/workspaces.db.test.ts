import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createDb } from "../src/db/client.js";
import { workspaces } from "../src/modules/workspace/schema.js";

// The sample integration test of the harness (TOKI-008 R2, R6, R18): a real
// Postgres, the connection of the configuration module, the test database.
let conn: ReturnType<typeof createDb>;
beforeAll(() => {
  const { database } = loadConfig(process.env, ["database"]);
  conn = createDb(database.url);
});
afterAll(async () => {
  await conn?.close();
});

describe("test database", () => {
  it("is empty at the start of the file (R6)", async () => {
    expect(await conn.db.select().from(workspaces)).toHaveLength(0);
  });

  it("is reached through the application's own client (R18)", async () => {
    const rows = await conn.db.execute<{ name: string }>(
      "select current_database() as name",
    );
    expect(rows[0]?.name).toBe(
      new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1),
    );
  });

  it("stores a row in workspaces and reads it back (R2)", async () => {
    const [saved] = await conn.db
      .insert(workspaces)
      .values({ name: "Sample workspace" })
      .returning();
    const [read] = await conn.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, saved!.id));
    expect(read?.name).toBe("Sample workspace");
  });
});
