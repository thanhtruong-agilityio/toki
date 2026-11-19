import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMemberHarness, type MemberHarness } from "./setup.js";

let h: MemberHarness;
let lan: Awaited<ReturnType<MemberHarness["admin"]>>;
let n = 0;
const mail = (name: string) => `${name}-${(n += 1)}@example.com`;
const DAY = 24 * 60 * 60 * 1000;

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

describe("the body (R4)", () => {
  it("accepts 50 addresses and refuses 51 with batch_too_large", async () => {
    const fifty = Array.from({ length: 50 }, () => mail("p"));
    const ok = await h.invite(lan, fifty);
    expect(ok.statusCode).toBe(200);
    expect(h.body(ok).results).toHaveLength(50);
    expect(h.body(ok).results.every((r) => r.result === "invited")).toBe(true);

    const before = (await h.sql`select count(*)::int as n from invitations`)[0]!
      .n;
    const many = await h.invite(lan, [...fifty, mail("p")]);
    expect(many.statusCode).toBe(400);
    expect(h.body(many).error.code).toBe("batch_too_large");
    expect(h.body(many).error.details).toEqual({ max: 50 });
    expect(
      (await h.sql`select count(*)::int as n from invitations`)[0]!.n,
    ).toBe(before);
  });

  it("counts the entries as sent, before any address is normalised", async () => {
    const same = Array.from({ length: 51 }, () => "same@example.com");
    const res = await h.invite(lan, same);
    expect(h.body(res).error.code).toBe("batch_too_large");
  });

  it("refuses no entry, an entry that is not a string, and another role with validation_failed", async () => {
    for (const [emails, role] of [
      [[], undefined],
      [[1], undefined],
      ["a@example.com", undefined],
      [[mail("p")], "owner"],
    ] as const) {
      const res = await h.invite(lan, emails, { role });
      expect(res.statusCode).toBe(400);
      expect(h.body(res).error.code).toBe("validation_failed");
    }
    expect(h.invitationMails()).toEqual([]);
  });

  it("invites as a Member when no role is sent, and as an Admin when asked", async () => {
    const a = mail("a");
    const b = mail("b");
    await h.invite(lan, [a]);
    await h.invite(lan, [b], { role: "admin" });
    expect((await h.invitationsOf(a))[0]!.role).toBe("member");
    expect((await h.invitationsOf(b))[0]!.role).toBe("admin");
  });
});

