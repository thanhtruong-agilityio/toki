import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const rows = (email?: string) =>
  email
    ? h.sql`select * from login_codes where email = ${email} order by created_at`
    : h.sql`select * from login_codes order by created_at`;

describe("request a code (R1 to R9)", () => {
  it("answers 200 with exactly the three fields, and mails an Active account once (R1, R2, R3)", async () => {
    await h.addUser("sam@example.com", { language: "vi" });
    const res = await h.requestCode("Sam@Example.com ");
    expect(res.statusCode).toBe(200);
    const body = h.json(res);
    expect(Object.keys(body).sort()).toEqual([
      "expiresInSeconds",
      "requestId",
      "resendAfterSeconds",
    ]);
    expect(body.expiresInSeconds).toBe(600);
    expect(body.resendAfterSeconds).toBe(60);
    expect(body.requestId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await h.flush();
    const sent = h.mail.calls.filter((c) => c.operation === "sendSignInMail");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.input).toMatchObject({
      to: "sam@example.com",
      language: "vi",
    });
    expect((sent[0]!.input as { code: string }).code).toMatch(/^[0-9]{6}$/);
  });

  it("mails a Deactivated account too (R2)", async () => {
    await h.addUser("gone@example.com", { status: "deactivated" });
    const before = h.mail.calls.length;
    expect((await h.requestCode("gone@example.com")).statusCode).toBe(200);
    await h.flush();
    expect(h.mail.calls.length).toBe(before + 1);
  });

  it("answers the same for an unknown address and sends no mail (R1, R9, R19)", async () => {
    const before = h.mail.calls.length;
    const res = await h.requestCode("nobody@example.com");
    expect(res.statusCode).toBe(200);
    expect(Object.keys(h.json(res)).sort()).toEqual([
      "expiresInSeconds",
      "requestId",
      "resendAfterSeconds",
    ]);
    await h.flush();
    expect(h.mail.calls.length).toBe(before);
    const [row] = await rows("nobody@example.com");
    expect(row!.user_id).toBeNull();
    expect(row!.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a new requestId for every accepted request (R1)", async () => {
    h.clock.advance(61_000);
    const a = h.json(await h.requestCode("sam@example.com")).requestId;
    h.clock.advance(61_000);
    const b = h.json(await h.requestCode("sam@example.com")).requestId;
    expect(a).not.toBe(b);
  });

  it("stores no digits and no requestId in the row, only keyed hashes (R40)", async () => {
    h.clock.advance(61_000);
    const res = await h.requestCode("sam@example.com");
    await h.flush();
    const requestId = h.json(res).requestId as string;
    const code = h.lastCode();
    const [row] = (await rows("sam@example.com")).slice(-1);
    for (const value of Object.values(row!)) {
      const text = String(value);
      expect(text.includes(requestId)).toBe(false);
      expect(text === code).toBe(false);
    }
    const { hashCode, sha256 } = await import("./secrets.js");
    const { SECRET } = await import("./test-harness.js");
    expect(row!.request_hash).toBe(sha256(requestId));
    expect(row!.code_hash).toBe(hashCode(SECRET, requestId, code));
    expect(row!.code_hash).not.toBe(hashCode("z".repeat(40), requestId, code));
  });

  it("refuses a malformed address with 400 validation_failed and writes no row (R7)", async () => {
    const before = (await rows()).length;
    const mailBefore = h.mail.calls.length;
    // 64 + 1 + 190 = 255 characters, every part valid: only the length refuses it
    const tooLong = `${"x".repeat(64)}@${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(58)}.com`;
    expect(tooLong).toHaveLength(255);
    for (const email of ["", "nope", "a@b", tooLong]) {
      const res = await h.requestCode(email);
      expect(res.statusCode, email).toBe(400);
      expect(h.json(res).error.code).toBe("validation_failed");
    }
    await h.flush();
    expect((await rows()).length).toBe(before);
    expect(h.mail.calls.length).toBe(mailBefore);
  });
});

describe("limits (R4, R5, R6, R42)", () => {
  it("refuses at 59 seconds with code_resend_too_soon and accepts at 60 (R5)", async () => {
    await h.addUser("lim1@example.com");
    expect((await h.requestCode("lim1@example.com")).statusCode).toBe(200);
    h.clock.advance(59_000);
    const early = await h.requestCode("lim1@example.com");
    expect(early.statusCode).toBe(429);
    expect(h.json(early).error.code).toBe("code_resend_too_soon");
    expect(h.json(early).error.details.retryAfterSeconds).toBe(1);
    expect(early.headers["retry-after"]).toBe("1");
    h.clock.advance(1000);
    expect((await h.requestCode("lim1@example.com")).statusCode).toBe(200);
  });

  it("rounds the wait up and equals the Retry-After header (R42)", async () => {
    await h.requestCode("lim2@example.com");
    h.clock.advance(800);
    const res = await h.requestCode("lim2@example.com");
    expect(h.json(res).error.details.retryAfterSeconds).toBe(60);
    expect(res.headers["retry-after"]).toBe("60");
  });

  it("refuses the 6th request in 15 minutes and accepts at exactly 15 (R4)", async () => {
    const e = "lim3@example.com";
    const mailBefore = h.mail.calls.length;
    await h.addUser(e);
    for (let i = 0; i < 5; i++) {
      expect((await h.requestCode(e)).statusCode, `request ${i + 1}`).toBe(200);
      h.clock.advance(61_000);
    }
    await h.flush();
    expect(h.mail.calls.length).toBe(mailBefore + 5);
    const sixth = await h.requestCode(e);
    expect(sixth.statusCode).toBe(429);
    expect(h.json(sixth).error.code).toBe("code_request_limit");
    const count = (await rows(e)).length;
    await h.flush();
    expect(h.mail.calls.length).toBe(mailBefore + 5);
    // the oldest of the five is 61*5 s old: wait until it is exactly 15 min
    const oldest = new Date((await rows(e))[0]!.created_at).getTime();
    h.clock.set(oldest + 900_000);
    const ok = await h.requestCode(e);
    expect(ok.statusCode).toBe(200);
    expect((await rows(e)).length).toBeGreaterThanOrEqual(1);
    expect(count).toBe(5);
  });

  it("both limits apply: code_request_limit with the longer wait (R42)", async () => {
    const e = "lim4@example.com";
    for (let i = 0; i < 5; i++) {
      await h.requestCode(e);
      h.clock.advance(i < 4 ? 61_000 : 10_000);
    }
    const res = await h.requestCode(e);
    expect(h.json(res).error.code).toBe("code_request_limit");
    // the 15-minute wait (900 - 254 = 646 s) is the longer one, not the 50 s of R5
    expect(h.json(res).error.details.retryAfterSeconds).toBe(646);
    expect(res.headers["retry-after"]).toBe("646");
  });

  it("an accepted request cancels the earlier code (R6)", async () => {
    const e = "lim5@example.com";
    await h.addUser(e);
    const first = h.json(await h.requestCode(e)).requestId;
    await h.flush();
    const firstCode = h.lastCode();
    h.clock.advance(61_000);
    await h.requestCode(e);
    const res = await h.exchange(first, firstCode);
    expect(h.json(res).error.code).toBe("code_expired");
  });

  it("leaves an invitation's row untouched and does not count it (R47)", async () => {
    const e = "inv@example.com";
    const { insertLoginCode } = await import("../../tests/test-rows.js");
    const id = await insertLoginCode(h.sql, {
      workspace_id: h.workspaceId,
      email: e,
      purpose: "invitation",
      created_at: new Date(h.clock.now()),
      expires_at: new Date(h.clock.now() + 600_000),
    });
    for (let i = 0; i < 3; i++) {
      expect((await h.requestCode(e)).statusCode).toBe(200);
      h.clock.advance(61_000);
    }
    const [row] =
      await h.sql`select cancelled_at from login_codes where id = ${id}`;
    expect(row!.cancelled_at).toBeNull();
  });

  it("prunes at most 100 sign-in rows of any address that are 15 minutes old (R48)", async () => {
    const { insertLoginCode } = await import("../../tests/test-rows.js");
    const old = new Date(h.clock.now() - 20 * 60_000);
    for (let i = 0; i < 105; i++) {
      await insertLoginCode(h.sql, {
        workspace_id: h.workspaceId,
        email: `old${i}@example.com`,
        created_at: old,
        expires_at: new Date(old.getTime() + 600_000),
      });
    }
    const countOld = async () =>
      Number(
        (
          await h.sql`select count(*) from login_codes where email like 'old%@example.com'`
        )[0]!.count,
      );
    expect(await countOld()).toBe(105);
    await h.requestCode("prune@example.com");
    expect(await countOld()).toBe(5);
  });
});

describe("the same work for every address (R41)", () => {
  it("runs the same statements for a member and a non-member", async () => {
    await h.addUser("same@example.com");
    h.clock.advance(61_000);
    h.statements.length = 0;
    await h.requestCode("same@example.com");
    const member = [...h.statements];
    h.clock.advance(61_000);
    h.statements.length = 0;
    await h.requestCode("different@example.com");
    const stranger = [...h.statements];
    expect(member.length).toBeGreaterThan(3);
    expect(stranger).toEqual(member);
    for (const email of ["same@example.com", "different@example.com"]) {
      const [row] = await rows(email);
      expect(row!.code_hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("parallel requests for one address (R4, R5)", () => {
  it("accepts exactly one of several parallel requests", async () => {
    await h.addUser("race@example.com");
    h.clock.advance(61_000);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => h.requestCode("race@example.com")),
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 429)).toHaveLength(5);
  });
});

describe("an address that has only an invitation (R1, R2, concern 1)", () => {
  it("answers like an unknown address, sends no mail, and returns a new requestId", async () => {
    const { createInvitationCode } = await import("./index.js");
    const email = "invonly@example.com";
    await createInvitationCode(h.db, { email, secret: "o".repeat(43) });
    const mailBefore = h.mail.calls.length;
    h.clock.advance(61_000);
    const a = await h.requestCode(email);
    h.clock.advance(61_000);
    const b = await h.requestCode(email);
    expect(a.statusCode).toBe(200);
    expect(Object.keys(h.json(a)).sort()).toEqual([
      "expiresInSeconds",
      "requestId",
      "resendAfterSeconds",
    ]);
    expect(h.json(a).expiresInSeconds).toBe(600);
    expect(h.json(a).requestId).not.toBe(h.json(b).requestId);
    await h.flush();
    expect(h.mail.calls.length).toBe(mailBefore);
    const [row] =
      await h.sql`select user_id from login_codes where email = ${email} and purpose = 'sign_in' order by created_at desc limit 1`;
    expect(row!.user_id).toBeNull();
  });
});
