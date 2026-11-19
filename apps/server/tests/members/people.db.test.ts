import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  onSessionsEnded,
  type EndReason,
} from "../../src/modules/auth/index.js";
import {
  onMemberChanged,
  type MemberChange,
} from "../../src/modules/members/index.js";
import { insertDevice, insertInvitation } from "../test-rows.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

let h: MemberHarness;
const ended: Array<{ ids: string[]; reason: EndReason }> = [];
const changes: MemberChange[] = [];
let n = 0;
const mail = (name: string) => `${name}-${(n += 1)}@example.com`;

beforeAll(async () => {
  h = await createMemberHarness();
  onSessionsEnded((ids, reason) => ended.push({ ids, reason }));
  onMemberChanged((event) => changes.push(event));
});
afterAll(async () => {
  await h?.close();
});
beforeEach(async () => {
  // Each test starts with no person, so the count of Admins is its own.
  await h.sql`truncate admin_actions, invitations, member_requests, login_codes, devices, sessions, users cascade`;
  ended.length = 0;
  changes.length = 0;
});

describe("change a role (R26)", () => {
  it("promotes a Member and demotes an Admin, and records each", async () => {
    const lan = await h.admin(mail("lan"));
    const minh = await h.person(mail("minh"));
    const up = await h.post(lan, `/members/${minh.id}/role`, { role: "admin" });
    expect(up.statusCode).toBe(200);
    expect(h.body(up).member).toEqual({
      id: minh.id,
      email: minh.email,
      displayName: "Test user",
      role: "admin",
      status: "active",
    });
    expect((await h.user(minh.id)).role).toBe("admin");

    const down = await h.post(lan, `/members/${minh.id}/role`, {
      role: "member",
    });
    expect(down.statusCode).toBe(200);
    expect(h.body(down).member.role).toBe("member");

    const rows = await h.actions();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      actor_id: lan.id,
      action: "role_changed",
      target_user_id: minh.id,
      target_email: null,
      detail: { role: "admin", earlierRole: "member" },
    });
    expect(rows[1]!.detail).toEqual({ role: "member", earlierRole: "admin" });
    expect((rows[1]!.created_at as Date).getTime()).toBe(h.clock.now());
  });

  it("answers 200 and records nothing for the role the person already has", async () => {
    const lan = await h.admin(mail("lan"));
    const minh = await h.person(mail("minh"));
    const res = await h.post(lan, `/members/${minh.id}/role`, {
      role: "member",
    });
    expect(res.statusCode).toBe(200);
    expect(h.body(res).member.role).toBe("member");
    expect(await h.actions()).toHaveLength(0);
    expect(changes).toHaveLength(0);
  });

  it("refuses demoting the only Admin with 409 last_admin", async () => {
    const lan = await h.admin(mail("lan"));
    const res = await h.post(lan, `/members/${lan.id}/role`, {
      role: "member",
    });
    expect(res.statusCode).toBe(409);
    expect(h.body(res).error.code).toBe("last_admin");
    expect((await h.user(lan.id)).role).toBe("admin");
    expect(await h.actions()).toHaveLength(0);
  });

  it("lets an Admin demote themselves and another Admin when there are two", async () => {
    const lan = await h.admin(mail("lan"));
    const an = await h.admin(mail("an"));
    const self = await h.post(lan, `/members/${lan.id}/role`, {
      role: "member",
    });
    expect(self.statusCode).toBe(200);
    expect((await h.user(lan.id)).role).toBe("member");
    // The demoted Admin is refused on the next request (R34).
    const after = await h.post(lan, `/members/${an.id}/role`, {
      role: "member",
    });
    expect(after.statusCode).toBe(403);
    expect(h.body(after).error.code).toBe("forbidden");
  });

  it("changes the role of a deactivated Admin and of a deactivated Member", async () => {
    const lan = await h.admin(mail("lan"));
    const oldAdmin = await h.addUser(mail("old-admin"), {
      role: "admin",
      status: "deactivated",
    });
    const oldMember = await h.addUser(mail("old-member"), {
      status: "deactivated",
    });
    const down = await h.post(lan, `/members/${oldAdmin}/role`, {
      role: "member",
    });
    expect(down.statusCode).toBe(200);
    expect(h.body(down).member).toMatchObject({
      role: "member",
      status: "deactivated",
    });
    const up = await h.post(lan, `/members/${oldMember}/role`, {
      role: "admin",
    });
    expect(up.statusCode).toBe(200);
    expect(await h.actions()).toHaveLength(2);
  });

  it("answers 404 not_found for a person who does not exist", async () => {
    const lan = await h.admin(mail("lan"));
    const res = await h.post(lan, `/members/${crypto.randomUUID()}/role`, {
      role: "admin",
    });
    expect(res.statusCode).toBe(404);
    expect(h.body(res).error.code).toBe("not_found");
  });

  it("answers 400 validation_failed for an unknown role and an id that is not a UUID", async () => {
    const lan = await h.admin(mail("lan"));
    const minh = await h.person(mail("minh"));
    for (const [url, payload] of [
      [`/members/${minh.id}/role`, { role: "owner" }],
      [`/members/${minh.id}/role`, {}],
      [`/members/not-a-uuid/role`, { role: "admin" }],
    ] as const) {
      const res = await h.post(lan, url, payload);
      expect(res.statusCode).toBe(400);
      expect(h.body(res).error.code).toBe("validation_failed");
    }
  });

  it("publishes one event after a change, with the old and the new value", async () => {
    const lan = await h.admin(mail("lan"));
    const minh = await h.person(mail("minh"));
    await h.post(lan, `/members/${minh.id}/role`, { role: "admin" });
    expect(changes).toHaveLength(1);
    const [row] = await h.actions();
    expect(changes[0]).toEqual({
      kind: "role_changed",
      actorId: lan.id,
      targetId: minh.id,
      before: { role: "member", status: "active" },
      after: { role: "admin", status: "active" },
      at: row!.created_at,
    });
  });
});