describe("the results (R5 to R10)", () => {
  it("gives each of the five results in one request, in the order of first appearance", async () => {
    const fresh = mail("fresh");
    const failing = mail("failing");
    const member = await h.addUser(mail("member"));
    const memberEmail = (await h.user(member)).email as string;
    const pending = mail("pending");
    await h.invite(lan, [pending]);
    h.mail.calls.length = 0;
    h.mail.failFor.add(failing);

    const res = await h.invite(lan, [
      fresh,
      failing,
      memberEmail,
      pending,
      "not an address",
    ]);
    expect(res.statusCode).toBe(200);
    const results = h.body(res).results;
    expect(results.map((r) => [r.email, r.result])).toEqual([
      [fresh, "invited"],
      [failing, "mail_not_sent"],
      [memberEmail, "already_member"],
      [pending, "already_invited"],
      ["not an address", "invalid_email"],
    ]);
    expect(results[0]!.invitation).toMatchObject({
      state: "pending",
      role: "member",
      mailStatus: "sent",
      invitedBy: { id: lan.id, displayName: "Lan" },
    });
    expect(results[1]!.invitation!.mailStatus).toBe("failed");
    expect(results[2]!.invitation).toBeUndefined();
    expect(results[3]!.invitation!.state).toBe("pending");
    expect(results[4]!.invitation).toBeUndefined();
    // One mail for each new invitation and none for the others.
    expect(h.invitationMails().map((m) => m.to)).toEqual([fresh, failing]);
    expect((await h.invitationsOf(fresh))[0]!.mail_status).toBe("sent");
    expect((await h.invitationsOf(failing))[0]!.mail_status).toBe("failed");
  });

  it("writes the row with the role, the inviter, 7 days and the times of the clock", async () => {
    const a = mail("a");
    const res = await h.invite(lan, [a], { role: "admin" });
    const [row] = await h.invitationsOf(a);
    const now = h.clock.now();
    expect(row).toMatchObject({
      workspace_id: h.workspaceId,
      email: a,
      role: "admin",
      user_id: null,
      invited_by: lan.id,
      code_serial: 1,
      mail_status: "sent",
      used_at: null,
      used_by: null,
      revoked_at: null,
    });
    expect((row!.created_at as Date).getTime()).toBe(now);
    expect((row!.sent_at as Date).getTime()).toBe(now);
    expect((row!.code_issued_at as Date).getTime()).toBe(now);
    expect((row!.expires_at as Date).getTime()).toBe(now + 7 * DAY);
    expect(h.body(res).results[0]!.invitation).toEqual({
      id: row!.id,
      state: "pending",
      role: "admin",
      mailStatus: "sent",
      invitedBy: { id: lan.id, displayName: "Lan" },
      createdAt: new Date(now).toISOString(),
      sentAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 7 * DAY).toISOString(),
    });
  });

  it("trims and lower-cases an entry and reports an address sent twice once", async () => {
    const a = mail("mixed");
    const res = await h.invite(lan, [`  ${a.toUpperCase()} `, a, a]);
    expect(h.body(res).results.map((r) => [r.email, r.result])).toEqual([
      [a, "invited"],
    ]);
    expect(await h.invitationsOf(a)).toHaveLength(1);
    expect(h.invitationMails()).toHaveLength(1);
  });

  it("reports an empty or blank entry once as invalid_email with an empty address", async () => {
    const a = mail("a");
    const res = await h.invite(lan, ["", "   ", a]);
    expect(h.body(res).results.map((r) => [r.email, r.result])).toEqual([
      ["", "invalid_email"],
      [a, "invited"],
    ]);
  });

  it("holds the length rules of an address: 254 passes, 255 and a 65-character local part do not", async () => {
    const label = (size: number) => "b".repeat(size);
    const local = "a".repeat(64);
    const ok254 = `${local}@${label(61)}.${label(61)}.${label(61)}.com`;
    const bad255 = `${local}@${label(62)}.${label(61)}.${label(61)}.com`;
    const bad65 = `${"a".repeat(65)}@example.com`;
    expect([ok254.length, bad255.length]).toEqual([254, 255]);
    const res = await h.invite(lan, [ok254, bad255, bad65]);
    expect(h.body(res).results.map((r) => r.result)).toEqual([
      "invited",
      "invalid_email",
      "invalid_email",
    ]);
  });

  it("invites a deactivated account like a new address, with its id and the role of the request (R9)", async () => {
    const email = mail("old");
    const old = await h.addUser(email, {
      status: "deactivated",
      role: "member",
    });
    const res = await h.invite(lan, [email], { role: "admin" });
    expect(h.body(res).results[0]!.result).toBe("invited");
    const [row] = await h.invitationsOf(email);
    expect(row).toMatchObject({ user_id: old, role: "admin" });
    // The account is not changed at this point (D-094).
    expect(await h.user(old)).toMatchObject({
      status: "deactivated",
      role: "member",
    });
  });

  it("reports an expired invitation as already_invited and does not renew it (R7)", async () => {
    const a = mail("a");
    await h.invite(lan, [a]);
    const [before] = await h.invitationsOf(a);
    h.clock.advance(8 * DAY);
    h.mail.calls.length = 0;
    const res = await h.invite(lan, [a]);
    const [result] = h.body(res).results;
    expect(result!.result).toBe("already_invited");
    expect(result!.invitation!.state).toBe("expired");
    const [after] = await h.invitationsOf(a);
    expect(after).toEqual(before);
    expect(await h.invitationsOf(a)).toHaveLength(1);
    expect(h.invitationMails()).toEqual([]);
  });

  it("keeps the invitations already made when the mail fails partway, and answers 200 (D-099)", async () => {
    const addresses = Array.from({ length: 10 }, () => mail("p"));
    for (const a of addresses.slice(3)) h.mail.failFor.add(a);
    const res = await h.invite(lan, addresses);
    expect(res.statusCode).toBe(200);
    expect(h.body(res).results.map((r) => r.result)).toEqual([
      ...Array.from({ length: 3 }, () => "invited"),
      ...Array.from({ length: 7 }, () => "mail_not_sent"),
    ]);
    const rows =
      await h.sql`select mail_status from invitations order by created_at, id`;
    expect(rows).toHaveLength(10);
    expect(rows.filter((r) => r.mail_status === "failed")).toHaveLength(7);
  });

  it("leaves one unclosed invitation when two requests invite the same address at once", async () => {
    const an = await h.admin(mail("an"));
    for (let i = 0; i < 5; i += 1) {
      const a = mail("raced");
      const [x, y] = await Promise.all([h.invite(lan, [a]), h.invite(an, [a])]);
      expect(x.statusCode).toBe(200);
      expect(y.statusCode).toBe(200);
      expect(
        [h.body(x).results[0]!.result, h.body(y).results[0]!.result].sort(),
      ).toEqual(["already_invited", "invited"]);
      expect(await h.invitationsOf(a)).toHaveLength(1);
    }
  });

  it("records invitation_created for each invited and mail_not_sent address, and nothing else (R31)", async () => {
    const a = mail("a");
    const b = mail("b");
    const member = (await h.user(await h.addUser(mail("m")))).email as string;
    h.mail.failFor.add(b);
    await h.invite(lan, [a, b, member, "bad"]);
    const rows = await h.actions();
    expect(rows.map((r) => [r.action, r.target_email])).toEqual([
      ["invitation_created", a],
      ["invitation_created", b],
    ]);
    const [row] = await h.invitationsOf(a);
    expect(rows[0]).toMatchObject({
      actor_id: lan.id,
      target_user_id: null,
      detail: { invitationId: row!.id, role: "member" },
    });
    expect((rows[0]!.created_at as Date).getTime()).toBe(h.clock.now());
  });
});

describe("the mail (R6, R12)", () => {
  it("carries the workspace name, the name of the acting Admin, the Join address and a 6-digit code", async () => {
    const a = mail("a");
    await h.invite(lan, [a]);
    const [sent] = h.invitationMails();
    expect(sent).toMatchObject({
      to: a,
      workspaceName: "Acme",
      inviterName: "Lan",
    });
    expect(sent!.code).toMatch(/^[0-9]{6}$/);
    expect(Object.keys(sent!).sort()).toEqual([
      "code",
      "inviterName",
      "joinUrl",
      "to",
      "workspaceName",
    ]);
  });

  it("the mail of one address never changes the result of another", async () => {
    const a = mail("a");
    const b = mail("b");
    const c = mail("c");
    h.mail.failFor.add(b);
    const res = await h.invite(lan, [a, b, c]);
    expect(h.body(res).results.map((r) => r.result)).toEqual([
      "invited",
      "mail_not_sent",
      "invited",
    ]);
  });
});
