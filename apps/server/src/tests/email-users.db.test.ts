import { parseEmail } from "@toki/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb } from "./migrated-db.js";
import { insertUser, insertWorkspace } from "./test-rows.js";

// Every address parseEmail accepts is stored by the users table, and one it
// refuses is stopped by the table's own checks (TOKI-020 R16, TOKI-019 R7).
let t: Awaited<ReturnType<typeof createMigratedDb>>;
beforeAll(async () => {
  t = await createMigratedDb();
});
afterAll(async () => {
  await t?.close();
});

const accepted = [
  "minh@example.com",
  "A@B.co",
  "a.b+c_d@sub.example.com",
  `${"a".repeat(64)}@example.com`,
  `a@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.${"e".repeat(60)}`,
];

describe("parseEmail and the users table", () => {
  it("stores every accepted address in its stored form", async () => {
    const workspaceId = await insertWorkspace(t.sql);
    for (const value of accepted) {
      const email = parseEmail(value);
      expect(email, value).not.toBeNull();
      await expect(
        insertUser(t.sql, { workspace_id: workspaceId, email }),
      ).resolves.toBeTypeOf("string");
    }
  });

  it("refuses by the table what parseEmail refuses", async () => {
    const workspaceId = await insertWorkspace(t.sql);
    for (const value of [
      "a b@example.com",
      `a@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.${"e".repeat(61)}`,
    ]) {
      expect(parseEmail(value)).toBeNull();
      await expect(
        insertUser(t.sql, { workspace_id: workspaceId, email: value }),
      ).rejects.toMatchObject({ code: "23514" });
    }
  });
});
