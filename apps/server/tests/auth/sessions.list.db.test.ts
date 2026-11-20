import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, DAY, makeSession } from "./session-fixtures.js";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const list = (headers: Record<string, string>) =>
  h.call({ method: "GET", url: "/api/v1/auth/sessions", headers });

type Item = {
  id: string;
  current: boolean;
  deviceKind: string;
  browser: string;
  lastUsedAt: string;
};

describe("GET /auth/sessions (TOKI-026 R1 to R6)", () => {
  it("lists the live sessions of the person with exactly five fields", async () => {
    const sam = await h.addUser("sam@example.com");
    const other = await h.addUser("other@example.com");
    const cookie = await h.signIn("sam@example.com", "cookie", {
      headers: { "user-agent": CHROME_WIN },
    });
    const phone = await makeSession(h, sam, {
      userAgent: SAFARI_IPHONE,
      idleMs: 2 * DAY,
    });
    const edge = await makeSession(h, sam, { idleMs: 30 * DAY }); // exactly 30 days: live
    await makeSession(h, sam, { idleMs: 31 * DAY }); // ran out of time
    await makeSession(h, sam, { endedAs: "revoked" }); // ended
    await makeSession(h, other); // another person

    const res = await list(h.withCookie(cookie.secret));
    expect(res.statusCode).toBe(200);
    const body = h.json(res) as unknown as { sessions: Item[] };
    expect(Object.keys(body)).toEqual(["sessions"]);
    expect(body.sessions.map((s) => s.id).sort()).toEqual(
      [
        (
          await h.sql`select id from sessions where user_id = ${sam} and kind = 'cookie'`
        )[0]!.id as string,
        phone.id,
        edge.id,
      ].sort(),
    );
    for (const item of body.sessions) {
      expect(Object.keys(item).sort()).toEqual([
        "browser",
        "current",
        "deviceKind",
        "id",
        "lastUsedAt",
      ]);
    }
    const iphone = body.sessions.find((s) => s.id === phone.id)!;
    expect(iphone).toMatchObject({
      current: false,
      deviceKind: "phone",
      browser: "safari",
    });
    const mine = body.sessions.find((s) => s.current)!;
    expect(mine).toMatchObject({ deviceKind: "desktop", browser: "chrome" });
  });

  it("marks only the session of the request, also with a token", async () => {
    const id = await h.addUser("token@example.com");
    const a = await makeSession(h, id);
    const b = await makeSession(h, id);
    for (const mine of [a, b]) {
      const body = h.json(await list(bearer(mine.secret))) as unknown as {
        sessions: Item[];
      };
      expect(body.sessions.filter((s) => s.current).map((s) => s.id)).toEqual([
        mine.id,
      ]);
    }
  });

  it("orders by last use, latest first, and by id when the times are equal", async () => {
    const id = await h.addUser("order@example.com");
    const old = await makeSession(h, id, { idleMs: 5 * DAY });
    const mid = await makeSession(h, id, { idleMs: 3 * DAY });
    const tie1 = await makeSession(h, id, { idleMs: 3 * DAY });
    const mine = await makeSession(h, id);
    await h.sql`update sessions set last_used_at = (select last_used_at from sessions where id = ${mid.id}) where id = ${tie1.id}`;
    const body = h.json(await list(bearer(mine.secret))) as unknown as {
      sessions: Item[];
    };
    const ids = body.sessions.map((s) => s.id);
    expect(ids[0]).toBe(mine.id);
    expect(ids.at(-1)).toBe(old.id);
    const tied = [mid.id, tie1.id].sort();
    expect(ids.slice(1, 3)).toEqual(tied);
  });

  it("gives the current item the time of the clock at the request (R5)", async () => {
    const id = await h.addUser("clock@example.com");
    const mine = await makeSession(h, id, { idleMs: 4 * DAY });
    const body = h.json(await list(bearer(mine.secret))) as unknown as {
      sessions: Item[];
    };
    expect(body.sessions.find((s) => s.current)!.lastUsedAt).toBe(
      new Date(h.clock.now()).toISOString(),
    );
  });

  it("answers for a header of 2,000 characters stored as 512", async () => {
    const id = await h.addUser("long@example.com");
    const mine = await makeSession(h, id, { userAgent: "x".repeat(2000) });
    const res = await list(bearer(mine.secret));
    expect(res.statusCode).toBe(200);
    expect(
      (h.json(res) as unknown as { sessions: Item[] }).sessions[0],
    ).toMatchObject({ deviceKind: "unknown", browser: "other" });
  });

  it("shows unknown and unknown for a session with no header", async () => {
    const id = await h.addUser("none@example.com");
    const mine = await makeSession(h, id);
    const body = h.json(await list(bearer(mine.secret))) as unknown as {
      sessions: Item[];
    };
    expect(body.sessions[0]).toMatchObject({
      deviceKind: "unknown",
      browser: "unknown",
    });
  });
});
