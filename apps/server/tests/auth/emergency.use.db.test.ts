import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  onSessionsEnded,
  type EndReason,
} from "../../src/modules/auth/index.js";
import {
  printLink,
  sameBytesOtherText,
  URL_USE,
  useLink,
} from "./emergency-fixtures.js";
import { bearer, makeSession } from "./session-fixtures.js";
import { createHarness, ORIGIN, type Harness } from "./test-harness.js";

let h: Harness;
let stopListening: () => void;
const heard: Array<{ ids: string[]; reason: EndReason }> = [];
beforeAll(async () => {
  h = await createHarness();
  stopListening = onSessionsEnded((ids, reason) => {
    heard.push({ ids, reason });
  });
});
afterAll(async () => {
  stopListening?.();
  await h?.close();
});
beforeEach(() => {
  heard.length = 0;
});

const cookieOf = (res: { headers: Record<string, unknown> }) =>
  /^toki_session=([^;]+)/.exec(String(res.headers["set-cookie"] ?? ""))?.[1];
const sessionsOf = async (userId: string) =>
  await h.sql`select id, kind, ended_at, ended_reason from sessions where user_id = ${userId} order by created_at`;
const whoAmI = (headers: Record<string, string>) =>
  h.call({ method: "GET", url: "/api/v1/auth/session", headers });
const snapshot = async () =>
  JSON.stringify([
    await h.sql`select * from emergency_links order by id`,
    await h.sql`select id, ended_at from sessions order by id`,
  ]);