describe("deactivate (R28, R29)", () => {
  it("deactivates a Member, ends every session in the same change and tells the listeners after it", async () => {
    const lan = await h.admin(mail("lan"));
    const minh = await h.person(mail("minh"));
    const second = await h.signIn(minh.email, "token");
    const live = await h.liveSessions(minh.id);
    expect(live).toHaveLength(2);

    const res = await h.post(lan, `/members/${minh.id}/deactivate`);
    expect(res.statusCode).toBe(200);
    expect(h.body(res).member).toMatchObject({
      id: minh.id,
      status: "deactivated",
      role: "member",
    });
    expect(await h.liveSessions(minh.id)).toEqual([]);
    const reasons =
      await h.sql`select distinct ended_reason from sessions where user_id = ${minh.id}`;
    expect(reasons.map((r) => r.ended_reason)).toEqual(["deactivated"]);
    expect(ended).toHaveLength(1);
    expect(ended[0]!.reason).toBe("deactivated");
    expect([...ended[0]!.ids].sort()).toEqual([...live].sort());

    // Both of the person's sessions are refused afterwards.
    const cookie = await h.get(minh, "/protected");
    expect(cookie.statusCode).toBe(401);
    expect(h.body(cookie).error.code).toBe("account_deactivated");
    const token = await h.call({
      method: "GET",
      url: "/api/v1/protected",
      headers: { authorization: `Bearer ${second.secret}` },
    });
    expect(h.body(token).error.code).toBe("account_deactivated");

    const [row] = await h.actions();
    expect(row).toMatchObject({
      actor_id: lan.id,
      action: "account_deactivated",
      target_user_id: minh.id,
    });
    expect(changes).toEqual([
      {
        kind: "account_deactivated",
        actorId: lan.id,
        targetId: minh.id,
        before: { role: "member", status: "active" },
        after: { role: "member", status: "deactivated" },
        at: row!.created_at,
      },
    ]);
  });

  it("deletes no message, member row, device row or account row (BR-29)", async () => {
    const lan = await h.admin(mail("lan"));
    const minh = await h.person(mail("minh"));
    const [session] = await h.liveSessions(minh.id);
    await insertDevice(h.sql, {
      workspace_id: h.workspaceId,
      user_id: minh.id,
      session_id: session!,
    });
    const before = await h.sql`select
      (select count(*) from users)::int as users,
      (select count(*) from sessions)::int as sessions,
      (select count(*) from devices)::int as devices`;
    await h.post(lan, `/members/${minh.id}/deactivate`);
    const after = await h.sql`select
      (select count(*) from users)::int as users,
      (select count(*) from sessions)::int as sessions,
      (select count(*) from devices)::int as devices`;
    expect(after[0]).toEqual(before[0]);
    expect(after[0]!.devices).toBe(1);
  });

  it("refuses the actor deactivating themselves with 409 self_target", async () => {
    const lan = await h.admin(mail("lan"));
    await h.admin(mail("an"));
    const res = await h.post(lan, `/members/${lan.id}/deactivate`);
    expect(res.statusCode).toBe(409);
    expect(h.body(res).error.code).toBe("self_target");
    expect((await h.user(lan.id)).status).toBe("active");
  });

  it("deactivates another Admin while two are active", async () => {
    const lan = await h.admin(mail("lan"));
    const an = await h.admin(mail("an"));
    const res = await h.post(lan, `/members/${an.id}/deactivate`);
    expect(res.statusCode).toBe(200);
    expect((await h.user(an.id)).status).toBe("deactivated");
  });

  it("answers 200, records nothing and ends a session left alive for an already deactivated person", async () => {
    const lan = await h.admin(mail("lan"));
    const minh = await h.person(mail("minh"));
    await h.post(lan, `/members/${minh.id}/deactivate`);
    ended.length = 0;
    changes.length = 0;
    // A session that a sign-in running at that moment may have made.
    const left = crypto.randomUUID();
    await h.sql`insert into sessions (id, workspace_id, created_at, user_id, secret_hash, kind, last_used_at)
      values (${left}, ${h.workspaceId}, ${new Date()}, ${minh.id}, ${"c".repeat(64)}, 'cookie', ${new Date()})`;

    const res = await h.post(lan, `/members/${minh.id}/deactivate`);
    expect(res.statusCode).toBe(200);
    expect(h.body(res).member.status).toBe("deactivated");
    expect(await h.actions()).toHaveLength(1);
    expect(changes).toHaveLength(0);
    expect(await h.liveSessions(minh.id)).toEqual([]);
    expect(ended).toEqual([{ ids: [left], reason: "deactivated" }]);
  });

  it("answers 404 for an unknown person and 400 for an id that is not a UUID", async () => {
    const lan = await h.admin(mail("lan"));
    const missing = await h.post(
      lan,
      `/members/${crypto.randomUUID()}/deactivate`,
    );
    expect(missing.statusCode).toBe(404);
    expect(h.body(missing).error.code).toBe("not_found");
    const bad = await h.post(lan, `/members/abc/deactivate`);
    expect(bad.statusCode).toBe(400);
    expect(h.body(bad).error.code).toBe("validation_failed");
  });
});

