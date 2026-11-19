import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMemberHarness, type MemberHarness } from "./setup.js";

// What the module keeps out of the log and out of error bodies (R32), and the
// age rule for old invitation codes (R33).

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
  lan = await h.admin(mail("lan"));
});

describe("the log and the error bodies (R32)", () => {
  it("never hold an address, a token, a code, a Join address or a key", async () => {
    const a = mail("secret-person");
    const failing = mail("failing-person");
    h.mail.failFor.add(failing);
    const key = "very-private-key-value";
    const first = await h.invite(lan, [a, failing, "not an address"], { key });
    const sent = h.invitationMails();
    const id = h.body(first).results[0]!.invitation!.id;
    const resendKey = "another-private-key";
    const resent = await h.post(lan, `/invitations/${id}/resend`, undefined, {
      headers: { "idempotency-key": resendKey },
    });
    const all = h.invitationMails();
    const bodies: string[] = [first.body, resent.body];
    // The refusals of the routes carry no value either.
    for (const res of [
      await h.invite(lan, [a], { key }),
      await h.invite(lan, [mail("other")], { key }),
      await h.invite(lan, [a], { key: null }),
      await h.post(lan, `/invitations/${id}/revoke`),
      await h.post(lan, `/invitations/${id}/resend`, undefined, {
        headers: { "idempotency-key": "bad key" },
      }),
    ]) {
      bodies.push(res.body);
    }
    const log = h.logText();
    const secrets = [
      a,
      failing,
      key,
      resendKey,
      ...all.flatMap((m) => [h.tokenOf(m), m.code, m.joinUrl]),
    ];
    expect(sent.length).toBeGreaterThan(0);
    for (const secret of secrets) {
      expect(log, `the log holds ${secret.slice(0, 12)}`).not.toContain(secret);
    }
    // An error body never echoes what was sent.
    for (const body of bodies.slice(2)) {
      for (const secret of [a, key, resendKey]) {
        expect(body).not.toContain(secret);
      }
    }
  });

  it("logs a failing query by its kind and not by its parameters", async () => {
    const a = mail("param-person");
    await h.sql.unsafe(
      `alter table invitations add constraint fail_in_test check (email <> '${a}') not valid`,
    );
    try {
      const res = await h.invite(lan, [a], { key: "param-key" });
      expect(res.statusCode).toBe(500);
      expect(res.body).not.toContain(a);
    } finally {
      await h.sql`alter table invitations drop constraint fail_in_test`;
    }
    const log = h.logText();
    expect(log).not.toContain(a);
    expect(log).not.toContain("param-key");
  });

  it("logs no line of its own for a mail that failed", async () => {
    const a = mail("mailfail");
    h.mail.failFor.add(a);
    await h.invite(lan, [a]);
    expect(h.logText()).not.toMatch(/mail/i);
  });
});

describe("old invitation codes (R33)", () => {
  const codes = () =>
    h.sql`select purpose, created_at from login_codes order by created_at, id`;

  it("a batch deletes invitation codes older than 8 days, and leaves younger ones and sign-in rows", async () => {
    await h.invite(lan, [mail("old")]);
    const old = new Date(h.clock.now());
    h.clock.advance(8 * DAY + 1000);
    await h.invite(lan, [mail("recent")]);
    h.clock.advance(7 * DAY);
    await h.invite(lan, [mail("newest")]);
    const rows = await codes();
    const invitation = rows.filter((r) => r.purpose === "invitation");
    expect(
      invitation.every(
        (r) => (r.created_at as Date).getTime() > old.getTime() + 8 * DAY,
      ),
    ).toBe(true);
    // The sign-in rows of the Admins are kept: only 'invitation' is pruned.
    expect(rows.some((r) => r.purpose === "sign_in")).toBe(true);
  });

  it("a resend deletes them too, at most 100 at a time", async () => {
    const made = await h.invite(lan, [mail("a")]);
    const id = h.body(made).results[0]!.invitation!.id;
    const stale = Array.from({ length: 130 }, (_, i) => ({
      id: crypto.randomUUID(),
      workspace_id: h.workspaceId,
      created_at: new Date(h.clock.now() - 10 * DAY),
      purpose: "invitation",
      email: `stale${i}@example.com`,
      user_id: null,
      request_hash: i.toString(16).padStart(64, "0"),
      code_hash: i.toString(16).padStart(64, "1"),
      expires_at: new Date(h.clock.now() - 9 * DAY),
    }));
    await h.sql`insert into login_codes ${h.sql(stale)}`;
    const count = async () =>
      (
        await h.sql`select count(*)::int as n from login_codes where purpose = 'invitation' and email like 'stale%'`
      )[0]!.n as number;
    expect(await count()).toBe(130);
    await h.post(lan, `/invitations/${id}/resend`, undefined, {
      headers: { "idempotency-key": h.key() },
    });
    expect(await count()).toBe(30);
    await h.post(lan, `/invitations/${id}/resend`, undefined, {
      headers: { "idempotency-key": h.key() },
    });
    expect(await count()).toBe(0);
  });
});
