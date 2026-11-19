import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { checkInvitationCode } from "../../src/modules/auth/index.js";
import { invitationState } from "../../src/modules/members/invitations.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

let h: MemberHarness;
let lan: Awaited<ReturnType<MemberHarness["admin"]>>;
let n = 0;
const mail = (name: string) => `${name}-${(n += 1)}@example.com`;
const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

beforeAll(async () => {
  h = await createMemberHarness();
});
afterAll(async () => {
  await h?.close();
});
beforeEach(async () => {
  await h.sql`truncate admin_actions, invitations, member_requests, login_codes, devices, sessions, users cascade`;
  h.mail.calls.length = 0;
  h.mail.failFor.clear();
  lan = await h.admin(mail("lan"), { display_name: "Lan" });
});

async function invited(email: string) {
  const res = await h.invite(lan, [email]);
  const sent = h.invitationMails().at(-1)!;
  return {
    id: h.body(res).results[0]!.invitation!.id,
    token: h.tokenOf(sent),
    code: sent.code,
  };
}
const resend = (
  who: Parameters<MemberHarness["post"]>[0],
  id: string,
  key = h.key(),
) =>
  h.post(who, `/invitations/${id}/resend`, undefined, {
    headers: { "idempotency-key": key },
  });
const revoke = (who: Parameters<MemberHarness["post"]>[0], id: string) =>
  h.post(who, `/invitations/${id}/revoke`);

describe("invitationState (R18)", () => {
  const at = (ms: number) => new Date(ms);
  const row = (values: Record<string, Date | null> = {}) => ({
    usedAt: null,
    revokedAt: null,
    expiresAt: at(7 * DAY),
    ...values,
  });
  it("is pending until the expiry and expired at exactly 7 days (TS-016)", () => {
    expect(invitationState(row(), at(7 * DAY - SECOND))).toBe("pending");
    expect(invitationState(row(), at(7 * DAY))).toBe("expired");
    expect(invitationState(row(), at(7 * DAY + 1))).toBe("expired");
  });
  it("takes the first that applies: used, revoked, expired, pending", () => {
    const late = at(8 * DAY);
    expect(invitationState(row({ usedAt: at(1) }), late)).toBe("used");
    expect(invitationState(row({ revokedAt: at(1) }), late)).toBe("revoked");
    expect(
      invitationState(row({ usedAt: at(1), revokedAt: at(1) }), late),
    ).toBe("used");
    expect(invitationState(row(), late)).toBe("expired");
    expect(invitationState(row(), at(0))).toBe("pending");
  });
});

describe("resend (R14)", () => {
  it("starts a new 7 days, replaces the token and the code, and names the Admin who resends", async () => {
    const a = mail("a");
    const first = await invited(a);
    const an = await h.admin(mail("an"), { display_name: "An" });
    h.clock.advance(3 * DAY);
    h.mail.calls.length = 0;

    const res = await resend(an, first.id);
    expect(res.statusCode).toBe(200);
    const now = h.clock.now();
    expect(h.body(res).result).toBe("invited");
    expect(h.body(res).invitation).toMatchObject({
      id: first.id,
      state: "pending",
      mailStatus: "sent",
      // The invitation keeps its first inviter; the mail names who resends.
      invitedBy: { id: lan.id, displayName: "Lan" },
      sentAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 7 * DAY).toISOString(),
    });
    const [sent] = h.invitationMails();
    expect(sent).toMatchObject({ to: a, inviterName: "An" });
    const token = h.tokenOf(sent!);
    expect(token).not.toBe(first.token);

    const row = await h.invitation(first.id);
    expect(row.token_hash).toBe(sha(token));
    expect(row.code_serial).toBe(2);
    expect(row.mail_status).toBe("sent");
    // The earlier token finds nothing, the earlier code is refused, the new works.
    expect(
      await h.sql`select id from invitations where token_hash = ${sha(first.token)}`,
    ).toEqual([]);
    expect(
      (
        await checkInvitationCode(h.db, {
          secret: `${first.token}:1`,
          code: first.code,
        })
      ).result,
    ).not.toBe("ok");
    expect(
      await checkInvitationCode(h.db, {
        secret: `${token}:2`,
        code: sent!.code,
      }),
    ).toEqual({ result: "ok" });

    const actions = await h.actions();
    expect(actions.at(-1)).toMatchObject({
      actor_id: an.id,
      action: "invitation_resent",
      target_email: a,
      detail: { invitationId: first.id, role: "member" },
    });
  });

  it("renews an expired invitation", async () => {
    const first = await invited(mail("a"));
    h.clock.advance(9 * DAY);
    const res = await resend(lan, first.id);
    expect(res.statusCode).toBe(200);
    expect(h.body(res).invitation.state).toBe("pending");
    expect(((await h.invitation(first.id)).expires_at as Date).getTime()).toBe(
      h.clock.now() + 7 * DAY,
    );
  });

  it("renews one whose mail failed, and reports mail_not_sent when it fails again", async () => {
    const a = mail("a");
    h.mail.failFor.add(a);
    const first = await invited(a);
    const again = await resend(lan, first.id);
    expect(h.body(again).result).toBe("mail_not_sent");
    expect(h.body(again).invitation.mailStatus).toBe("failed");
    h.mail.failFor.clear();
    const ok = await resend(lan, first.id);
    expect(h.body(ok).result).toBe("invited");
    expect((await h.invitation(first.id)).mail_status).toBe("sent");
  });

  it("does not hold an Admin's Resend to the 60 seconds between two codes", async () => {
    const first = await invited(mail("a"));
    const one = await resend(lan, first.id);
    const two = await resend(lan, first.id);
    expect([one.statusCode, two.statusCode]).toEqual([200, 200]);
    expect((await h.invitation(first.id)).code_serial).toBe(3);
  });

  it("answers the stored response to a repeat with the same key, and sends one mail", async () => {
    const first = await invited(mail("a"));
    h.mail.calls.length = 0;
    const key = h.key();
    const one = await resend(lan, first.id, key);
    const two = await resend(lan, first.id, key);
    expect(h.body(two)).toEqual(h.body(one));
    expect(h.invitationMails()).toHaveLength(1);
    expect((await h.invitation(first.id)).code_serial).toBe(2);
  });
});

