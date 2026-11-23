import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  checkInvitationCode,
  onSessionsEnded,
  type EndReason,
} from "../../src/modules/auth/index.js";
import { createGeneralChannel } from "../../src/modules/conversations/index.js";
import { codeSecret } from "../../src/modules/members/index.js";
import type { JoinHooks } from "../../src/modules/members/invitation-join.routes.js";
import {
  accept,
  cookieOf,
  json,
  lookup,
  makeInvitation,
  resend,
  revoke,
  type Admin,
  type Made,
} from "./join-support.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

const hooks: JoinHooks = {};
let h: MemberHarness;
let lan: Admin;
let general: string;
let n = 0;
const fresh = (name = "acc") => `${name}${(n += 1)}@example.com`;
const heard: { ids: string[]; reason: EndReason }[] = [];
let unsubscribe: () => void;

beforeAll(async () => {
  h = await createMemberHarness({ joinHooks: hooks });
  lan = await h.admin("lan@example.com");
  general = await createGeneralChannel(h.db, {
    workspaceId: h.workspaceId,
    createdBy: lan.id,
    createdAt: new Date(h.clock.now()),
  });
  unsubscribe = onSessionsEnded((ids, reason) => heard.push({ ids, reason }));
});
afterAll(async () => {
  unsubscribe?.();
  await h?.close();
});
afterEach(() => {
  delete hooks.afterCodeCheck;
  delete hooks.inTransaction;
  delete hooks.afterCommit;
  heard.length = 0;
});

const userByEmail = async (email: string) =>
  (await h.sql`select * from users where email = ${email}`) as unknown as {
    id: string;
    status: string;
    role: string;
    display_name: string;
    language: string;
  }[];
const sessionsOf = async (userId: string) =>
  (await h.sql`select * from sessions where user_id = ${userId} order by created_at, id`) as unknown as {
    id: string;
    ended_at: Date | null;
    ended_reason: string | null;
  }[];
const generalRows = async (userId: string) =>
  (
    await h.sql`select count(*)::int as n from conversation_members where user_id = ${userId} and conversation_id = ${general}`
  )[0]!.n as number;
const invitationRow = async (made: Made) => h.invitation(made.id);
const wrongTries = async (made: Made) =>
  (
    await h.sql`select wrong_tries from login_codes where email = ${made.email} and purpose = 'invitation' order by created_at desc limit 1`
  )[0]!.wrong_tries as number;
const cookieHeader = (res: Parameters<typeof cookieOf>[0]) => {
  const c = cookieOf(res)!;
  return { cookie: `${c.name}=${c.value}` };
};
// A person that was deactivated without their sessions ended, as a crash could leave them.
async function deactivated(
  email: string,
  values: Record<string, unknown> = {},
) {
  const person = await h.person(email, values);
  await h.sql`update users set status = 'deactivated' where id = ${person.id}`;
  return person;
}

