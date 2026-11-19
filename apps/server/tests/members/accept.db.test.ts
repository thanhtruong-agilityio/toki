import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createGeneralChannel,
  isConversationMember,
} from "../../src/modules/conversations/index.js";
import {
  acceptInvitation,
  onMemberChanged,
} from "../../src/modules/members/index.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

// Accepting an invitation (R20): the account is created or brought back, the
// invitation is closed and the person joins #general, in the caller's
// transaction.

let h: MemberHarness;
let lan: Awaited<ReturnType<MemberHarness["admin"]>>;
let general: string;
let n = 0;
const mail = (name: string) => `${name}-${(n += 1)}@example.com`;
const DAY = 24 * 60 * 60 * 1000;
const now = () => new Date(h.clock.now());
const events: unknown[] = [];

beforeAll(async () => {
  h = await createMemberHarness();
  onMemberChanged((e) => events.push(e));
});
afterAll(async () => {
  await h?.close();
});
beforeEach(async () => {
  await h.sql`truncate admin_actions, invitations, member_requests, login_codes, devices, sessions, conversation_members, conversations, users cascade`;
  h.mail.calls.length = 0;
  events.length = 0;
  lan = await h.admin(mail("lan"));
  general = await createGeneralChannel(h.db, {
    workspaceId: h.workspaceId,
    createdBy: lan.id,
    createdAt: now(),
  });
});

async function invited(email: string, role = "member") {
  const res = await h.invite(lan, [email], { role });
  return {
    id: h.body(res).results[0]!.invitation!.id,
    token: h.tokenOf(h.invitationMails().at(-1)!),
  };
}
const accept = (token: string, at = now()) =>
  h.db.transaction((tx) => acceptInvitation(tx, { token, now: at }));
const memberRows = async (userId: string) =>
  (
    await h.sql`select count(*)::int as n from conversation_members where user_id = ${userId}`
  )[0]!.n as number;

describe("a new address (R20 step 4)", () => {
  it.each(["member", "admin"])(
    "gets an active account with the role %s, the name before the @, the language en, and joins #general",
    async (role) => {
      const email = mail("minh.tran");
      const made = await invited(email, role);
      h.clock.advance(DAY);
      const out = await accept(made.token);
      if (!out.ok) throw new Error(out.error);
      expect(out).toEqual({
        ok: true,
        account: {
          id: expect.any(String),
          email,
          displayName: email.split("@")[0],
          role,
          status: "active",
          language: "en",
        },
        created: true,
        reactivated: false,
        generalConversationId: general,
        endedSessionIds: [],
      });
      const user = await h.user(out.account.id);
      expect(user).toMatchObject({
        workspace_id: h.workspaceId,
        email,
        role,
        status: "active",
        language: "en",
      });
      expect((user.created_at as Date).getTime()).toBe(h.clock.now());
      expect((user.id as string)[14]).toBe("7");
      const row = await h.invitation(made.id);
      expect((row.used_at as Date).getTime()).toBe(h.clock.now());
      expect(row.used_by).toBe(out.account.id);
      expect(await isConversationMember(h.db, out.account.id, general)).toBe(
        true,
      );
      expect(await memberRows(out.account.id)).toBe(1);
      // Not an administrative action, and no event.
      expect(
        (await h.actions()).filter((r) => r.action !== "invitation_created"),
      ).toEqual([]);
      expect(events).toEqual([]);
    },
  );

  it("keeps a 64-character part before the @ as the name", async () => {
    const local = "a".repeat(64);
    const made = await invited(`${local}@example.com`);
    const out = await accept(made.token);
    if (!out.ok) throw new Error(out.error);
    expect(out.account.displayName).toBe(local);
  });
});

describe("a deactivated account (R20 step 5)", () => {
  it("comes back as the same account with the new role, its name and memberships, and its sessions ended", async () => {
    const email = mail("old");
    const old = await h.person(email, {
      role: "member",
      display_name: "Old Name",
      language: "vi",
    });
    await h.sql`insert into conversation_members (conversation_id, user_id, workspace_id, is_muted, is_starred, created_at)
      values (${general}, ${old.id}, ${h.workspaceId}, false, false, ${now()})`;
    await h.sql`update users set status = 'deactivated' where id = ${old.id}`;
    const [live] = await h.liveSessions(old.id);
    const made = await invited(email, "admin");
    const usersBefore = (await h.sql`select count(*)::int as n from users`)[0]!
      .n;

    // Until the accept, the old cookie is refused as account_deactivated.
    expect(h.body(await h.get(old, "/protected")).error.code).toBe(
      "account_deactivated",
    );
    const out = await accept(made.token);
    if (!out.ok) throw new Error(out.error);
    expect(out).toEqual({
      ok: true,
      account: {
        id: old.id,
        email,
        displayName: "Old Name",
        role: "admin",
        status: "active",
        language: "vi",
      },
      created: false,
      reactivated: true,
      generalConversationId: general,
      endedSessionIds: [live],
    });
    expect((await h.sql`select count(*)::int as n from users`)[0]!.n).toBe(
      usersBefore,
    );
    expect(await memberRows(old.id)).toBe(1);
    expect(await h.liveSessions(old.id)).toEqual([]);
    // After it, the old cookie is an ended session.
    expect(h.body(await h.get(old, "/protected")).error.code).toBe(
      "session_ended",
    );
    const recorded = (await h.actions()).filter(
      (r) => r.action === "account_reactivated",
    );
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      actor_id: old.id,
      target_user_id: old.id,
      detail: {
        via: "invitation",
        invitationId: made.id,
        invitedBy: lan.id,
        role: "admin",
        earlierRole: "member",
      },
    });
    expect(events).toEqual([]);
  });
});