describe("refusals (R15)", () => {
  it("answers 409 invitation_revoked to a resend of a revoked invitation, and changes nothing", async () => {
    const first = await invited(mail("a"));
    await revoke(lan, first.id);
    const before = await h.invitation(first.id);
    h.mail.calls.length = 0;
    const res = await resend(lan, first.id);
    expect(res.statusCode).toBe(409);
    expect(h.body(res).error.code).toBe("invitation_revoked");
    expect(await h.invitation(first.id)).toEqual(before);
    expect(h.invitationMails()).toEqual([]);
  });

  it("answers 409 invitation_used to a resend and to a revoke of a used invitation", async () => {
    const first = await invited(mail("a"));
    await h.sql`update invitations set used_at = ${new Date(h.clock.now())}, used_by = ${lan.id} where id = ${first.id}`;
    for (const res of [
      await resend(lan, first.id),
      await revoke(lan, first.id),
    ]) {
      expect(res.statusCode).toBe(409);
      expect(h.body(res).error.code).toBe("invitation_used");
    }
  });

  it("answers 404 invitation_not_found for an unknown id and 400 for an id that is not a UUID", async () => {
    const id = crypto.randomUUID();
    for (const res of [await resend(lan, id), await revoke(lan, id)]) {
      expect(res.statusCode).toBe(404);
      expect(h.body(res).error.code).toBe("invitation_not_found");
    }
    for (const res of [await resend(lan, "abc"), await revoke(lan, "abc")]) {
      expect(res.statusCode).toBe(400);
      expect(h.body(res).error.code).toBe("validation_failed");
    }
  });
});

describe("revoke (R16, R17)", () => {
  it("sets revoked_at, answers the invitation as revoked, and the address can be invited again", async () => {
    const a = mail("a");
    const first = await invited(a);
    const res = await revoke(lan, first.id);
    expect(res.statusCode).toBe(200);
    expect(h.body(res).invitation).toMatchObject({
      id: first.id,
      state: "revoked",
    });
    const row = await h.invitation(first.id);
    expect((row.revoked_at as Date).getTime()).toBe(h.clock.now());
    expect(row.used_at).toBeNull();

    const again = await h.invite(lan, [a]);
    expect(h.body(again).results[0]!.result).toBe("invited");
    expect(await h.invitationsOf(a)).toHaveLength(2);
    const actions = await h.actions();
    expect(actions.map((r) => r.action)).toEqual([
      "invitation_created",
      "invitation_revoked",
      "invitation_created",
    ]);
    expect(actions[1]).toMatchObject({
      actor_id: lan.id,
      target_email: a,
      detail: { invitationId: first.id, role: "member" },
    });
  });

  it("answers 200 as the first time, changes nothing and records nothing when revoked twice", async () => {
    const first = await invited(mail("a"));
    const one = await revoke(lan, first.id);
    h.clock.advance(DAY);
    const before = await h.invitation(first.id);
    const two = await revoke(lan, first.id);
    expect(two.statusCode).toBe(200);
    expect(h.body(two)).toEqual(h.body(one));
    expect(await h.invitation(first.id)).toEqual(before);
    expect(
      (await h.actions()).filter((r) => r.action === "invitation_revoked"),
    ).toHaveLength(1);
  });

  it("can be sent for an expired invitation", async () => {
    const first = await invited(mail("a"));
    h.clock.advance(8 * DAY);
    const res = await revoke(lan, first.id);
    expect(res.statusCode).toBe(200);
    expect(h.body(res).invitation.state).toBe("revoked");
  });

  it("changes nothing in the account of a deactivated person (R17)", async () => {
    const email = mail("old");
    const old = await h.addUser(email, {
      status: "deactivated",
      role: "admin",
      display_name: "Old",
    });
    const before = await h.user(old);
    const first = await invited(email);
    await revoke(lan, first.id);
    expect(await h.user(old)).toEqual(before);
  });
});