describe("accept with the right code (R10, R14)", () => {
  it("gives the user and the id of #general, one session and the cookie, and no token in the body", async () => {
    const made = await makeInvitation(h, lan, fresh("minh.tran"));
    const res = await accept(h, made.token, made.code);
    expect(res.statusCode).toBe(200);
    const body = json(res);
    expect(Object.keys(body).sort()).toEqual(["generalConversationId", "user"]);
    expect(body.generalConversationId).toBe(general);
    const [row] = await userByEmail(made.email);
    expect(body.user).toEqual({
      id: row!.id,
      email: made.email,
      displayName: made.email.split("@")[0],
      role: "member",
      language: "en",
    });
    expect(res.body).not.toContain(made.token);
    const cookie = cookieOf(res)!;
    expect(cookie.name).toBe(h.cookieName());
    expect(cookie.attrs).toEqual(
      expect.arrayContaining(["Path=/", "HttpOnly", "SameSite=Lax"]),
    );
    expect(await sessionsOf(row!.id)).toHaveLength(1);
    // the cookie signs the person in
    const me = await h.call({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: cookieHeader(res),
    });
    expect(me.statusCode).toBe(200);
    expect(json(me).user!.id).toBe(row!.id);
  });

  it("makes a new account with the role of the invitation: member and admin (R14)", async () => {
    for (const role of ["member", "admin"] as const) {
      const made = await makeInvitation(h, lan, fresh(role), { role });
      const res = await accept(h, made.token, made.code);
      expect(json(res).user!.role).toBe(role);
      const [row] = await userByEmail(made.email);
      expect(row).toMatchObject({ status: "active", role, language: "en" });
    }
  });

  it("keeps a 64-character local part as the display name (R14)", async () => {
    const local = "a".repeat(64);
    const made = await makeInvitation(h, lan, `${local}@example.com`);
    const res = await accept(h, made.token, made.code);
    expect(json(res).user!.displayName).toBe(local);
  });

  it("makes the person a member of #general once (R17)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    const res = await accept(h, made.token, made.code);
    expect(await generalRows(json(res).user!.id)).toBe(1);
  });
});

describe("the order of the checks and the code (R11, R12, R13, R20)", () => {
  it("refuses a revoked or unknown invitation before the code and uses up no try (R11)", async () => {
    const revoked = await makeInvitation(h, lan, fresh());
    await revoke(h, lan, revoked);
    for (let i = 0; i < 6; i++) {
      const res = await accept(h, revoked.token, "000000");
      expect(res.statusCode).toBe(409);
      expect(json(res).error.code).toBe("invitation_revoked");
    }
    expect(await wrongTries(revoked)).toBe(0);
    // the right code with an unknown token: 404, not a code error
    const unknown = await accept(h, "A".repeat(43), revoked.code);
    expect(unknown.statusCode).toBe(404);
    expect(json(unknown).error.code).toBe("invitation_not_found");
  });

  it("counts the tries down 4, 3, 2, 1, locks at the 5th, and refuses the right code after (R12)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    const wrong = made.code === "000000" ? "111111" : "000000";
    for (const left of [4, 3, 2, 1]) {
      const res = await accept(h, made.token, wrong);
      expect(res.statusCode).toBe(400);
      expect(json(res).error.code).toBe("code_incorrect");
      expect(json(res).error.details?.triesLeft).toBe(left);
    }
    const fifth = await accept(h, made.token, wrong);
    expect(json(fifth).error.code).toBe("code_locked");
    const right = await accept(h, made.token, made.code);
    expect(right.statusCode).toBe(400);
    expect(json(right).error.code).toBe("code_locked");
    expect(await userByEmail(made.email)).toHaveLength(0);
  });

  it("answers code_expired at 10 minutes and for a used code (R12)", async () => {
    const old = await makeInvitation(h, lan, fresh());
    h.clock.advance(600_000);
    const res = await accept(h, old.token, old.code);
    expect(res.statusCode).toBe(400);
    expect(json(res).error.code).toBe("code_expired");
    const used = await makeInvitation(h, lan, fresh());
    expect((await accept(h, used.token, used.code)).statusCode).toBe(200);
    // the invitation is used now: a second accept answers invitation_used first (R11)
    const again = await accept(h, used.token, used.code);
    expect(again.statusCode).toBe(409);
    expect(json(again).error.code).toBe("invitation_used");
  });

  it("refuses 5 digits, 7 digits, letters and a missing token with 400 validation_failed and no try (R13)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    for (const body of [
      { token: made.token, code: "12345" },
      { token: made.token, code: "1234567" },
      { token: made.token, code: "12345a" },
      { token: made.token },
      { code: made.code },
      { token: 5, code: made.code },
    ]) {
      const res = await h.post(null, "/invitations/sessions", body);
      expect(res.statusCode).toBe(400);
      expect(json(res).error.code).toBe("validation_failed");
    }
    expect(await wrongTries(made)).toBe(0);
  });

  it("binds a code to its token: another invitation's digits or token give code_incorrect (R20)", async () => {
    const a = await makeInvitation(h, lan, fresh());
    const b = await makeInvitation(h, lan, fresh());
    const wrongDigits = a.code === b.code ? "123456" : b.code;
    const res = await accept(h, a.token, wrongDigits);
    expect(json(res).error.code).toBe("code_incorrect");
    // and the secret is <token>:<serial>, so another token with these digits is wrong too
    expect(
      await checkInvitationCode(h.db, {
        secret: codeSecret(b.token, 1),
        code: a.code === b.code ? "654321" : a.code,
      }),
    ).toMatchObject({ result: "incorrect" });
  });
});

