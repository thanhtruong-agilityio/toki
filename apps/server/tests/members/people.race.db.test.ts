import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMemberHarness, type MemberHarness } from "./setup.js";

// Two requests at the same moment, on real connections of the app's pool
// (R27, R39). Nothing here waits for a time: a request that must wait is seen
// waiting in pg_stat_activity before the other side goes on.

let h: MemberHarness;
let n = 0;
const mail = (name: string) => `${name}-${(n += 1)}@example.com`;

beforeAll(async () => {
  h = await createMemberHarness();
});
afterAll(async () => {
  await h?.close();
});
beforeEach(async () => {
  await h.sql`truncate admin_actions, invitations, member_requests, login_codes, devices, sessions, users cascade`;
  h.mail.calls.length = 0;
});

const admins = async () =>
  (
    await h.sql`select id from users where role = 'admin' and status = 'active'`
  ).map((r) => r.id as string);

// Resolves when some backend waits for a row lock.
async function someoneWaits() {
  for (;;) {
    const [row] = await h.sql`
      select count(*)::int as n from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'`;
    if (row!.n > 0) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
}

const REPEAT = 20;

describe("the last Admin under load (R27)", () => {
  it(`two Admins demote each other at once: one succeeds, the other wakes up as a Member (${REPEAT} times)`, async () => {
    for (let i = 0; i < REPEAT; i += 1) {
      await h.sql`truncate admin_actions, sessions, users cascade`;
      const a = await h.admin(mail("a"));
      const b = await h.admin(mail("b"));
      const [x, y] = await Promise.all([
        h.post(a, `/members/${b.id}/role`, { role: "member" }),
        h.post(b, `/members/${a.id}/role`, { role: "member" }),
      ]);
      expect([x.statusCode, y.statusCode].sort()).toEqual([200, 403]);
      const refused = x.statusCode === 403 ? x : y;
      expect(h.body(refused).error.code).toBe("forbidden");
      expect(await admins()).toHaveLength(1);
      expect(await h.actions()).toHaveLength(1);
    }
  });

  it(`two Admins deactivate each other at once: one succeeds, the other is account_deactivated (${REPEAT} times)`, async () => {
    for (let i = 0; i < REPEAT; i += 1) {
      await h.sql`truncate admin_actions, sessions, users cascade`;
      const a = await h.admin(mail("a"));
      const b = await h.admin(mail("b"));
      const [x, y] = await Promise.all([
        h.post(a, `/members/${b.id}/deactivate`),
        h.post(b, `/members/${a.id}/deactivate`),
      ]);
      expect([x.statusCode, y.statusCode].sort()).toEqual([200, 401]);
      const refused = x.statusCode === 401 ? x : y;
      expect(h.body(refused).error.code).toBe("account_deactivated");
      expect(await admins()).toHaveLength(1);
      expect(await h.actions()).toHaveLength(1);
    }
  });

  it(`a demoted Admin whose request was already waiting is refused, and its target is unchanged (${REPEAT} times)`, async () => {
    for (let i = 0; i < REPEAT; i += 1) {
      await h.sql`truncate admin_actions, sessions, users cascade`;
      await h.admin(mail("a"));
      const b = await h.admin(mail("b"));
      const c = await h.admin(mail("c"));
      let waiting!: ReturnType<typeof h.post>;
      // A's demotion of B, in flight: the rows are locked as the route locks
      // them and B's role is changed, not yet committed.
      await h.sql.begin(async (tx) => {
        await tx`select id from users where workspace_id = ${h.workspaceId} order by id for no key update`;
        await tx`update users set role = 'member' where id = ${b.id}`;
        waiting = h.post(b, `/members/${c.id}/deactivate`);
        await someoneWaits();
      });
      const res = await waiting;
      expect(res.statusCode).toBe(403);
      expect(h.body(res).error.code).toBe("forbidden");
      expect((await h.user(c.id)).status).toBe("active");
      expect(await h.actions()).toHaveLength(0);
    }
  });

  it("a deactivated Admin whose request was already waiting gets 401 account_deactivated", async () => {
    await h.admin(mail("a"));
    const b = await h.admin(mail("b"));
    const c = await h.person(mail("c"));
    let waiting!: ReturnType<typeof h.post>;
    await h.sql.begin(async (tx) => {
      await tx`select id from users where workspace_id = ${h.workspaceId} order by id for no key update`;
      await tx`update users set status = 'deactivated' where id = ${b.id}`;
      waiting = h.post(b, `/members/${c.id}/role`, { role: "admin" });
      await someoneWaits();
    });
    const res = await waiting;
    expect(res.statusCode).toBe(401);
    expect(h.body(res).error.code).toBe("account_deactivated");
    expect((await h.user(c.id)).role).toBe("member");
  });

  it("a request whose session ends while it is being checked gets 401 account_deactivated when the account was deactivated", async () => {
    // The check read an active account and an active session; then the account was deactivated and
    // its sessions ended (committed after that read). The renewal of the session finds it ended:
    // the account comes before the session (R27), so the answer is account_deactivated and not
    // session_ended. The rows of the session are locked as a deactivation locks them.
    await h.admin(mail("a"));
    const b = await h.admin(mail("b"));
    let waiting!: ReturnType<typeof h.post>;
    await h.sql.begin(async (tx) => {
      await tx`update sessions set ended_at = now(), ended_reason = 'deactivated' where user_id = ${b.id}`;
      await tx`update users set status = 'deactivated' where id = ${b.id}`;
      waiting = h.post(b, `/members/${b.id}/role`, { role: "member" });
      await someoneWaits();
    });
    const res = await waiting;
    expect(res.statusCode).toBe(401);
    expect(h.body(res).error.code).toBe("account_deactivated");
  });

  it("counts an Admin promoted by a request that committed while this one waited", async () => {
    // One Admin; a second is being promoted. The demotion of the first waits
    // and then sees two Admins, so it succeeds: the count is read under the lock.
    const a = await h.admin(mail("a"));
    const b = await h.person(mail("b"));
    let waiting!: ReturnType<typeof h.post>;
    await h.sql.begin(async (tx) => {
      await tx`select id from users where workspace_id = ${h.workspaceId} order by id for no key update`;
      await tx`update users set role = 'admin' where id = ${b.id}`;
      waiting = h.post(a, `/members/${a.id}/role`, { role: "member" });
      await someoneWaits();
    });
    const res = await waiting;
    expect(res.statusCode).toBe(200);
    expect(await admins()).toEqual([b.id]);
  });

  it("does not wait for a sign-in of a locked person, and a sign-in does not wait for it (key share)", async () => {
    const a = await h.admin(mail("a"));
    const b = await h.person(mail("b"));
    await h.sql.begin(async (tx) => {
      // What a session insert holds on the person's row.
      await tx`select id from users where id = ${b.id} for key share`;
      const res = await h.post(a, `/members/${b.id}/role`, { role: "admin" });
      expect(res.statusCode).toBe(200);
    });
    await h.sql.begin(async (tx) => {
      await tx`select id from users where workspace_id = ${h.workspaceId} order by id for no key update`;
      const signIn = await h.signIn(b.email);
      expect(signIn.res.statusCode).toBe(200);
    });
  });
});

describe("a change that fails leaves nothing (R28)", () => {
  it("answers 500, keeps the status, records nothing, tells no listener, and succeeds when sent again", async () => {
    const { onSessionsEnded } = await import("../../src/modules/auth/index.js");
    const heard: string[][] = [];
    const stop = onSessionsEnded((ids) => heard.push(ids));
    const a = await h.admin(mail("a"));
    const b = await h.person(mail("b"));
    await h.sql
      .unsafe(`create function fail_session_end() returns trigger language plpgsql as $$
      begin
        if new.user_id = '${b.id}'::uuid and new.ended_at is not null then
          raise exception 'sessions cannot be ended in this test';
        end if;
        return new;
      end $$`);
    await h.sql`create trigger fail_session_end_trg before update on sessions
      for each row execute function fail_session_end()`;
    try {
      const res = await h.post(a, `/members/${b.id}/deactivate`);
      expect(res.statusCode).toBe(500);
      expect(h.body(res).error.code).toBe("internal_error");
      expect((await h.user(b.id)).status).toBe("active");
      expect(await h.actions()).toHaveLength(0);
      expect(await h.liveSessions(b.id)).toHaveLength(1);
      expect(heard).toEqual([]);
    } finally {
      await h.sql`drop trigger fail_session_end_trg on sessions`;
      await h.sql`drop function fail_session_end()`;
    }
    const again = await h.post(a, `/members/${b.id}/deactivate`);
    expect(again.statusCode).toBe(200);
    expect(heard).toHaveLength(1);
    stop();
  });
});

describe("invitations and person routes together (R39)", () => {
  const PAIRS = 5;

  it("refuses a batch whose actor was demoted while it waited, and stores no answer", async () => {
    const a = await h.admin(mail("a"));
    await h.admin(mail("b"));
    let waiting!: ReturnType<typeof h.invite>;
    await h.sql.begin(async (tx) => {
      await tx`select id from users where workspace_id = ${h.workspaceId} order by id for no key update`;
      await tx`update users set role = 'member' where id = ${a.id}`;
      waiting = h.invite(a, [mail("x")]);
      await someoneWaits();
    });
    const res = await waiting;
    expect(res.statusCode).toBe(403);
    expect(h.body(res).error.code).toBe("forbidden");
    expect(await h.sql`select id from invitations`).toEqual([]);
    expect(await h.sql`select id from member_requests`).toEqual([]);
  });

  it("stops a batch partway when the actor is no longer an Admin: the invitations made stay and are recorded", async () => {
    const a = await h.admin(mail("a"));
    await h.admin(mail("b"));
    const third = mail("third");
    // The actor is demoted in the transaction of the second address.
    const second = mail("second");
    await h.sql
      .unsafe(`create function demote_in_test() returns trigger language plpgsql as $$
      begin
        if new.email = '${second}' then
          update users set role = 'member' where id = '${a.id}';
        end if;
        return new;
      end $$`);
    await h.sql`create trigger demote_in_test_trg after insert on invitations
      for each row execute function demote_in_test()`;
    try {
      const res = await h.invite(a, [mail("first"), second, third]);
      expect(res.statusCode).toBe(403);
      expect(h.body(res).error.code).toBe("forbidden");
    } finally {
      await h.sql`drop trigger demote_in_test_trg on invitations`;
      await h.sql`drop function demote_in_test()`;
    }
    expect(await h.sql`select id from invitations`).toHaveLength(2);
    expect(await h.invitationsOf(third)).toEqual([]);
    expect(await h.actions()).toHaveLength(2);
    expect(await h.sql`select id from member_requests`).toEqual([]);
  });

  it(`a batch that invites a deactivated person and a reactivation of that person at once finish without a deadlock (${PAIRS} times)`, async () => {
    const a = await h.admin(mail("a"));
    const b = await h.admin(mail("b"));
    for (let i = 0; i < PAIRS; i += 1) {
      const email = mail("old");
      const old = await h.addUser(email, { status: "deactivated" });
      const [x, y] = await Promise.all([
        h.invite(a, [email]),
        h.post(b, `/members/${old}/reactivate`),
      ]);
      expect([x.statusCode, y.statusCode]).toEqual([200, 200]);
      expect((await h.user(old)).status).toBe("active");
    }
  });

  it(`a batch and a deactivation of the acting Admin at once finish without a deadlock (${PAIRS} times)`, async () => {
    for (let i = 0; i < PAIRS; i += 1) {
      const a = await h.admin(mail("a"));
      const b = await h.admin(mail("b"));
      const [x, y] = await Promise.all([
        h.invite(a, [mail("p"), mail("q")]),
        h.post(b, `/members/${a.id}/deactivate`),
      ]);
      expect(y.statusCode).toBe(200);
      expect([200, 401]).toContain(x.statusCode);
    }
  });

  it(`a resend and a reactivation of the person at once finish without a deadlock (${PAIRS} times)`, async () => {
    const a = await h.admin(mail("a"));
    const b = await h.admin(mail("b"));
    for (let i = 0; i < PAIRS; i += 1) {
      const email = mail("old");
      const old = await h.addUser(email, { status: "deactivated" });
      const made = await h.invite(a, [email]);
      const id = h.body(made).results[0]!.invitation!.id;
      const [x, y] = await Promise.all([
        h.post(a, `/invitations/${id}/resend`, undefined, {
          headers: { "idempotency-key": h.key() },
        }),
        h.post(b, `/members/${old}/reactivate`),
      ]);
      expect(y.statusCode).toBe(200);
      // The resend came first, or met the invitation the reactivation closed.
      expect([200, 409]).toContain(x.statusCode);
      if (x.statusCode === 409) {
        expect(h.body(x).error.code).toBe("invitation_used");
      }
      expect((await h.invitation(id)).used_by).toBe(old);
    }
  });

  it(`a revoke and a resend of one invitation at once leave it revoked or renewed, never both (${PAIRS} times)`, async () => {
    const a = await h.admin(mail("a"));
    const b = await h.admin(mail("b"));
    for (let i = 0; i < PAIRS; i += 1) {
      const made = await h.invite(a, [mail("p")]);
      const id = h.body(made).results[0]!.invitation!.id;
      const [x, y] = await Promise.all([
        h.post(a, `/invitations/${id}/resend`, undefined, {
          headers: { "idempotency-key": h.key() },
        }),
        h.post(b, `/invitations/${id}/revoke`),
      ]);
      expect(y.statusCode).toBe(200);
      expect([200, 409]).toContain(x.statusCode);
      expect((await h.invitation(id)).revoked_at).not.toBeNull();
    }
  });
});
