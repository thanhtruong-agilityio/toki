import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { checkInvitationCode } from "../../src/modules/auth/index.js";
import {
  codeSecret,
  findInvitationByToken,
  issueInvitationCode,
} from "../../src/modules/members/index.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

// Three of the four functions the accept-an-invitation work calls (R19).

let h: MemberHarness;
let lan: Awaited<ReturnType<MemberHarness["admin"]>>;
let n = 0;
const mail = (name: string) => `${name}-${(n += 1)}@example.com`;
const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;
const now = () => new Date(h.clock.now());

beforeAll(async () => {
  h = await createMemberHarness();
});
afterAll(async () => {
  await h?.close();
});
beforeEach(async () => {
  await h.sql`truncate admin_actions, invitations, member_requests, login_codes, devices, sessions, users cascade`;
  h.mail.calls.length = 0;
  lan = await h.admin(mail("lan"));
});

async function invited(email: string, role = "member") {
  const res = await h.invite(lan, [email], { role });
  const sent = h.invitationMails().at(-1)!;
  return {
    id: h.body(res).results[0]!.invitation!.id,
    token: h.tokenOf(sent),
    code: sent.code,
  };
}
const writes = async () =>
  JSON.stringify([
    await h.sql`select * from invitations order by id`,
    await h.sql`select * from login_codes order by id`,
    await h.sql`select * from admin_actions order by id`,
    await h.sql`select * from users order by id`,
  ]);

describe("codeSecret", () => {
  it("is the token, a colon and the serial", () => {
    expect(codeSecret("tok", 3)).toBe("tok:3");
  });
});

describe("findInvitationByToken", () => {
  it("gives the fields of the contract for a pending invitation, and writes nothing", async () => {
    const email = mail("a");
    const made = await invited(email, "admin");
    const before = await writes();
    const found = await findInvitationByToken(h.db, made.token, now());
    expect(found).toEqual({
      id: made.id,
      email,
      role: "admin",
      state: "pending",
      accountId: null,
      codeSerial: 1,
      codeIssuedAt: now(),
      expiresAt: new Date(h.clock.now() + 7 * DAY),
    });
    expect(await writes()).toBe(before);
  });

  it("gives the account of a deactivated person as accountId", async () => {
    const email = mail("old");
    const old = await h.addUser(email, { status: "deactivated" });
    const made = await invited(email);
    expect(
      (await findInvitationByToken(h.db, made.token, now()))!.accountId,
    ).toBe(old);
  });

  it("gives null for an unknown token and, without a query, for one of the wrong shape", async () => {
    await invited(mail("a"));
    expect(await findInvitationByToken(h.db, "A".repeat(43), now())).toBeNull();
    const before = h.statements.length;
    for (const bad of ["", "short", "a".repeat(44), `${"a".repeat(42)}+`]) {
      expect(await findInvitationByToken(h.db, bad, now())).toBeNull();
    }
    expect(h.statements.length).toBe(before);
  });

  it("gives null for a token that a Resend replaced, and finds the new one", async () => {
    const made = await invited(mail("a"));
    h.mail.calls.length = 0;
    await h.post(lan, `/invitations/${made.id}/resend`, undefined, {
      headers: { "idempotency-key": h.key() },
    });
    const token = h.tokenOf(h.invitationMails().at(-1)!);
    expect(await findInvitationByToken(h.db, made.token, now())).toBeNull();
    expect((await findInvitationByToken(h.db, token, now()))!.codeSerial).toBe(
      2,
    );
  });

  it("gives the states expired, revoked and used", async () => {
    const expired = await invited(mail("a"));
    const revoked = await invited(mail("b"));
    const used = await invited(mail("c"));
    await h.post(lan, `/invitations/${revoked.id}/revoke`);
    await h.sql`update invitations set used_at = ${now()}, used_by = ${lan.id} where id = ${used.id}`;
    const state = async (token: string, at: Date) =>
      (await findInvitationByToken(h.db, token, at))!.state;
    expect(await state(revoked.token, now())).toBe("revoked");
    expect(await state(used.token, now())).toBe("used");
    const boundary = h.clock.now() + 7 * DAY;
    expect(await state(expired.token, new Date(boundary - SECOND))).toBe(
      "pending",
    );
    expect(await state(expired.token, new Date(boundary))).toBe("expired");
    // Used and revoked win over expired.
    expect(await state(used.token, new Date(boundary))).toBe("used");
    expect(await state(revoked.token, new Date(boundary))).toBe("revoked");
  });
});