describe("a brought-back account (R15)", () => {
  it("gets the same account with the new role, its old name, language and memberships, and no second row", async () => {
    const email = fresh("back");
    const old = await deactivated(email, {
      display_name: "Old Name",
      language: "vi",
      role: "member",
    });
    await h.sql`insert into conversation_members (workspace_id, conversation_id, user_id, created_at)
      select workspace_id, ${general}, ${old.id}, now() from conversations where id = ${general}`;
    const made = await makeInvitation(h, lan, email, { role: "admin" });
    const res = await accept(h, made.token, made.code);
    expect(res.statusCode).toBe(200);
    const rows = await userByEmail(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: old.id,
      status: "active",
      role: "admin",
      display_name: "Old Name",
      language: "vi",
    });
    expect(json(res).user).toEqual({
      id: old.id,
      email,
      displayName: "Old Name",
      role: "admin",
      language: "vi",
    });
    expect(await generalRows(old.id)).toBe(1);
  });

  it("refuses the old cookie as session_ended and works with the new one (R15)", async () => {
    const email = fresh("cookie");
    const old = await deactivated(email);
    const made = await makeInvitation(h, lan, email);
    const res = await accept(h, made.token, made.code);
    expect(res.statusCode).toBe(200);
    const stale = await h.call({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: old.headers,
    });
    expect(stale.statusCode).toBe(401);
    expect(json(stale).error.code).toBe("session_ended");
    const fresher = await h.call({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: cookieHeader(res),
    });
    expect(fresher.statusCode).toBe(200);
  });

  it("reports the ended sessions once with the reason deactivated, after the commit and not before (R15)", async () => {
    const email = fresh("report");
    const old = await deactivated(email);
    const oldSession = (await sessionsOf(old.id))[0]!.id;
    const made = await makeInvitation(h, lan, email);
    heard.length = 0;
    let heardInside = -1;
    hooks.inTransaction = async () => {
      heardInside = heard.length;
    };
    await accept(h, made.token, made.code);
    expect(heardInside).toBe(0);
    expect(heard).toEqual([{ ids: [oldSession], reason: "deactivated" }]);
  });

  it("reports nothing for a new address, nor when the invitation is refused or the transaction rolls back (R15)", async () => {
    const fresher = await makeInvitation(h, lan, fresh());
    await accept(h, fresher.token, fresher.code);
    expect(heard).toEqual([]);
    const email = fresh("rollback");
    await deactivated(email);
    const made = await makeInvitation(h, lan, email);
    hooks.inTransaction = async () => {
      throw new Error("the transaction fails");
    };
    const res = await accept(h, made.token, made.code);
    expect(res.statusCode).toBe(500);
    expect(heard).toEqual([]);
  });

  it("still reports them when the session cannot be created afterwards (R15, R19)", async () => {
    const email = fresh("report2");
    const old = await deactivated(email);
    const oldSession = (await sessionsOf(old.id))[0]!.id;
    const made = await makeInvitation(h, lan, email);
    hooks.afterCommit = async () => {
      throw new Error("the session fails");
    };
    const res = await accept(h, made.token, made.code);
    expect(res.statusCode).toBe(500);
    expect(heard).toEqual([{ ids: [oldSession], reason: "deactivated" }]);
  });
});

