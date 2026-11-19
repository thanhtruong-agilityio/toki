import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, ORIGIN, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const codesBefore = async () =>
  Number((await h.sql`select count(*) from login_codes`)[0]!.count);

describe("JSON-only bodies (R45)", () => {
  it("answers 415 to a form body and to text/plain, and changes nothing", async () => {
    const before = await codesBefore();
    for (const [type, body] of [
      ["application/x-www-form-urlencoded", "email=sam%40example.com"],
      ["text/plain", '{"email":"sam@example.com"}'],
    ] as const) {
      const res = await h.call({
        method: "POST",
        url: "/api/v1/auth/codes",
        headers: { "content-type": type },
        payload: body,
      });
      expect(res.statusCode, type).toBe(415);
      expect(h.json(res).error.code).toBe("unsupported_media_type");
    }
    expect(await codesBefore()).toBe(before);
  });
  it("does not refuse a request with no body, whatever its type", async () => {
    const res = await h.call({
      method: "GET",
      url: "/api/v1/public-thing",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(res.statusCode).toBe(200);
  });
  it("lets a DELETE with a JSON type and no body through (R33)", async () => {
    const res = await h.call({
      method: "DELETE",
      url: "/api/v1/auth/session",
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(204);
  });
});

describe("Origin rule (R46)", () => {
  it("refuses a foreign Origin on POST, DELETE, PATCH and PUT, and changes nothing", async () => {
    const before = await codesBefore();
    const foreign = { origin: "https://evil.example" };
    const cases = [
      {
        method: "POST",
        url: "/api/v1/auth/codes",
        payload: { email: "a@example.com" },
      },
      { method: "DELETE", url: "/api/v1/auth/session" },
      { method: "PATCH", url: "/api/v1/patchable", payload: {} },
      { method: "PUT", url: "/api/v1/puttable", payload: {} },
    ] as const;
    for (const c of cases) {
      const res = await h.call({ ...c, headers: foreign });
      expect(res.statusCode, c.method).toBe(403);
      expect(h.json(res).error.code).toBe("origin_not_allowed");
    }
    expect(await codesBefore()).toBe(before);
  });
  it("lets the app's own origin, no Origin, and a GET with any Origin through", async () => {
    expect(
      (
        await h.call({
          method: "PATCH",
          url: "/api/v1/patchable",
          payload: {},
          headers: { origin: ORIGIN },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await h.call({ method: "PATCH", url: "/api/v1/patchable", payload: {} }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await h.call({
          method: "GET",
          url: "/api/v1/public-thing",
          headers: { origin: "https://other.example" },
        })
      ).statusCode,
    ).toBe(200);
  });
  it("sends no cross-origin headers", async () => {
    const res = await h.call({
      method: "GET",
      url: "/api/v1/public-thing",
      headers: { origin: ORIGIN },
    });
    for (const name of Object.keys(res.headers)) {
      expect(name.toLowerCase().startsWith("access-control-")).toBe(false);
    }
  });
});

describe("JSON bodies keep Fastify's guard against prototype poisoning", () => {
  it("answers 400 to a __proto__ key and to constructor.prototype, and changes nothing", async () => {
    const before = await codesBefore();
    for (const raw of [
      '{"email":"a@example.com","__proto__":{"polluted":true}}',
      '{"email":"a@example.com","constructor":{"prototype":{"polluted":true}}}',
    ]) {
      const res = await h.call({
        method: "POST",
        url: "/api/v1/auth/codes",
        headers: { "content-type": "application/json" },
        payload: raw,
      });
      expect(res.statusCode, raw).toBe(400);
      expect(h.json(res).error.code).toBe("bad_request");
    }
    expect(await codesBefore()).toBe(before);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("a foreign Origin ends nothing, also with a session (R46)", () => {
  it("answers 403 to a signed-in DELETE and the session still works", async () => {
    await h.addUser("origin@example.com");
    const { secret } = await h.signIn("origin@example.com");
    const res = await h.call({
      method: "DELETE",
      url: "/api/v1/auth/session",
      headers: { origin: "https://evil.example", ...h.withCookie(secret) },
    });
    expect(res.statusCode).toBe(403);
    const after = await h.call({
      method: "GET",
      url: "/api/v1/protected",
      headers: h.withCookie(secret),
    });
    expect(after.statusCode).toBe(200);
  });
});
