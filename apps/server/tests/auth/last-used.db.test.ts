import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getLastUsedAtByUser } from "../../src/modules/auth/index.js";
import { createMigratedDb } from "../migrated-db.js";
import { insertSession, insertUser, insertWorkspace } from "../test-rows.js";

// The latest use of each person's sessions (TOKI-024 R25).

let t: Awaited<ReturnType<typeof createMigratedDb>>;
let ws: string;
const at = (day: number) => new Date(Date.UTC(2026, 0, day));

beforeAll(async () => {
  t = await createMigratedDb();
  ws = await insertWorkspace(t.sql);
});
afterAll(async () => {
  await t?.close();
});

const person = () => insertUser(t.sql, { workspace_id: ws });
const session = (user_id: string, values: Record<string, unknown>) =>
  insertSession(t.sql, { workspace_id: ws, user_id, ...values });

describe("getLastUsedAtByUser", () => {
  it("gives the latest last_used_at of each person, over ended and live sessions", async () => {
    const a = await person();
    const b = await person();
    await session(a, { last_used_at: at(3) });
    await session(a, {
      last_used_at: at(9),
      ended_at: at(9),
      ended_reason: "signed_out",
    });
    await session(a, { last_used_at: at(5) });
    await session(b, { last_used_at: at(2) });
    const found = await getLastUsedAtByUser(t.db, [a, b]);
    expect(found.get(a)).toEqual(at(9));
    expect(found.get(b)).toEqual(at(2));
    expect(found.size).toBe(2);
  });

  it("has no entry for a person with no session, and only the people asked for", async () => {
    const a = await person();
    const b = await person();
    const c = await person();
    await session(a, { last_used_at: at(4) });
    await session(c, { last_used_at: at(4) });
    const found = await getLastUsedAtByUser(t.db, [a, b]);
    expect([...found.keys()]).toEqual([a]);
  });

  it("gives an empty answer for no person", async () => {
    expect((await getLastUsedAtByUser(t.db, [])).size).toBe(0);
  });
});