describe("races and partial failures (R16, R18, R19, R44, R45)", () => {
  it("rolls back and answers 409 when the invitation is revoked between the code check and the call (R16)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    hooks.afterCodeCheck = async () => {
      await revoke(h, lan, made);
    };
    const res = await accept(h, made.token, made.code);
    expect(res.statusCode).toBe(409);
    expect(json(res).error.code).toBe("invitation_revoked");
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(await userByEmail(made.email)).toHaveLength(0);
    expect(
      (
        await h.sql`select count(*)::int as n from sessions s join users u on u.id = s.user_id where u.email = ${made.email}`
      )[0]!.n,
    ).toBe(0);
  });

  it("answers 404 when the token was replaced after the code check (R16)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    hooks.afterCodeCheck = async () => {
      const res = await h.post(
        lan,
        `/invitations/${made.id}/resend`,
        undefined,
        {
          headers: { "idempotency-key": h.key() },
        },
      );
      expect(res.statusCode).toBe(200);
    };
    const res = await accept(h, made.token, made.code);
    expect(res.statusCode).toBe(404);
    expect(json(res).error.code).toBe("invitation_not_found");
    expect(await userByEmail(made.email)).toHaveLength(0);
  });

  it("gives one session and one member row when two accepts with the right code arrive together (R18)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    const [a, b] = await Promise.all([
      accept(h, made.token, made.code),
      accept(h, made.token, made.code),
    ]);
    expect([a, b].map((r) => r.statusCode).sort()).toEqual([200, 400]);
    const loser = a.statusCode === 200 ? b : a;
    expect(json(loser).error.code).toBe("code_expired");
    const [row] = await userByEmail(made.email);
    expect(await sessionsOf(row!.id)).toHaveLength(1);
    expect(await generalRows(row!.id)).toBe(1);
  });

  it("answers 409 invitation_used, with no session, no cookie and no id, when the address has an active account; the account is untouched and the invitation closed (R44)", async () => {
    const email = fresh("active");
    const made = await makeInvitation(h, lan, email);
    // the address becomes an active member while the invitation is open (a reactivation that raced)
    const id = await h.addUser(email, {
      role: "admin",
      display_name: "Already Here",
    });
    const res = await accept(h, made.token, made.code);
    expect(res.statusCode).toBe(409);
    expect(json(res).error.code).toBe("invitation_used");
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(res.body).not.toContain("generalConversationId");
    const [row] = await userByEmail(email);
    expect(row).toMatchObject({
      id,
      role: "admin",
      display_name: "Already Here",
    });
    expect(await sessionsOf(id)).toHaveLength(0);
    expect(await generalRows(id)).toBe(0);
    expect((await invitationRow(made)).used_at).not.toBeNull();
    // the code is used up
    expect(
      await checkInvitationCode(h.db, {
        secret: codeSecret(made.token, 1),
        code: made.code,
      }),
    ).toEqual({ result: "expired" });
  });

  it("a failing transaction leaves the invitation pending and the account unchanged, uses the code up, and the same digits answer code_expired (R19, R45)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    hooks.inTransaction = async () => {
      throw new Error("the transaction fails");
    };
    const failed = await accept(h, made.token, made.code);
    expect(failed.statusCode).toBe(500);
    expect(failed.body).not.toContain(made.token);
    expect(await userByEmail(made.email)).toHaveLength(0);
    expect((await invitationRow(made)).used_at).toBeNull();
    expect(json(await lookup(h, made.token)).state).toBe("pending");
    delete hooks.inTransaction;
    const again = await accept(h, made.token, made.code);
    expect(json(again).error.code).toBe("code_expired");
    // a new code is refused inside 60 seconds of the latest code and accepted after
    const early = await resend(h, made.token);
    expect(early.statusCode).toBe(429);
    expect(json(early).error.code).toBe("code_resend_too_soon");
    h.clock.advance(60_000);
    expect((await resend(h, made.token)).statusCode).toBe(200);
    await h.flush();
    const sent = h.mail.calls.filter(
      (c) => c.operation === "sendInvitationCode",
    );
    const newCode = (sent.at(-1)!.input as { code: string }).code;
    const ok = await accept(h, made.token, newCode);
    expect(ok.statusCode).toBe(200);
  });

  it("a failing session leaves an active account and a used invitation, and a lookup answers used (R19)", async () => {
    const made = await makeInvitation(h, lan, fresh());
    hooks.afterCommit = async () => {
      throw new Error("the session fails");
    };
    const res = await accept(h, made.token, made.code);
    expect(res.statusCode).toBe(500);
    expect(res.headers["set-cookie"]).toBeUndefined();
    const [row] = await userByEmail(made.email);
    expect(row!.status).toBe("active");
    expect(await sessionsOf(row!.id)).toHaveLength(0);
    expect(json(await lookup(h, made.token))).toEqual({
      state: "used",
      email: made.email,
    });
  });
});