describe("reactivate (R30)", () => {
  it("brings the person back with the role, the name and the sessions ended, and they sign in again", async () => {
    const lan = await h.admin(mail("lan"));
    const minh = await h.person(mail("minh"), {
      role: "admin",
      display_name: "Minh",
    });
    await h.post(lan, `/members/${minh.id}/deactivate`);
    // A session that was never ended must not live again.
    const left = crypto.randomUUID();
    await h.sql`insert into sessions (id, workspace_id, created_at, user_id, secret_hash, kind, last_used_at)
      values (${left}, ${h.workspaceId}, ${new Date()}, ${minh.id}, ${"d".repeat(64)}, 'cookie', ${new Date()})`;
    ended.length = 0;
    changes.length = 0;

    const res = await h.post(lan, `/members/${minh.id}/reactivate`);
    expect(res.statusCode).toBe(200);
    expect(h.body(res).member).toEqual({
      id: minh.id,
      email: minh.email,
      displayName: "Minh",
      role: "admin",
      status: "active",
    });
    expect(await h.liveSessions(minh.id)).toEqual([]);
    expect(ended).toEqual([{ ids: [left], reason: "deactivated" }]);

    // The old cookie stays ended; a new sign-in works.
    const old = await h.get(minh, "/protected");
    expect(h.body(old).error.code).toBe("session_ended");
    const again = await h.signIn(minh.email);
    expect(again.res.statusCode).toBe(200);

    const rows = await h.actions();
    expect(rows.at(-1)).toMatchObject({
      actor_id: lan.id,
      action: "account_reactivated",
      target_user_id: minh.id,
      detail: { role: "admin" },
    });
    expect(changes).toEqual([
      {
        kind: "account_reactivated",
        actorId: lan.id,
        targetId: minh.id,
        before: { role: "admin", status: "deactivated" },
        after: { role: "admin", status: "active" },
        at: rows.at(-1)!.created_at,
      },
    ]);
  });

  it("closes an unclosed invitation of the person, keeps the account's role and records the closed invitation", async () => {
    const lan = await h.admin(mail("lan"));
    const email = mail("minh");
    const minh = await h.addUser(email, { status: "deactivated" });
    const invitation = await insertInvitation(h.sql, {
      workspace_id: h.workspaceId,
      invited_by: lan.id,
      email,
      user_id: minh,
      role: "admin",
    });
    const res = await h.post(lan, `/members/${minh}/reactivate`);
    expect(res.statusCode).toBe(200);
    expect(h.body(res).member.role).toBe("member");
    const [row] =
      await h.sql`select used_at, used_by, revoked_at from invitations where id = ${invitation}`;
    expect((row!.used_at as Date).getTime()).toBe(h.clock.now());
    expect(row!.used_by).toBe(minh);
    expect(row!.revoked_at).toBeNull();
    const [recorded] = await h.actions();
    expect(recorded!.detail).toEqual({
      role: "member",
      closedInvitation: { id: invitation, role: "admin" },
    });
  });

  it("answers 200, changes nothing and ends no session for an active person", async () => {
    const lan = await h.admin(mail("lan"));
    const minh = await h.person(mail("minh"));
    const res = await h.post(lan, `/members/${minh.id}/reactivate`);
    expect(res.statusCode).toBe(200);
    expect(h.body(res).member.status).toBe("active");
    expect(await h.liveSessions(minh.id)).toHaveLength(1);
    expect(await h.actions()).toHaveLength(0);
    expect(changes).toHaveLength(0);
    expect(ended).toHaveLength(0);
  });

  it("answers 404 for an unknown person", async () => {
    const lan = await h.admin(mail("lan"));
    const res = await h.post(lan, `/members/${crypto.randomUUID()}/reactivate`);
    expect(res.statusCode).toBe(404);
    expect(h.body(res).error.code).toBe("not_found");
  });
});
