import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

const DAY = 86_400_000;
let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const protectedGet = (
  x: Harness,
  secret?: string,
  via: "cookie" | "token" = "cookie",
) =>
  x.call({
    method: "GET",
    url: "/api/v1/protected",
    headers: secret
      ? via === "cookie"
        ? x.withCookie(secret)
        : { authorization: `Bearer ${secret}` }
      : {},
  });

describe("cookie and token (R21, R22, R23)", () => {
  it("sets the development cookie, no body token (R21)", async () => {
    await h.addUser("dev@example.com");
    const { res } = await h.signIn("dev@example.com");
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(
      /^toki_session=[A-Za-z0-9_-]{43}; Max-Age=2592000; Path=\/; HttpOnly; SameSite=Lax$/,
    );
    expect(h.json(res).token).toBeUndefined();
  });

  it("returns a token in the body and no cookie for the token transport (R22)", async () => {
    await h.addUser("tok@example.com");
    const { res, secret } = await h.signIn("tok@example.com", "token");
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await protectedGet(h, secret, "token")).statusCode).toBe(200);
  });

  it("stores only the SHA-256 hash and the first 512 characters of the user agent (R23, R35)", async () => {
    const id = await h.addUser("hash@example.com");
    const { secret } = await h.signIn("hash@example.com", "cookie", {
      headers: { "user-agent": "U".repeat(2000) },
    });
    const { sha256 } = await import("./secrets.js");
    const rows = await h.sql`select * from sessions where user_id = ${id}`;
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.secret_hash).toBe(sha256(secret));
    for (const value of Object.values(row))
      expect(String(value)).not.toContain(secret);
    expect(row.kind).toBe("cookie");
    expect(row.user_agent).toBe("U".repeat(512));
    const tok = await h.signIn("hash@example.com", "token");
    const [t] =
      await h.sql`select kind from sessions where secret_hash = ${sha256(tok.secret)}`;
    expect(t!.kind).toBe("token");
  });
});

