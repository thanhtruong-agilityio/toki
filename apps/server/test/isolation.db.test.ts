import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createDb } from "../src/db/client.js";
import { workspaces } from "../src/modules/workspace/schema.js";

// The second file of R6: it passes in either order with the file beside it,
// because each file starts with empty tables and leaves its row behind.
let conn: ReturnType<typeof createDb>;
beforeAll(() => {
  conn = createDb(loadConfig(process.env, ["database"]).database.url);
});
afterAll(async () => {
  await conn?.close();
});

describe("test database isolation", () => {
  it("starts with no rows and leaves one behind (R6)", async () => {
    expect(await conn.db.select().from(workspaces)).toHaveLength(0);
    await conn.db.insert(workspaces).values({ name: "Left behind" });
  });
});
