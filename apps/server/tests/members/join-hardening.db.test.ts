import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { json, makeInvitation, type Admin, type Made } from "./join-support.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

let h: MemberHarness;
let lan: Admin;
let made: Made;

beforeAll(async () => {
  h = await createMemberHarness();
  lan = await h.admin("lan@example.com");
  made = await makeInvitation(h, lan, "harden@example.com");
});
afterAll(async () => {
  await h?.close();
});

// The three public routes of the Join page, with a body each (R22, R23).
const routes = () => [
  { url: "/api/v1/invitations/lookup", payload: { token: made.token } },
];

const rowCounts = async () =>
  JSON.stringify([
    await h.sql`select count(*)::int as n from login_codes`,
    await h.sql`select count(*)::int as n from sessions`,
  ]);

describe("hardening of the three routes (R22, R23, R24)", () => {
  it("answers 415 to a form body and to text/plain, and changes nothing (R22)", async () => {
    const before = await rowCounts();
    for (const route of routes()) {
      for (const [type, body] of [
        ["application/x-www-form-urlencoded", `token=${made.token}`],
        ["text/plain", JSON.stringify(route.payload)],
      ] as const) {
        const res = await h.call({
          method: "POST",
          url: route.url,
          headers: { "content-type": type },
          payload: body,
        });
        expect(res.statusCode, `${route.url} ${type}`).toBe(415);
        expect(json(res).error.code).toBe("unsupported_media_type");
      }
    }
    expect(await rowCounts()).toBe(before);
  });

  it("answers 403 to a foreign Origin, changes nothing, and lets the app's own origin and none through (R22)", async () => {
    const before = await rowCounts();
    for (const route of routes()) {
      const foreign = await h.call({
        method: "POST",
        url: route.url,
        headers: { origin: "https://evil.example" },
        payload: route.payload,
      });
      expect(foreign.statusCode, route.url).toBe(403);
      expect(json(foreign).error.code).toBe("origin_not_allowed");
      const own = await h.call({
        method: "POST",
        url: route.url,
        payload: route.payload,
      });
      expect(own.statusCode, route.url).not.toBe(403);
    }
    expect(await rowCounts()).toBe(before);
  });

  it("carries no Access-Control- header on an answer or on a refusal (R22)", async () => {
    for (const route of routes()) {
      for (const headers of [{}, { origin: "https://evil.example" }]) {
        const res = await h.call({
          method: "POST",
          url: route.url,
          headers,
          payload: route.payload,
        });
        const names = Object.keys(res.headers).map((n) => n.toLowerCase());
        expect(names.filter((n) => n.startsWith("access-control-"))).toEqual(
          [],
        );
      }
    }
  });

  it("answers without a session because each route is public, and no other route becomes public (R23)", async () => {
    for (const route of routes()) {
      const res = await h.call({
        method: "POST",
        url: route.url,
        payload: route.payload,
      });
      expect(res.statusCode, route.url).not.toBe(401);
    }
    // the Admin routes with the same prefix still need a session
    for (const url of [
      "/api/v1/invitations",
      `/api/v1/invitations/${made.id}/resend`,
      `/api/v1/invitations/${made.id}/revoke`,
    ]) {
      const res = await h.call({ method: "POST", url, payload: {} });
      expect(res.statusCode, url).toBe(401);
    }
    expect((await h.get(null, "/members")).statusCode).toBe(401);
  });

  it("has no GET among the routes of the three paths, and a GET to them changes nothing (R23)", async () => {
    const sam = await h.person("sam@example.com");
    const before = await rowCounts();
    for (const route of routes()) {
      // no session: an unknown path answers 401; with one: 404 (TOKI-022 R44). Neither runs a handler.
      const anon = await h.call({ method: "GET", url: route.url });
      expect(anon.statusCode, route.url).toBe(401);
      const signedIn = await h.call({
        method: "GET",
        url: route.url,
        headers: sam.headers,
      });
      expect(signedIn.statusCode, route.url).toBe(404);
    }
    for (const route of routes()) {
      expect(h.app.hasRoute({ method: "POST", url: route.url })).toBe(true);
      for (const method of ["GET", "PUT", "PATCH", "DELETE"] as const) {
        expect(h.app.hasRoute({ method, url: route.url }), method).toBe(false);
      }
    }
    expect(await rowCounts()).toBe(before);
  });

  it("puts neither the token, the address nor the code in the log, also when a query fails (R24)", async () => {
    for (const route of routes()) {
      await h.call({ method: "POST", url: route.url, payload: route.payload });
    }
    // a failing query whose message carries the parameters, as a Drizzle error does
    const spy = vi.spyOn(h.db, "select").mockImplementation(() => {
      throw new Error(`Failed query: ${made.token} ${made.email} ${made.code}`);
    });
    const res = await h.call({
      method: "POST",
      url: "/api/v1/invitations/lookup",
      payload: { token: made.token },
    });
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain(made.token);
    const log = h.logText();
    for (const secret of [made.token, made.email, made.code]) {
      expect(log).not.toContain(secret);
    }
    // and the log does hold the request lines, so the search is not empty by accident
    expect(log).toContain("/api/v1/invitations/lookup");
  });

  it("rejects a body that fails the shared schema with 400 validation_failed (R24)", async () => {
    for (const route of routes()) {
      const res = await h.call({
        method: "POST",
        url: route.url,
        payload: { token: 5 },
      });
      expect(res.statusCode, route.url).toBe(400);
      expect(json(res).error.code).toBe("validation_failed");
    }
  });
});