describe("the check (R24 to R27, R44)", () => {
  it("answers 401 unauthenticated without a session and 200 with one (R24)", async () => {
    await h.addUser("chk@example.com");
    const none = await protectedGet(h);
    expect(none.statusCode).toBe(401);
    expect(h.json(none).error.code).toBe("unauthenticated");
    const { secret } = await h.signIn("chk@example.com");
    expect((await protectedGet(h, secret)).statusCode).toBe(200);
  });

  it("is valid at exactly 30 days, refused after, and a use on day 29 moves the end (R25)", async () => {
    await h.addUser("age@example.com");
    const a = await h.signIn("age@example.com");
    h.clock.advance(30 * DAY);
    expect((await protectedGet(h, a.secret)).statusCode).toBe(200);
    h.clock.advance(30 * DAY + 1);
    const refused = await protectedGet(h, a.secret);
    expect(refused.statusCode).toBe(401);
    expect(h.json(refused).error.code).toBe("session_ended");

    const b = await h.signIn("age@example.com");
    h.clock.advance(29 * DAY);
    expect((await protectedGet(h, b.secret)).statusCode).toBe(200);
    h.clock.advance(29 * DAY);
    expect((await protectedGet(h, b.secret)).statusCode).toBe(200);
  });

  it("works with the test clock set years from real time", async () => {
    await h.addUser("far@example.com");
    h.clock.set(Date.UTC(2041, 5, 1));
    const a = await h.signIn("far@example.com");
    expect((await protectedGet(h, a.secret)).statusCode).toBe(200);
    h.clock.advance(31 * DAY);
    expect(h.json(await protectedGet(h, a.secret)).error.code).toBe(
      "session_ended",
    );
  });

  it("sets the cookie again on every response of a cookie session, not for a token (R26)", async () => {
    await h.addUser("renew@example.com");
    const c = await h.signIn("renew@example.com");
    const res = await protectedGet(h, c.secret);
    expect(String(res.headers["set-cookie"])).toBe(
      `toki_session=${c.secret}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`,
    );
    const unknownPath = await h.call({
      method: "GET",
      url: "/api/v1/nope",
      headers: h.withCookie(c.secret),
    });
    expect(unknownPath.statusCode).toBe(404);
    expect(String(unknownPath.headers["set-cookie"])).toContain(c.secret);
    const t = await h.signIn("renew@example.com", "token");
    expect(
      (await protectedGet(h, t.secret, "token")).headers["set-cookie"],
    ).toBeUndefined();
  });

  it("answers account_deactivated for a deactivated account, also when the session ended (R27)", async () => {
    const id = await h.addUser("deact@example.com");
    const a = await h.signIn("deact@example.com");
    await h.sql`update users set status = 'deactivated' where id = ${id}`;
    const res = await protectedGet(h, a.secret);
    expect(res.statusCode).toBe(401);
    expect(h.json(res).error.code).toBe("account_deactivated");
    await h.sql`update sessions set ended_at = now(), ended_reason = 'deactivated' where user_id = ${id}`;
    expect(h.json(await protectedGet(h, a.secret)).error.code).toBe(
      "account_deactivated",
    );
  });

  it("notices a deactivation between two requests (R55)", async () => {
    const id = await h.addUser("between@example.com");
    const a = await h.signIn("between@example.com");
    expect((await protectedGet(h, a.secret)).statusCode).toBe(200);
    await h.sql`update users set status = 'deactivated' where id = ${id}`;
    expect(h.json(await protectedGet(h, a.secret)).error.code).toBe(
      "account_deactivated",
    );
  });

  it("lets the header win over a stale cookie and refuses a secret sent the other way (R44)", async () => {
    await h.addUser("way@example.com");
    const t = await h.signIn("way@example.com", "token");
    const c = await h.signIn("way@example.com", "cookie");
    const stale = await h.call({
      method: "GET",
      url: "/api/v1/protected",
      headers: {
        authorization: `Bearer ${t.secret}`,
        ...h.withCookie("stale-value"),
      },
    });
    expect(stale.statusCode).toBe(200);
    expect((await protectedGet(h, c.secret, "token")).statusCode).toBe(401);
    expect(h.json(await protectedGet(h, t.secret, "cookie")).error.code).toBe(
      "unauthenticated",
    );
    expect(
      h.json(await protectedGet(h, "unknown-secret", "cookie")).error.code,
    ).toBe("unauthenticated");
  });

  it("reads the cookie when the Authorization header is of another scheme", async () => {
    await h.addUser("basic@example.com");
    const { secret } = await h.signIn("basic@example.com");
    const res = await h.call({
      method: "GET",
      url: "/api/v1/protected",
      headers: { authorization: "Basic dXNlcjpwYXNz", ...h.withCookie(secret) },
    });
    expect(res.statusCode).toBe(200);
    const none = await h.call({
      method: "GET",
      url: "/api/v1/protected",
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(h.json(none).error.code).toBe("unauthenticated");
  });

  it("answers 401 for an unknown path without a session and 404 with one (R44)", async () => {
    await h.addUser("path@example.com");
    const none = await h.call({ method: "GET", url: "/api/v1/does/not/exist" });
    expect(none.statusCode).toBe(401);
    const { secret } = await h.signIn("path@example.com");
    const signedIn = await h.call({
      method: "GET",
      url: "/api/v1/does/not/exist",
      headers: h.withCookie(secret),
    });
    expect(signedIn.statusCode).toBe(404);
  });

  it("each exchange creates its own session; one does not sign in another client (R31)", async () => {
    await h.addUser("own@example.com");
    const a = await h.signIn("own@example.com");
    const b = await h.signIn("own@example.com");
    expect(a.secret).not.toBe(b.secret);
    expect((await protectedGet(h, a.secret)).statusCode).toBe(200);
    expect((await protectedGet(h, b.secret)).statusCode).toBe(200);
    expect((await protectedGet(h)).statusCode).toBe(401);
  });
});
