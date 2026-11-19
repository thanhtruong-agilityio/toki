import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const sessions = async (userId?: string) =>
  userId
    ? h.sql`select * from sessions where user_id = ${userId}`
    : h.sql`select * from sessions`;

async function ask(email: string) {
  h.clock.advance(61_000);
  const res = await h.requestCode(email);
  await h.flush();
  return { requestId: h.json(res).requestId as string, code: (() => {
    try { return h.lastCode(); } catch { return "000000"; }
  })() };
}
const wrong = (code: string) => (code === "111111" ? "222222" : "111111");

describe("exchange (R10 to R16)", () => {
  it("creates one session and returns the user, with the cookie and no token (R10, R21)", async () => {
    const id = await h.addUser("sam@example.com", { display_name: "Sam", role: "admin", language: "vi" });
    const { requestId, code } = await ask("sam@example.com");
    const res = await h.exchange(requestId, code, {}, { headers: { "user-agent": "UA/1" } });
    expect(res.statusCode).toBe(200);
    expect(h.json(res)).toEqual({
      user: { id, email: "sam@example.com", displayName: "Sam", role: "admin", language: "vi" },
    });
    expect(String(res.headers["set-cookie"])).toContain("toki_session=");
    expect((await sessions(id))).toHaveLength(1);
  });

  it("refuses the right digits with another requestId (R11, R16)", async () => {
    await h.addUser("a@example.com");
    await h.addUser("b@example.com");
    const a = await ask("a@example.com");
    const b = await ask("b@example.com");
    const res = await h.exchange(b.requestId, a.code);
    expect(["code_incorrect", "code_expired"]).toContain(h.json(res).error.code);
    const unknown = await h.exchange("x".repeat(43), a.code);
    expect(h.json(unknown).error.code).toBe("code_expired");
    expect(unknown.statusCode).toBe(400);
  });

  it("counts wrong tries 4,3,2,1, then locks, and refuses the right code (R12, R13)", async () => {
    await h.addUser("lock@example.com");
    const { requestId, code } = await ask("lock@example.com");
    for (const left of [4, 3, 2, 1]) {
      const res = await h.exchange(requestId, wrong(code));
      expect(res.statusCode).toBe(400);
      expect(h.json(res).error.code).toBe("code_incorrect");
      expect(h.json(res).error.details.triesLeft).toBe(left);
    }
    const fifth = await h.exchange(requestId, wrong(code));
    expect(h.json(fifth).error.code).toBe("code_locked");
    const right = await h.exchange(requestId, code);
    expect(h.json(right).error.code).toBe("code_locked");
    expect(await sessions()).not.toContainEqual(expect.objectContaining({ email: "lock" }));
    // a newer code cancels the locked one: now code_expired
    await ask("lock@example.com");
    expect(h.json(await h.exchange(requestId, code)).error.code).toBe("code_expired");
  });

  it("accepts at 9:59 and refuses at exactly 10:00 without a wrong try (R10, R14)", async () => {
    await h.addUser("time@example.com");
    const early = await ask("time@example.com");
    h.clock.advance(599_000);
    expect((await h.exchange(early.requestId, early.code)).statusCode).toBe(200);

    const late = await ask("time@example.com");
    h.clock.advance(600_000);
    const res = await h.exchange(late.requestId, late.code);
    expect(res.statusCode).toBe(400);
    expect(h.json(res).error.code).toBe("code_expired");
    const [row] = await h.sql`select wrong_tries from login_codes where email = 'time@example.com' order by created_at desc limit 1`;
    expect(row!.wrong_tries).toBe(0);
  });

  it("works once (R15)", async () => {
    await h.addUser("once@example.com");
    const { requestId, code } = await ask("once@example.com");
    expect((await h.exchange(requestId, code)).statusCode).toBe(200);
    const again = await h.exchange(requestId, code);
    expect(h.json(again).error.code).toBe("code_expired");
  });
});

describe("account status and unknown addresses (R18, R19)", () => {
  it("uses up the code and creates no session for a Deactivated account (R18)", async () => {
    const id = await h.addUser("off@example.com", { status: "deactivated" });
    const { requestId, code } = await ask("off@example.com");
    const res = await h.exchange(requestId, code);
    expect(res.statusCode).toBe(400);
    expect(h.json(res).error.code).toBe("account_deactivated");
    expect(await sessions(id)).toHaveLength(0);
    const [row] = await h.sql`select used_at from login_codes where email = 'off@example.com'`;
    expect(row!.used_at).not.toBeNull();
    expect(h.json(await h.exchange(requestId, code)).error.code).toBe("code_expired");
  });

  it("never accepts a code for an address with no account, in the order of R12 to R14 (R19)", async () => {
    const { requestId } = await ask("ghost@example.com");
    for (const left of [4, 3, 2, 1]) {
      const res = await h.exchange(requestId, "123456");
      expect(h.json(res).error.code).toBe("code_incorrect");
      expect(h.json(res).error.details.triesLeft).toBe(left);
    }
    expect(h.json(await h.exchange(requestId, "123456")).error.code).toBe("code_locked");
    expect(h.json(await h.exchange(requestId, "123456")).error.code).toBe("code_locked");

    const other = await ask("ghost2@example.com");
    h.clock.advance(600_000);
    expect(h.json(await h.exchange(other.requestId, "123456")).error.code).toBe("code_expired");
  });
});

describe("validation (R20)", () => {
  it("refuses a bad code or a missing requestId and does not count a wrong try", async () => {
    await h.addUser("val@example.com");
    const { requestId, code } = await ask("val@example.com");
    const bodies = [
      { requestId, code: "12345" },
      { requestId, code: "1234567" },
      { requestId, code: "12345a" },
      { code },
      { requestId },
    ];
    for (const payload of bodies) {
      const res = await h.call({ method: "POST", url: "/api/v1/auth/sessions", payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(h.json(res).error.code).toBe("validation_failed");
    }
    const [row] = await h.sql`select wrong_tries from login_codes where email = 'val@example.com' order by created_at desc limit 1`;
    expect(row!.wrong_tries).toBe(0);
  });
});

describe("concurrency (R17)", () => {
  it("gives exactly one session for two exchanges with the right code", async () => {
    const id = await h.addUser("race@example.com");
    const { requestId, code } = await ask("race@example.com");
    const results = await Promise.all([
      h.exchange(requestId, code),
      h.exchange(requestId, code),
    ]);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await sessions(id)).toHaveLength(1);
  });

  it("never gives more than 5 wrong tries in total, however many arrive together", async () => {
    await h.addUser("race2@example.com");
    const { requestId, code } = await ask("race2@example.com");
    const results = await Promise.all(
      Array.from({ length: 12 }, () => h.exchange(requestId, wrong(code))),
    );
    const codes = results.map((r) => h.json(r).error.code as string);
    expect(codes.filter((c) => c === "code_incorrect").length).toBeLessThanOrEqual(4);
    expect(codes.filter((c) => c === "code_locked").length).toBeGreaterThanOrEqual(1);
    for (const c of codes) expect(["code_incorrect", "code_locked"]).toContain(c);
    const [row] = await h.sql`select wrong_tries from login_codes where email = 'race2@example.com'`;
    expect(row!.wrong_tries).toBe(5);
  });
});