describe("the session of the browser (R21)", () => {
  it("ends a valid session of an active account with the reason replaced and sets a new cookie", async () => {
    const other = await h.person(fresh("other"));
    const made = await makeInvitation(h, lan, fresh());
    const before = await sessionsOf(other.id);
    const res = await accept(h, made.token, made.code, other);
    expect(res.statusCode).toBe(200);
    const after = await sessionsOf(other.id);
    expect(after).toHaveLength(before.length);
    expect(after[0]!.ended_at).not.toBeNull();
    expect(after[0]!.ended_reason).toBe("replaced");
    expect(heard.filter((e) => e.reason === "replaced")).toEqual([
      { ids: [after[0]!.id], reason: "replaced" },
    ]);
    // the old cookie is refused and the new one is another person's
    const stale = await h.call({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: other.headers,
    });
    expect(json(stale).error.code).toBe("session_ended");
    expect(cookieOf(res)!.value).not.toBe(other.secret);
  });

  it("ends nothing for the cookie of a deactivated account, and replaces the cookie (R21)", async () => {
    const gone = await deactivated(fresh("gone"));
    const made = await makeInvitation(h, lan, fresh());
    const before = await sessionsOf(gone.id);
    const res = await accept(h, made.token, made.code, gone);
    expect(res.statusCode).toBe(200);
    const after = await sessionsOf(gone.id);
    expect(after.map((s) => s.ended_at)).toEqual(before.map((s) => s.ended_at));
    expect(after.some((s) => s.ended_reason === "replaced")).toBe(false);
    expect(cookieOf(res)!.value).not.toBe(gone.secret);
  });

  it("brings a deactivated account back in a browser that still holds its old cookie (R15, R21)", async () => {
    const email = fresh("same");
    const old = await deactivated(email);
    const made = await makeInvitation(h, lan, email);
    const res = await accept(h, made.token, made.code, old);
    expect(res.statusCode).toBe(200);
    // the sessions were ended by acceptInvitation; the replaced step ends nothing more
    expect(
      (await sessionsOf(old.id)).filter((s) => s.ended_reason === "replaced"),
    ).toHaveLength(0);
    expect(json(res).user!.id).toBe(old.id);
  });
});

describe("no leak (R24)", () => {
  it("puts no token, code or address of an accept in the log, a failure included", async () => {
    const made = await makeInvitation(h, lan, fresh("leak"));
    hooks.inTransaction = async () => {
      throw new Error(`failed ${made.token} ${made.email} ${made.code}`);
    };
    const res = await accept(h, made.token, made.code);
    expect(res.statusCode).toBe(500);
    delete hooks.inTransaction;
    const log = h.logText();
    for (const secret of [made.token, made.email, made.code]) {
      expect(log).not.toContain(secret);
    }
  });
});
