import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, makeSession, UUID_NOT_IN_USE } from "./session-fixtures.js";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

describe("guards of the session routes (TOKI-026 R16)", () => {
  it("answers 401 to each route without a session", async () => {
    for (const [method, url] of [
      ["GET", "/api/v1/auth/sessions"],
      ["DELETE", `/api/v1/auth/sessions/${UUID_NOT_IN_USE}`],
      ["DELETE", "/api/v1/auth/sessions"],
    ] as const) {
      const res = await h.call({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      expect(h.json(res).error.code).toBe("unauthenticated");
    }
  });

  it("refuses a DELETE with a foreign Origin and ends nothing", async () => {
    const id = await h.addUser("origin@example.com");
    const mine = await makeSession(h, id);
    const other = await makeSession(h, id);
    for (const url of [
      "/api/v1/auth/sessions",
      `/api/v1/auth/sessions/${other.id}`,
    ]) {
      const res = await h.call({
        method: "DELETE",
        url,
        headers: { ...bearer(mine.secret), origin: "https://evil.example" },
      });
      expect(res.statusCode).toBe(403);
    }
    const live =
      await h.sql`select count(*)::int as n from sessions where user_id = ${id} and ended_at is null`;
    expect(live[0]!.n).toBe(2);
  });

  it("has no GET route that writes: the list only renews the last use", async () => {
    const id = await h.addUser("get@example.com");
    const mine = await makeSession(h, id);
    const before = await h.sql`select * from sessions where user_id = ${id}`;
    await h.call({
      method: "GET",
      url: "/api/v1/auth/sessions",
      headers: bearer(mine.secret),
    });
    const after = await h.sql`select * from sessions where user_id = ${id}`;
    expect(after).toHaveLength(before.length);
    expect(after[0]!.ended_at).toBeNull();
  });
});
