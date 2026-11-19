import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const from = (ip: string) => ({ remoteAddress: ip });
const codes = (email: string, ip: string) => h.requestCode(email, from(ip));
const rowCount = async () =>
  Number((await h.sql`select count(*) from login_codes`)[0]!.count);

describe("limit per network address (R56)", () => {
  it("accepts the 20th and refuses the 21st with rate_limited and Retry-After, creating nothing", async () => {
    const ip = "192.0.2.1";
    for (let i = 0; i < 20; i++) {
      // a malformed address still counts, and writes no row
      expect((await codes("bad", ip)).statusCode).toBe(400);
    }
    const mailBefore = h.mail.calls.length;
    const rows = await rowCount();
    const res = await codes("sam@example.com", ip);
    expect(res.statusCode).toBe(429);
    expect(h.json(res).error.code).toBe("rate_limited");
    expect(h.json(res).error.details.retryAfterSeconds).toBe(900);
    expect(res.headers["retry-after"]).toBe("900");
    await h.flush();
    expect(await rowCount()).toBe(rows);
    expect(h.mail.calls.length).toBe(mailBefore);
  });

  it("leaves the count unchanged for a client that keeps sending, then accepts it after the wait", async () => {
    const ip = "192.0.2.2";
    for (let i = 0; i < 20; i++) await codes("bad", ip);
    const first = await codes("bad", ip);
    expect(h.json(first).error.details.retryAfterSeconds).toBe(900);
    h.clock.advance(300_000);
    const later = await codes("bad", ip);
    expect(h.json(later).error.code).toBe("rate_limited");
    expect(h.json(later).error.details.retryAfterSeconds).toBe(600);
    h.clock.advance(600_000);
    expect((await codes("bad", ip)).statusCode).toBe(400); // accepted by the limit, refused by validation
  });

  it("counts per route and per address", async () => {
    const ip = "192.0.2.3";
    for (let i = 0; i < 20; i++) await codes("bad", ip);
    expect(h.json(await codes("bad", ip)).error.code).toBe("rate_limited");
    const other = await h.exchange("r".repeat(43), "123456", {}, from(ip));
    expect(h.json(other).error.code).toBe("code_expired");
    expect((await codes("bad", "192.0.2.4")).statusCode).toBe(400);
  });

  it("answers rate_limited first when code_request_limit applies too", async () => {
    const ip = "192.0.2.5";
    const email = "both@example.com";
    for (let i = 0; i < 5; i++) {
      expect((await codes(email, ip)).statusCode).toBe(200);
      h.clock.advance(61_000);
    }
    for (let i = 0; i < 15; i++) await codes("bad", ip);
    const res = await codes(email, ip);
    expect(h.json(res).error.code).toBe("rate_limited");
  });

  it("makes no exchange attempt and leaves the wrong-try count alone on the sessions route", async () => {
    await h.addUser("tries@example.com");
    h.clock.advance(61_000);
    const asked = await h.requestCode("tries@example.com");
    await h.flush();
    const requestId = h.json(asked).requestId as string;
    const code = h.lastCode();
    const ip = "192.0.2.6";
    // 20 requests that touch no code: an unknown requestId counts toward the limit only
    for (let i = 0; i < 20; i++) {
      await h.exchange("u".repeat(43), "000000", {}, from(ip));
    }
    const tries = async () =>
      (
        await h.sql`select wrong_tries from login_codes where email = 'tries@example.com'`
      )[0]!.wrong_tries;
    expect(await tries()).toBe(0);
    const wrongOne = await h.exchange(
      requestId,
      code === "111111" ? "222222" : "111111",
      {},
      from(ip),
    );
    expect(h.json(wrongOne).error.code).toBe("rate_limited");
    expect(await tries()).toBe(0); // no attempt was made: the count did not move
    const rightOne = await h.exchange(requestId, code, {}, from(ip));
    expect(h.json(rightOne).error.code).toBe("rate_limited");
    const [made] = await h.sql`select count(*)::int as n from sessions`;
    expect(made!.n).toBe(0);
    const [used] =
      await h.sql`select used_at from login_codes where email = 'tries@example.com'`;
    expect(used!.used_at).toBeNull();
  });

  it("reopens after 15 minutes of the test clock and gives the same answer for a member and a stranger", async () => {
    await h.addUser("mem@example.com");
    const ip = "192.0.2.7";
    for (let i = 0; i < 20; i++) await codes("bad", ip);
    const a = await codes("mem@example.com", ip);
    const b = await codes("stranger@example.com", ip);
    expect(h.json(a)).toEqual(h.json(b));
    h.clock.advance(900_000);
    expect((await codes("mem@example.com", ip)).statusCode).toBe(200);
  });

  it("ignores X-Forwarded-For when the connection is not from a trusted proxy", async () => {
    const ip = "192.0.2.8";
    for (let i = 0; i < 20; i++) {
      await h.requestCode("bad", {
        ...from(ip),
        headers: { "x-forwarded-for": `203.0.113.${i}` },
      });
    }
    const res = await h.requestCode("bad", {
      ...from(ip),
      headers: { "x-forwarded-for": "203.0.113.200" },
    });
    expect(h.json(res).error.code).toBe("rate_limited");
  });

  it("counts a request that R5 refuses toward the 20", async () => {
    const ip = "192.0.2.9";
    await h.addUser("count@example.com");
    expect((await codes("count@example.com", ip)).statusCode).toBe(200);
    for (let i = 0; i < 19; i++) {
      const res = await codes("count@example.com", ip);
      expect(h.json(res).error.code).toBe("code_resend_too_soon");
    }
    const res = await codes("count@example.com", ip);
    expect(h.json(res).error.code).toBe("rate_limited");
  });

  it("counts a request that R4 refuses toward the 20", async () => {
    const ip = "192.0.2.10";
    const email = "r4count@example.com";
    for (let i = 0; i < 5; i++) {
      expect((await codes(email, ip)).statusCode).toBe(200);
      h.clock.advance(61_000);
    }
    for (let i = 0; i < 15; i++) {
      const res = await codes(email, ip);
      expect(h.json(res).error.code).toBe("code_request_limit");
    }
    const res = await codes(email, ip);
    expect(h.json(res).error.code).toBe("rate_limited");
  });
});
