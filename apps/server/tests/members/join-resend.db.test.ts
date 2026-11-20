import { INVITATION_RESEND_SECONDS } from "@toki/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkInvitationCode } from "../../src/modules/auth/index.js";
import {
  codeSecret,
  issueInvitationCode,
} from "../../src/modules/members/index.js";
import { insertLoginCode } from "../test-rows.js";
import {
  json,
  makeInvitation,
  markUsed,
  pastTheSevenDays,
  resend,
  revoke,
  type Admin,
  type Made,
} from "./join-support.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

let h: MemberHarness;
let lan: Admin;
let n = 0;
const fresh = () => `resend${(n += 1)}@example.com`;
const sent = () =>
  h.mail.calls.filter((c) => c.operation === "sendInvitationCode");
const codeRows = async (email: string) =>
  (await h.sql`select * from login_codes where email = ${email} order by created_at, id`) as unknown as {
    purpose: string;
    cancelled_at: Date | null;
    used_at: Date | null;
  }[];
const serialOf = async (made: Made) =>
  (await h.invitation(made.id)).code_serial as number;
const settle = () => h.flush();

beforeAll(async () => {
  h = await createMemberHarness();
  lan = await h.admin("lan@example.com");
});
afterAll(async () => {
  await h?.close();
});

describe('"Resend code" (R6 to R9)', () => {
  it("makes a new code, cancels the earlier one, sends one mail and answers with the two waits (R6)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    h.clock.advance(60_000);
    const mailsBefore = sent().length;
    const res = await resend(h, made.token);
    expect(res.statusCode).toBe(200);
    expect(json(res)).toEqual({
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    expect(res.headers["set-cookie"]).toBeUndefined();
    await settle();
    expect(sent()).toHaveLength(mailsBefore + 1);
    const call = sent().at(-1)!.input as { to: string; code: string };
    expect(call.to).toBe(made.email);
    expect(call.code).toMatch(/^[0-9]{6}$/);
    // the code of the first mail answers expired; the new one is right (the secret has a new serial)
    expect(
      await checkInvitationCode(h.db, {
        secret: codeSecret(made.token, 1),
        code: made.code,
      }),
    ).toEqual({ result: "expired" });
    expect(await serialOf(made)).toBe(2);
    expect(
      await checkInvitationCode(h.db, {
        secret: codeSecret(made.token, 2),
        code: call.code,
      }),
    ).toEqual({ result: "ok" });
  });

  it("refuses at 59 seconds with retryAfterSeconds 1 and the header, and accepts at 60; the code of the invitation mail is the latest code (R7)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    h.clock.advance(59_000);
    const before = (await codeRows(made.email)).length;
    const mails = sent().length;
    const refused = await resend(h, made.token);
    expect(refused.statusCode).toBe(429);
    expect(json(refused).error.code).toBe("code_resend_too_soon");
    expect(json(refused).error.details?.retryAfterSeconds).toBe(1);
    expect(refused.headers["retry-after"]).toBe("1");
    await settle();
    expect((await codeRows(made.email)).length).toBe(before);
    expect(sent()).toHaveLength(mails);
    h.clock.advance(1_000);
    expect((await resend(h, made.token)).statusCode).toBe(200);
  });

  it("the 60 seconds are also held by issueInvitationCode itself, with no address lock (R7)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    h.clock.advance(59_000);
    const early = await issueInvitationCode(h.db, {
      token: made.token,
      now: new Date(h.clock.now()),
      minIntervalSeconds: INVITATION_RESEND_SECONDS,
    });
    expect(early).toEqual({
      ok: false,
      error: "resend_too_soon",
      retryAfterSeconds: 1,
    });
    h.clock.advance(1_000);
    const later = await issueInvitationCode(h.db, {
      token: made.token,
      now: new Date(h.clock.now()),
      minIntervalSeconds: INVITATION_RESEND_SECONDS,
    });
    expect(later.ok).toBe(true);
  });

  it("two presses at the same moment give one code, one mail and one 429 (R7)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    h.clock.advance(61_000);
    const mails = sent().length;
    const [a, b] = await Promise.all([
      resend(h, made.token),
      resend(h, made.token),
    ]);
    const codes = [a, b].map((r) => r.statusCode).sort();
    expect(codes).toEqual([200, 429]);
    await settle();
    expect(sent()).toHaveLength(mails + 1);
    expect((await codeRows(made.email)).length).toBe(2);
    expect(await serialOf(made)).toBe(2);
  });

  it("answers 409 for an expired, revoked or used invitation and 404 for an unknown token or one of the wrong shape, with no code and no mail (R8)", async () => {
    const expired = await makeInvitation(h, lan, fresh());
    const revoked = await makeInvitation(h, lan, fresh());
    const used = await makeInvitation(h, lan, fresh());
    await revoke(h, lan, revoked);
    await markUsed(h, used);
    pastTheSevenDays(h);
    const rowsBefore = JSON.stringify(
      await h.sql`select * from login_codes order by id`,
    );
    const mails = sent().length;
    const cases: [string, number, string][] = [
      [expired.token, 409, "invitation_expired"],
      [revoked.token, 409, "invitation_revoked"],
      [used.token, 409, "invitation_used"],
      ["A".repeat(43), 404, "invitation_not_found"],
      ["short", 404, "invitation_not_found"],
      [`${expired.token}A`, 404, "invitation_not_found"],
    ];
    for (const [token, status, code] of cases) {
      const res = await resend(h, token);
      expect(res.statusCode, code).toBe(status);
      expect(json(res).error.code).toBe(code);
    }
    await settle();
    expect(sent()).toHaveLength(mails);
    expect(
      JSON.stringify(await h.sql`select * from login_codes order by id`),
    ).toBe(rowsBefore);
  });

  it("a body with no token is 400 validation_failed and changes nothing (R8)", async () => {
    const res = await h.post(null, "/invitations/codes", {});
    expect(res.statusCode).toBe(400);
    expect(json(res).error.code).toBe("validation_failed");
  });

  it("uses one connection for the lock of the address and the code, so the pool cannot starve (R6, advisor)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    h.clock.advance(61_000);
    const from = h.statementLog.length;
    expect((await resend(h, made.token)).statusCode).toBe(200);
    const mine = h.statementLog.slice(from);
    const lock = mine.find((s) => /pg_advisory_xact_lock/.test(s.query));
    const insert = mine.find((s) => /insert into "login_codes"/.test(s.query));
    const invitationLock = mine.find((s) =>
      /from "invitations"[\s\S]*for no key update/i.test(s.query),
    );
    expect(lock).toBeDefined();
    expect(insert).toBeDefined();
    expect(invitationLock).toBeDefined();
    expect(insert!.connection).toBe(lock!.connection);
    expect(invitationLock!.connection).toBe(lock!.connection);
  });
});