describe("an account that is active already (R20 step 6)", () => {
  it("changes nothing in the account, closes the invitation and answers account_active", async () => {
    const email = mail("raced");
    const made = await invited(email, "admin");
    // Another path made the account active in between.
    const id = await h.addUser(email, { role: "member", display_name: "Kept" });
    const before = await h.user(id);
    const out = await accept(made.token);
    expect(out).toEqual({ ok: false, error: "account_active" });
    expect(await h.user(id)).toEqual(before);
    expect(await memberRows(id)).toBe(0);
    const row = await h.invitation(made.id);
    expect(row.used_at).not.toBeNull();
    expect(row.used_by).toBe(id);
    expect(await h.liveSessions(id)).toEqual([]);
  });
});

describe("refusals (R20 steps 1 and 3)", () => {
  it("answers each state and writes nothing", async () => {
    const expired = await invited(mail("a"));
    const revoked = await invited(mail("b"));
    const used = await invited(mail("c"));
    await h.post(lan, `/invitations/${revoked.id}/revoke`);
    await h.sql`update invitations set used_at = ${now()}, used_by = ${lan.id} where id = ${used.id}`;
    const snapshot = async () =>
      JSON.stringify([
        await h.sql`select * from users order by id`,
        await h.sql`select * from invitations order by id`,
        await h.sql`select * from conversation_members order by user_id`,
        await h.sql`select * from admin_actions order by id`,
      ]);
    const before = await snapshot();
    const error = async (token: string, at = now()) => {
      const out = await accept(token, at);
      return out.ok ? "ok" : out.error;
    };
    expect(await error("C".repeat(43))).toBe("invitation_not_found");
    expect(await error("bad")).toBe("invitation_not_found");
    expect(await error(revoked.token)).toBe("invitation_revoked");
    expect(await error(used.token)).toBe("invitation_used");
    const boundary = new Date(h.clock.now() + 7 * DAY);
    expect(await error(expired.token, boundary)).toBe("invitation_expired");
    expect(await snapshot()).toBe(before);
    // One second before the 7 days it still works.
    expect(
      await error(expired.token, new Date(boundary.getTime() - 1000)),
    ).toBe("ok");
  });
});

describe("under load (R20)", () => {
  it("lets one of two accepts at the same moment through; the other reads used (5 times)", async () => {
    for (let i = 0; i < 5; i += 1) {
      const email = mail("twice");
      const made = await invited(email);
      const [x, y] = await Promise.all([
        accept(made.token),
        accept(made.token),
      ]);
      expect([x.ok, y.ok].sort()).toEqual([false, true]);
      expect(x.ok ? y : x).toEqual({ ok: false, error: "invitation_used" });
      const people = await h.sql`select id from users where email = ${email}`;
      expect(people).toHaveLength(1);
      expect(await memberRows(people[0]!.id as string)).toBe(1);
    }
  });

  it("an accept and an Admin's reactivation of the same person at once leave one change (5 times)", async () => {
    for (let i = 0; i < 5; i += 1) {
      const email = mail("both");
      const old = await h.addUser(email, { status: "deactivated" });
      const made = await invited(email, "admin");
      const [x, y] = await Promise.all([
        accept(made.token),
        h.post(lan, `/members/${old}/reactivate`),
      ]);
      expect(y.statusCode).toBe(200);
      const user = await h.user(old);
      expect(user.status).toBe("active");
      if (x.ok) {
        // The accept came first: the invitation's role; the Admin's request
        // then found an active person and changed nothing.
        expect(user.role).toBe("admin");
      } else {
        // The reactivation came first and closed the invitation.
        expect(["invitation_used", "account_active"]).toContain(x.error);
        expect(user.role).toBe("member");
      }
      expect(
        (await h.actions()).filter(
          (r) => r.action === "account_reactivated" && r.target_user_id === old,
        ),
      ).toHaveLength(1);
    }
  });

  it("writes nothing when the caller's transaction rolls back", async () => {
    const email = mail("rolled");
    const old = await h.person(email);
    await h.sql`update users set status = 'deactivated' where id = ${old.id}`;
    const made = await invited(email);
    await h.db
      .transaction(async (tx) => {
        const out = await acceptInvitation(tx, {
          token: made.token,
          now: now(),
        });
        expect(out.ok).toBe(true);
        throw new Error("the caller failed");
      })
      .catch(() => {});
    expect((await h.user(old.id)).status).toBe("deactivated");
    expect((await h.invitation(made.id)).used_at).toBeNull();
    expect(await h.liveSessions(old.id)).toHaveLength(1);
    expect(await memberRows(old.id)).toBe(0);
  });
});
