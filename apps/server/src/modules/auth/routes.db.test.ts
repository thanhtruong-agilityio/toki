import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

describe("the workspace name (R39)", () => {
  it("is public and has no other field", async () => {
    const res = await h.call({ method: "GET", url: "/api/v1/auth/workspace" });
    expect(res.statusCode).toBe(200);
    expect(h.json(res)).toEqual({ name: "Acme" });
  });
});

describe("the flag on a route (R24)", () => {
  it("lets a flagged route answer without a session and refuses one without the flag", async () => {
    expect(
      (await h.call({ method: "GET", url: "/api/v1/public-thing" })).statusCode,
    ).toBe(200);
    const res = await h.call({ method: "GET", url: "/api/v1/protected" });
    expect(res.statusCode).toBe(401);
    expect(h.json(res).error.code).toBe("unauthenticated");
    expect(res.body).not.toContain("workspace");
  });
  it("puts the account on the request with workspaceId (R55)", async () => {
    const id = await h.addUser("acc@example.com");
    const { secret } = await h.signIn("acc@example.com");
    const res = await h.call({
      method: "GET",
      url: "/api/v1/protected",
      headers: h.withCookie(secret),
    });
    expect(h.json(res)).toEqual({ id, workspaceId: h.workspaceId });
  });
});

describe("safety (R36, R37)", () => {
  it("has no GET route among the auth routes that writes", async () => {
    const tree = h.app.printRoutes({ commonPrefix: false });
    const gets = tree
      .split("\n")
      .filter((l) => /auth/.test(l) && /GET/.test(l));
    const text = gets.join("\n");
    expect(text).toMatch(/session/);
    expect(text).toMatch(/workspace/);
    const before = {
      sessions:
        await h.sql`select count(*)::int as n, count(ended_at)::int as e from sessions`,
      codes: await h.sql`select count(*)::int as n from login_codes`,
    };
    await h.call({ method: "GET", url: "/api/v1/auth/workspace" });
    await h.call({ method: "GET", url: "/api/v1/auth/session" });
    await h.call({ method: "GET", url: "/api/v1/auth/codes" });
    await h.call({ method: "GET", url: "/api/v1/auth/sessions" });
    const after = {
      sessions:
        await h.sql`select count(*)::int as n, count(ended_at)::int as e from sessions`,
      codes: await h.sql`select count(*)::int as n from login_codes`,
    };
    expect(after).toEqual(before);
  });

  it("writes no code, requestId, secret, cookie value or address to the log", async () => {
    await h.addUser("log@example.com");
    const asked = await h.requestCode("log@example.com");
    const requestId = h.json(asked).requestId as string;
    await h.flush();
    const code = h.lastCode();
    h.clock.advance(1000);
    await h.exchange(requestId, code === "111111" ? "222222" : "111111");
    const signed = await h.exchange(requestId, code);
    const secret = /toki_session=([^;]+)/.exec(
      String(signed.headers["set-cookie"]),
    )![1]!;
    await h.call({
      method: "GET",
      url: "/api/v1/protected",
      headers: h.withCookie(secret),
    });
    await h.call({
      method: "DELETE",
      url: "/api/v1/auth/session",
      headers: h.withCookie(secret),
    });
    const log = h.logText();
    expect(log.length).toBeGreaterThan(0);
    for (const secretValue of [code, requestId, secret, "log@example.com"]) {
      expect(log.includes(secretValue), secretValue).toBe(false);
    }
  });

  it("does not put a code or a requestId in an error body (R37)", async () => {
    await h.addUser("err@example.com");
    const asked = await h.requestCode("err@example.com");
    const requestId = h.json(asked).requestId as string;
    const res = await h.exchange(requestId, "000000");
    expect(res.body).not.toContain(requestId);
    expect(res.body).not.toContain("000000");
  });
});

describe("bodies are validated with the shared schemas (R38)", () => {
  it("rejects a body that fails the schema", async () => {
    const res = await h.call({
      method: "POST",
      url: "/api/v1/auth/codes",
      payload: { email: 5 },
    });
    expect(res.statusCode).toBe(400);
    expect(h.json(res).error.code).toBe("validation_failed");
    const bad = await h.call({
      method: "POST",
      url: "/api/v1/auth/sessions",
      payload: { requestId: "r", code: "123456", transport: "pigeon" },
    });
    expect(bad.statusCode).toBe(400);
    expect(h.json(bad).error.code).toBe("validation_failed");
  });
});