describe("the count shared with sign-in (R50 to R54)", () => {
  // Rows of the address, of either purpose, `agesS` seconds old, oldest first.
  const rows = async (
    email: string,
    purpose: "sign_in" | "invitation",
    agesS: number[],
  ) => {
    for (const age of agesS) {
      await insertLoginCode(h.sql, {
        workspace_id: h.workspaceId,
        email,
        purpose,
        created_at: new Date(h.clock.now() - age * 1000),
        expires_at: new Date(h.clock.now() + (600 - age) * 1000),
      });
    }
  };

  it("5 rows in 15 minutes answer 429 code_request_limit with the wait and the header, make no code and send no mail; accepted once the oldest is 15 minutes old (R50)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    // the invitation's own code is one row; 4 resends 61 seconds apart make 5
    for (let i = 0; i < 4; i++) {
      h.clock.advance(61_000);
      expect((await resend(h, made.token)).statusCode).toBe(200);
    }
    await settle();
    h.clock.advance(61_000);
    const mails = sent().length;
    const rowsBefore = (await codeRows(made.email)).length;
    const res = await resend(h, made.token);
    expect(res.statusCode).toBe(429);
    expect(json(res).error.code).toBe("code_request_limit");
    const wait = json(res).error.details!.retryAfterSeconds!;
    expect(wait).toBeGreaterThan(1);
    expect(res.headers["retry-after"]).toBe(String(wait));
    await settle();
    expect(sent()).toHaveLength(mails);
    expect((await codeRows(made.email)).length).toBe(rowsBefore);
    // 1 second short of the wait: still refused; at the wait: accepted
    h.clock.advance((wait - 1) * 1000);
    expect((await resend(h, made.token)).statusCode).toBe(429);
    h.clock.advance(1_000);
    expect((await resend(h, made.token)).statusCode).toBe(200);
  });

  it("an invitation that cannot be used answers its own code, whatever the count (R50)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    await rows(made.email, "sign_in", [800, 600, 400, 200]);
    await revoke(h, lan, made);
    const res = await resend(h, made.token);
    expect(res.statusCode).toBe(409);
    expect(json(res).error.code).toBe("invitation_revoked");
  });

  it("a sign-in request for the address 30 seconds earlier makes Resend answer code_resend_too_soon with 30 (R51)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    h.clock.advance(61_000);
    await rows(made.email, "sign_in", [30]);
    const res = await resend(h, made.token);
    expect(res.statusCode).toBe(429);
    expect(json(res).error.code).toBe("code_resend_too_soon");
    expect(json(res).error.details?.retryAfterSeconds).toBe(30);
    h.clock.advance(30_000);
    expect((await resend(h, made.token)).statusCode).toBe(200);
  });

  it("both limits together answer code_request_limit with the longer wait (R51)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    h.clock.advance(61_000);
    await rows(made.email, "sign_in", [800, 600, 400, 30]);
    // 4 sign-in rows + the invitation's code = 5; the oldest sign-in row is 800 s old: 100 s to go
    const res = await resend(h, made.token);
    expect(json(res).error.code).toBe("code_request_limit");
    expect(json(res).error.details?.retryAfterSeconds).toBeGreaterThanOrEqual(
      30,
    );
  });

  it("5 sign-in requests make the next Resend return code_request_limit, and 5 resends make the next sign-in request return it (R52)", async () => {
    const a = await makeInvitation(h, lan, fresh());
    await h.sql`delete from login_codes where email = ${a.email}`;
    await rows(a.email, "sign_in", [800, 640, 480, 320, 160]);
    const viaResend = await resend(h, a.token);
    expect(json(viaResend).error.code).toBe("code_request_limit");

    const b = await makeInvitation(h, lan, fresh());
    for (let i = 0; i < 4; i++) {
      h.clock.advance(61_000);
      expect((await resend(h, b.token)).statusCode).toBe(200);
    }
    h.clock.advance(61_000);
    await h.addUser(b.email);
    const viaSignIn = await h.requestCode(b.email);
    expect(viaSignIn.statusCode).toBe(429);
    expect(h.json(viaSignIn).error.code).toBe("code_request_limit");
  });

  it("a sign-in request leaves the invitation code usable, and Resend leaves the sign-in code usable (R52)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    await h.addUser(made.email);
    h.clock.advance(61_000);
    expect((await h.requestCode(made.email)).statusCode).toBe(200);
    await h.flush();
    const signInCode = h.lastCode();
    expect(
      await checkInvitationCode(h.db, {
        secret: codeSecret(made.token, 1),
        code: made.code,
      }),
    ).toEqual({ result: "ok" });
    const rowsNow = await codeRows(made.email);
    expect(
      rowsNow.filter((r) => r.purpose === "invitation")[0]!.cancelled_at,
    ).toBeNull();
    h.clock.advance(61_000);
    expect((await resend(h, made.token)).statusCode).toBe(200);
    const signIn = (await codeRows(made.email)).find(
      (r) => r.purpose === "sign_in",
    )!;
    expect(signIn.cancelled_at).toBeNull();
    expect(signInCode).toMatch(/^[0-9]{6}$/);
  });

  it("an Admin's Resend is never refused by the count, and its code counts as one request (R53)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    await rows(made.email, "sign_in", [800, 640, 480, 320]);
    // 5 rows now (with the invitation's code): Resend code is refused ...
    h.clock.advance(61_000);
    expect(json(await resend(h, made.token)).error.code).toBe(
      "code_request_limit",
    );
    // ... the Admin's Resend is accepted and adds a row
    const before = (await codeRows(made.email)).length;
    const res = await h.post(lan, `/invitations/${made.id}/resend`, undefined, {
      headers: { "idempotency-key": h.key() },
    });
    expect(res.statusCode).toBe(200);
    expect((await codeRows(made.email)).length).toBe(before + 1);
  });

  it("a sign-in request and a Resend at the same moment with 4 rows give one acceptance and one code_request_limit (R50, R52)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    await h.addUser(made.email);
    h.clock.advance(61_000);
    await rows(made.email, "sign_in", [800, 640, 480]);
    const [a, b] = await Promise.all([
      resend(h, made.token),
      h.requestCode(made.email),
    ]);
    const codes = [a, b].map((r) => r.statusCode).sort();
    expect(codes).toEqual([200, 429]);
    const refused = a.statusCode === 429 ? a : b;
    expect(json(refused).error.code).toBe("code_request_limit");
  });
});