describe("issueInvitationCode", () => {
  it("makes the next code: the serial goes up, the earlier code is cancelled, the new one works", async () => {
    const email = mail("a");
    const made = await invited(email);
    h.clock.advance(5 * SECOND);
    const out = await issueInvitationCode(h.db, {
      token: made.token,
      now: now(),
    });
    expect(out).toEqual({ ok: true, email, code: expect.any(String) });
    if (!out.ok) throw new Error("unreachable");
    expect(out.code).toMatch(/^[0-9]{6}$/);
    const row = await h.invitation(made.id);
    expect(row.code_serial).toBe(2);
    expect((row.code_issued_at as Date).getTime()).toBe(h.clock.now());
    expect(
      (
        await checkInvitationCode(h.db, {
          secret: codeSecret(made.token, 1),
          code: made.code,
        })
      ).result,
    ).not.toBe("ok");
    expect(
      await checkInvitationCode(h.db, {
        secret: codeSecret(made.token, 2),
        code: out.code,
      }),
    ).toEqual({ result: "ok" });
    // It sends no mail.
    expect(h.invitationMails()).toHaveLength(1);
  });

  it("refuses at 59 seconds with retryAfterSeconds 1 and accepts at 60; the code of the invitation mail counts", async () => {
    const made = await invited(mail("a"));
    h.clock.advance(59 * SECOND);
    const early = await issueInvitationCode(h.db, {
      token: made.token,
      now: now(),
      minIntervalSeconds: 60,
    });
    expect(early).toEqual({
      ok: false,
      error: "resend_too_soon",
      retryAfterSeconds: 1,
    });
    expect((await h.invitation(made.id)).code_serial).toBe(1);
    h.clock.advance(SECOND);
    const onTime = await issueInvitationCode(h.db, {
      token: made.token,
      now: now(),
      minIntervalSeconds: 60,
    });
    expect(onTime.ok).toBe(true);
  });

  it("rounds the wait up to whole seconds", async () => {
    const made = await invited(mail("a"));
    h.clock.advance(100);
    const early = await issueInvitationCode(h.db, {
      token: made.token,
      now: now(),
      minIntervalSeconds: 60,
    });
    expect(early).toMatchObject({ retryAfterSeconds: 60 });
  });

  it("gives one code and one resend_too_soon to two calls at the same moment", async () => {
    const made = await invited(mail("a"));
    h.clock.advance(61 * SECOND);
    const call = () =>
      issueInvitationCode(h.db, {
        token: made.token,
        now: now(),
        minIntervalSeconds: 60,
      });
    const [x, y] = await Promise.all([call(), call()]);
    expect([x.ok, y.ok].sort()).toEqual([false, true]);
    const refused = x.ok ? y : x;
    expect(refused).toMatchObject({ error: "resend_too_soon" });
    expect((await h.invitation(made.id)).code_serial).toBe(2);
  });

  it("refuses an unknown, an expired, a revoked and a used invitation, and writes nothing", async () => {
    const expired = await invited(mail("a"));
    const revoked = await invited(mail("b"));
    const used = await invited(mail("c"));
    await h.post(lan, `/invitations/${revoked.id}/revoke`);
    await h.sql`update invitations set used_at = ${now()}, used_by = ${lan.id} where id = ${used.id}`;
    const before = await writes();
    const error = async (token: string, at = now()) => {
      const out = await issueInvitationCode(h.db, { token, now: at });
      return out.ok ? "ok" : out.error;
    };
    expect(await error("B".repeat(43))).toBe("invitation_not_found");
    expect(await error("bad")).toBe("invitation_not_found");
    expect(await error(revoked.token)).toBe("invitation_revoked");
    expect(await error(used.token)).toBe("invitation_used");
    expect(await error(expired.token, new Date(h.clock.now() + 7 * DAY))).toBe(
      "invitation_expired",
    );
    expect(await writes()).toBe(before);
  });
});
