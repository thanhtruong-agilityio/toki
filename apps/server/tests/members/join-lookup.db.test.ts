import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  json,
  lookup,
  makeInvitation,
  markUsed,
  pastTheSevenDays,
  revoke,
  type Admin,
} from "./join-support.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

let h: MemberHarness;
let lan: Admin;
let n = 0;
const fresh = () => `lookup${(n += 1)}@example.com`;

beforeAll(async () => {
  h = await createMemberHarness();
  lan = await h.admin("lan@example.com");
});
afterAll(async () => {
  await h?.close();
});

describe("the lookup of an invitation (R1 to R5)", () => {
  it("a pending invitation gives exactly the five fields (R1)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    const res = await lookup(h, made.token);
    expect(res.statusCode).toBe(200);
    expect(json(res)).toEqual({
      state: "pending",
      email: made.email,
      workspaceName: "Acme",
      codeExpiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
  });

  it("an expired one gives state and workspace name only; a revoked one the same (R1, R3)", async () => {
    const expired = await makeInvitation(h, lan, fresh());
    const revoked = await makeInvitation(h, lan, fresh());
    await revoke(h, lan, revoked);
    expect(json(await lookup(h, revoked.token))).toEqual({
      state: "revoked",
      workspaceName: "Acme",
    });
    pastTheSevenDays(h);
    expect(json(await lookup(h, expired.token))).toEqual({
      state: "expired",
      workspaceName: "Acme",
    });
  });

  it("a used one gives the address only (R1)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    await markUsed(h, made);
    expect(json(await lookup(h, made.token))).toEqual({
      state: "used",
      email: made.email,
    });
  });

  it("an unknown token gives `unknown` and nothing else, also for a token of the wrong shape (R1, R2)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    const tokens = [
      "A".repeat(43), // the right shape, no invitation
      made.token.slice(0, 42),
      `${made.token}A`,
      `${made.token.slice(0, 42)}+`,
      "",
    ];
    for (const token of tokens) {
      const res = await lookup(h, token);
      expect(res.statusCode).toBe(200);
      expect(json(res)).toEqual({ state: "unknown" });
    }
  });

  it("a body with no token, a non-string token and no body give 400 validation_failed, and nothing is written (R2)", async () => {
    const before = await h.sql`select count(*)::int as n from login_codes`;
    for (const payload of [{}, { token: 1 }, { token: null }, undefined]) {
      const res = await h.post(null, "/invitations/lookup", payload);
      expect(res.statusCode).toBe(400);
      expect(json(res).error.code).toBe("validation_failed");
    }
    const after = await h.sql`select count(*)::int as n from login_codes`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("an invitation that is used and expired answers used; revoked and expired answers revoked (R3)", async () => {
    // The table refuses a row that is both used and revoked (`invitations_closed_check`), so the order
    // `used` before `revoked` is shown with the states that can meet: used with 7 days gone.
    const both = await makeInvitation(h, lan, fresh());
    const old = await makeInvitation(h, lan, fresh());
    await markUsed(h, both);
    await revoke(h, lan, old);
    pastTheSevenDays(h);
    expect(json(await lookup(h, both.token)).state).toBe("used");
    expect(json(await lookup(h, old.token)).state).toBe("revoked");
  });

  it("a token replaced by an Admin's Resend is unknown, and the new one is pending (R3, R47)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    const res = await h.post(lan, `/invitations/${made.id}/resend`, undefined, {
      headers: { "idempotency-key": h.key() },
    });
    expect(res.statusCode).toBe(200);
    expect(json(await lookup(h, made.token))).toEqual({ state: "unknown" });
    const sent = h
      .invitationMails()
      .filter((m) => m.to === made.email)
      .at(-1)!;
    expect(json(await lookup(h, h.tokenOf(sent))).state).toBe("pending");
  });

  it("counts the seconds left from the latest code: 9:59 and 10:00, 59 and 60 seconds (R4)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    h.clock.advance(59_000);
    let body = json(await lookup(h, made.token));
    expect([body.codeExpiresInSeconds, body.resendAfterSeconds]).toEqual([
      541, 1,
    ]);
    h.clock.advance(1_000);
    body = json(await lookup(h, made.token));
    expect([body.codeExpiresInSeconds, body.resendAfterSeconds]).toEqual([
      540, 0,
    ]);
    h.clock.advance(539_000); // 599 s after the code
    body = json(await lookup(h, made.token));
    expect(body.codeExpiresInSeconds).toBe(1);
    h.clock.advance(1_000); // 600 s
    body = json(await lookup(h, made.token));
    expect(body.codeExpiresInSeconds).toBe(0);
    h.clock.advance(5_000_000); // long after: never below 0
    body = json(await lookup(h, made.token));
    expect([body.codeExpiresInSeconds, body.resendAfterSeconds]).toEqual([
      0, 0,
    ]);
  });

  it("rounds a part of a second up (R4)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    h.clock.advance(59_200);
    const body = json(await lookup(h, made.token));
    expect(body.resendAfterSeconds).toBe(1);
    expect(body.codeExpiresInSeconds).toBe(541);
  });

  it("changes no row and sends no mail for every state, and signs nobody in (R5)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    const snapshot = async () =>
      JSON.stringify([
        await h.sql`select * from login_codes order by id`,
        await h.sql`select id, ended_at from sessions order by id`,
        await h.sql`select * from invitations order by id`,
        await h.sql`select * from users order by id`,
        await h.sql`select * from conversation_members order by user_id, conversation_id`,
      ]);
    const probe = async (token: string) => {
      const mails = h.mail.calls.length;
      const before = await snapshot();
      const res = await lookup(h, token);
      expect(res.headers["set-cookie"]).toBeUndefined();
      expect(await snapshot()).toBe(before);
      expect(h.mail.calls.length).toBe(mails);
    };
    // pending, a token of the right shape that no invitation has, and one of the wrong shape
    for (const token of [made.token, "A".repeat(43), "short"]) {
      await probe(token);
    }
    // used: the state is made first, then the lookup is shown to change nothing
    await markUsed(h, made);
    await probe(made.token);
    // and a lookup signs nobody in
    expect((await h.get(null, "/members")).statusCode).toBe(401);
    const session = await h.call({
      method: "GET",
      url: "/api/v1/auth/session",
    });
    expect(session.statusCode).toBe(401);
  });

  it("returns no role, inviter name or id in any state (R1)", async () => {
    const made = await makeInvitation(h, lan, fresh(), { role: "admin" });
    const text = (await lookup(h, made.token)).body;
    for (const word of ["role", "admin", "invitedBy", "Lan", lan.id]) {
      expect(text).not.toContain(word);
    }
  });
});