describe("using a link (TOKI-026 R26 to R34)", () => {
  it("signs the member in with a cookie that has the attributes of every other session", async () => {
    const id = await h.addUser("cookie@example.com", { display_name: "Cass" });
    const { token } = await printLink(h, id);
    const res = await useLink(h, token);
    expect(res.statusCode).toBe(200);
    expect(h.json(res)).toMatchObject({
      user: { id, email: "cookie@example.com", displayName: "Cass" },
    });
    expect(h.json(res)).not.toHaveProperty("token");
    expect(String(res.headers["set-cookie"])).toMatch(
      /^toki_session=[^;]{43}; Max-Age=\d+; Path=\/; HttpOnly; SameSite=Lax$/,
    );
    const rows = await sessionsOf(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("cookie");
    const me = await whoAmI(h.withCookie(cookieOf(res)!));
    expect(me.statusCode).toBe(200);
    expect(h.json(me)).toMatchObject({ user: { id } });
  });

  it("returns the token and no cookie for the token transport", async () => {
    const id = await h.addUser("token@example.com");
    const { token } = await printLink(h, id);
    const res = await useLink(h, token, { transport: "token" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
    const secret = (h.json(res) as unknown as { token: string }).token;
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await sessionsOf(id))[0]!.kind).toBe("token");
    expect((await whoAmI(bearer(secret))).statusCode).toBe(200);
  });

  it("stores the user agent of the request and writes the session id on the link", async () => {
    const id = await h.addUser("ua@example.com");
    const { token } = await printLink(h, id);
    await useLink(h, token, { headers: { "user-agent": "TestBrowser/1.0" } });
    const [session] =
      await h.sql`select id, user_agent from sessions where user_id = ${id}`;
    expect(session!.user_agent).toBe("TestBrowser/1.0");
    const [link] =
      await h.sql`select session_id, used_at from emergency_links where user_id = ${id}`;
    expect(link!.session_id).toBe(session!.id);
    expect(link!.used_at).not.toBeNull();
  });

  it("works once: a second use answers emergency_link_invalid and the first session still works (TS-223)", async () => {
    const id = await h.addUser("once@example.com");
    const { token } = await printLink(h, id);
    const first = await useLink(h, token);
    const second = await useLink(h, token);
    expect(second.statusCode).toBe(400);
    expect(h.json(second).error.code).toBe("emergency_link_invalid");
    expect(await sessionsOf(id)).toHaveLength(1);
    expect((await whoAmI(h.withCookie(cookieOf(first)!))).statusCode).toBe(200);
  });

  it("accepts a link at 9 minutes 59 seconds and refuses it at exactly 10 minutes (TS-222)", async () => {
    const early = await h.addUser("early@example.com");
    const late = await h.addUser("late@example.com");
    const a = await printLink(h, early);
    const b = await printLink(h, late);
    h.clock.advance(599_999);
    expect((await useLink(h, a.token)).statusCode).toBe(200);
    h.clock.advance(1);
    const refused = await useLink(h, b.token);
    expect(refused.statusCode).toBe(400);
    expect(h.json(refused).error.code).toBe("emergency_link_invalid");
    expect(await sessionsOf(late)).toHaveLength(0);
  });

  it("answers an unknown, a used, a cancelled and an expired token with the same body and changes no table (R28)", async () => {
    const used = await h.addUser("used@example.com");
    const cancelled = await h.addUser("cancelled@example.com");
    const expired = await h.addUser("expired@example.com");
    const usedLink = await printLink(h, used);
    await useLink(h, usedLink.token);
    const cancelledLink = await printLink(h, cancelled);
    await printLink(h, cancelled);
    const expiredLink = await printLink(h, expired);
    h.clock.advance(700_000);
    const before = await snapshot();
    const answers = [];
    for (const token of [
      "z".repeat(43),
      usedLink.token,
      cancelledLink.token,
      expiredLink.token,
    ]) {
      const res = await useLink(h, token);
      expect(res.statusCode).toBe(400);
      answers.push(h.json(res));
    }
    for (const body of answers) {
      expect(body).toEqual(answers[0]);
      expect(body.error.code).toBe("emergency_link_invalid");
      expect(body.error).not.toHaveProperty("details");
    }
    expect(await snapshot()).toBe(before);
  });

  it("finds a link only by the string that was printed (R29)", async () => {
    const id = await h.addUser("bytes@example.com");
    const { token } = await printLink(h, id);
    const other = sameBytesOtherText(token);
    expect(other).not.toBe(token);
    expect(
      Buffer.from(other, "base64url").equals(Buffer.from(token, "base64url")),
    ).toBe(true);
    const res = await useLink(h, other);
    expect(res.statusCode).toBe(400);
    expect(h.json(res).error.code).toBe("emergency_link_invalid");
    expect((await useLink(h, token)).statusCode).toBe(200);
  });

  it("answers validation_failed for a token of 42 characters and runs no statement", async () => {
    h.statements.length = 0;
    const res = await useLink(h, "a".repeat(42));
    expect(res.statusCode).toBe(400);
    expect(h.json(res).error.code).toBe("validation_failed");
    expect(JSON.stringify(h.json(res))).not.toContain("a".repeat(42));
    expect(h.statements).toEqual([]);
  });

  it("creates one session when two requests with the right token arrive together (R30)", async () => {
    const id = await h.addUser("both@example.com");
    const { token } = await printLink(h, id);
    const [a, b] = await Promise.all([useLink(h, token), useLink(h, token)]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 400]);
    expect(await sessionsOf(id)).toHaveLength(1);
  });

  it("answers account_deactivated for a member deactivated after the link was printed, uses the link up, and creates no session (R31)", async () => {
    const id = await h.addUser("gone@example.com");
    const { token } = await printLink(h, id);
    await h.sql`update users set status = 'deactivated' where id = ${id}`;
    const res = await useLink(h, token);
    expect(res.statusCode).toBe(400);
    expect(h.json(res).error.code).toBe("account_deactivated");
    expect(await sessionsOf(id)).toHaveLength(0);
    const [link] =
      await h.sql`select used_at, session_id from emergency_links where user_id = ${id}`;
    expect(link!.used_at).not.toBeNull();
    expect(link!.session_id).toBeNull();
    const again = await useLink(h, token);
    expect(h.json(again).error.code).toBe("emergency_link_invalid");
  });

  it("leaves the link unused when creating the session fails, and the same request then succeeds (R32)", async () => {
    const id = await h.addUser("boom@example.com");
    const { token } = await printLink(h, id);
    await h.sql.unsafe(`
      create function fail_session() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
      create trigger fail_session_trigger before insert on sessions
        for each row when (NEW.user_agent = 'fail-session') execute function fail_session();`);
    try {
      const failed = await useLink(h, token, {
        headers: { "user-agent": "fail-session" },
      });
      expect(failed.statusCode).toBe(500);
      expect(failed.body).not.toContain(token);
      const [link] =
        await h.sql`select used_at from emergency_links where user_id = ${id}`;
      expect(link!.used_at).toBeNull();
    } finally {
      await h.sql.unsafe(
        "drop trigger fail_session_trigger on sessions; drop function fail_session();",
      );
    }
    expect((await useLink(h, token)).statusCode).toBe(200);
  });

  it("ends the session of the browser as replaced when the request carries its cookie (R33)", async () => {
    const id = await h.addUser("swap@example.com");
    const earlier = await h.signIn("swap@example.com");
    const { token } = await printLink(h, id);
    heard.length = 0;
    const res = await useLink(h, token, {
      headers: h.withCookie(earlier.secret),
    });
    expect(res.statusCode).toBe(200);
    const [row] =
      await h.sql`select id, ended_reason from sessions where secret_hash = ${(await import("../../src/modules/auth/secrets.js")).sha256(earlier.secret)}`;
    expect(row!.ended_reason).toBe("replaced");
    expect(heard).toEqual([{ ids: [row!.id], reason: "replaced" }]);
    expect(cookieOf(res)).toBeDefined();
  });

  it("leaves a session carried only by a bearer token live", async () => {
    const id = await h.addUser("bearer@example.com");
    const earlier = await makeSession(h, id);
    const { token } = await printLink(h, id);
    const res = await useLink(h, token, { headers: bearer(earlier.secret) });
    expect(res.statusCode).toBe(200);
    expect((await whoAmI(bearer(earlier.secret))).statusCode).toBe(200);
    expect(heard).toEqual([]);
  });

  it("refuses a form body with 415 and a foreign Origin with 403, and uses nothing up", async () => {
    const id = await h.addUser("guards@example.com");
    const { token } = await printLink(h, id);
    const form = await h.call({
      method: "POST",
      url: URL_USE,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `token=${token}`,
    });
    expect(form.statusCode).toBe(415);
    const foreign = await h.call({
      method: "POST",
      url: URL_USE,
      headers: { origin: "https://evil.example" },
      payload: { token },
    });
    expect(foreign.statusCode).toBe(403);
    const own = await h.call({
      method: "POST",
      url: URL_USE,
      headers: { origin: ORIGIN },
      payload: { token },
    });
    expect(own.statusCode).toBe(200);
  });

  it("creates no session on a GET: the path answers 401 without a session", async () => {
    const id = await h.addUser("get@example.com");
    const { token } = await printLink(h, id);
    const res = await h.call({
      method: "GET",
      url: `${URL_USE}?token=${token}`,
    });
    expect(res.statusCode).toBe(401);
    expect(await sessionsOf(id)).toHaveLength(0);
  });

  it("writes the used and rejected lines with ids only (R35, R36)", async () => {
    const mark = h.logText().length;
    const ok = await h.addUser("log-ok@example.com");
    const gone = await h.addUser("log-gone@example.com");
    const okLink = await printLink(h, ok);
    const goneLink = await printLink(h, gone);
    await useLink(h, okLink.token);
    await h.sql`update users set status = 'deactivated' where id = ${gone}`;
    await useLink(h, goneLink.token);
    await useLink(h, "y".repeat(43));
    const log = h.logText().slice(mark);
    const lines = log
      .split("\n")
      .filter((l) => l.includes("emergency_link"))
      .map((l) => JSON.parse(l) as Record<string, unknown>);
    const used = lines.find((l) => l.msg === "emergency_link_used")!;
    const [session] =
      await h.sql`select id from sessions where user_id = ${ok}`;
    expect(used).toMatchObject({
      level: 30,
      userId: ok,
      sessionId: session!.id,
    });
    expect(used).toHaveProperty("linkId");
    const rejected = lines.filter((l) => l.msg === "emergency_link_rejected");
    expect(rejected.map((l) => l.reason).sort()).toEqual([
      "deactivated",
      "invalid",
    ]);
    expect(rejected.every((l) => l.level === 40)).toBe(true);
    for (const secret of [
      okLink.token,
      goneLink.token,
      "y".repeat(43),
      "log-ok@example.com",
      "log-gone@example.com",
    ]) {
      expect(log).not.toContain(secret);
    }
    const { hashLinkToken } =
      await import("../../src/modules/auth/emergency.js");
    expect(log).not.toContain(hashLinkToken(okLink.token));
    expect(log).not.toContain(`/emergency#`);
  });
});
