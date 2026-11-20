import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as shared from "@toki/shared";
import { createMemberHarness, type MemberHarness } from "./setup.js";

// Who may call the routes (R1, R3, R34). A Member gets 403 whatever is sent:
// never a 400, a 404 or a 500.

let h: MemberHarness;
let admin: Awaited<ReturnType<MemberHarness["admin"]>>;
let member: Awaited<ReturnType<MemberHarness["person"]>>;
let other: string;
let invitationId: string;
const NO_ONE = "0193f0a0-0000-7000-8000-00000000dead";

beforeAll(async () => {
  h = await createMemberHarness();
  admin = await h.admin("admin@example.com");
  await h.admin("second-admin@example.com");
  member = await h.person("member@example.com");
  other = await h.addUser("other@example.com");
  const made = await h.invite(admin, ["access-invited@example.com"]);
  invitationId = h.body(made).results[0]!.invitation!.id;
  h.mail.calls.length = 0;
});
afterAll(async () => {
  await h?.close();
});

type Case = {
  name: string;
  url: () => string;
  payload?: unknown;
  key?: boolean;
};
const personRoutes: Case[] = [
  {
    name: "role",
    url: () => `/members/${other}/role`,
    payload: { role: "admin" },
  },
  { name: "deactivate", url: () => `/members/${other}/deactivate` },
  { name: "reactivate", url: () => `/members/${other}/reactivate` },
];
const invitationRoutes: Case[] = [
  {
    name: "invite",
    url: () => "/invitations",
    payload: { emails: ["access-new@example.com"] },
    key: true,
  },
  {
    name: "resend",
    url: () => `/invitations/${invitationId}/resend`,
    key: true,
  },
  { name: "revoke", url: () => `/invitations/${invitationId}/revoke` },
];
const routes: Case[] = [...personRoutes, ...invitationRoutes];
const send = (
  who: Parameters<MemberHarness["post"]>[0],
  c: Case,
  url = c.url(),
  payload = c.payload,
  withKey = c.key,
) =>
  h.post(
    who,
    url,
    payload,
    withKey ? { headers: { "idempotency-key": h.key() } } : {},
  );

const counts = async () =>
  (
    await h.sql`select
      (select count(*) from invitations)::int as invitations,
      (select count(*) from admin_actions)::int as actions,
      (select count(*) from member_requests)::int as requests,
      (select md5(string_agg(id::text || role || status, ',' order by id)) from users) as users`
  )[0];

describe("a Member is refused on every route (R1, D-090)", () => {
  it.each(routes)("$name: 403 forbidden, and nothing changes", async (c) => {
    const before = await counts();
    const res = await send(member, c);
    expect(res.statusCode).toBe(403);
    expect(h.body(res).error.code).toBe("forbidden");
    expect(await counts()).toEqual(before);
    expect(
      h.mail.calls.filter((m) => m.operation !== "sendSignInMail"),
    ).toEqual([]);
  });

  it.each(routes)(
    "$name: still 403 with an invalid body, an unknown role and an id that is not a UUID",
    async (c) => {
      const id = c.url().includes(other) ? other : invitationId;
      const bad = c.url().replace(id, "not-a-uuid");
      const missing = c.url().replace(id, NO_ONE);
      for (const [url, payload, withKey] of [
        [c.url(), { role: "owner" }, c.key],
        [c.url(), { emails: "x" }, c.key],
        [c.url(), { emails: ["a@example.com"], role: "owner" }, c.key],
        [c.url(), [], c.key],
        [c.url(), c.payload, false],
        [bad, c.payload, c.key],
        [missing, c.payload, c.key],
      ] as const) {
        const res = await send(member, c, url, payload, withKey);
        expect(res.statusCode, `${url} ${JSON.stringify(payload)}`).toBe(403);
        expect(h.body(res).error.code).toBe("forbidden");
      }
    },
  );
});

describe("without a session (R1)", () => {
  it.each(routes)("$name: 401 unauthenticated", async (c) => {
    const res = await send(null, c);
    expect(res.statusCode).toBe(401);
    expect(h.body(res).error.code).toBe("unauthenticated");
  });
});

describe("an Admin passes (R1)", () => {
  it.each(routes)("$name: 200", async (c) => {
    const res = await send(admin, c);
    expect(res.statusCode).toBe(200);
  });
});

describe("a permission function that cannot decide is a server error (R1)", () => {
  it("answers 500 internal_error when a permission function gives unknown_role", async () => {
    // The actor row with a role the functions do not know: unknown_role.
    const odd = await h.person("odd@example.com");
    await h.sql`alter table users drop constraint users_role_check`;
    await h.sql`update users set role = 'owner' where id = ${odd.id}`;
    try {
      expect(shared.canOpenAdminPage({ id: odd.id, role: "owner" })).toEqual({
        allowed: false,
        reason: "unknown_role",
      });
      const res = await h.post(odd, `/members/${other}/deactivate`);
      expect(res.statusCode).toBe(500);
      expect(h.body(res).error.code).toBe("internal_error");
    } finally {
      await h.sql`update users set role = 'member' where id = ${odd.id}`;
      await h.sql`alter table users add constraint users_role_check check (role in ('member', 'admin'))`;
    }
  });
});

describe("fact_missing is a server error (R1)", () => {
  it("answers 500 internal_error when the target's facts are missing", async () => {
    // A status that is neither active nor deactivated: the permission
    // functions cannot decide (fact_missing), and no route may allow it.
    const odd = await h.addUser("odd-target@example.com");
    await h.sql`alter table users drop constraint users_status_check`;
    await h.sql`update users set status = 'frozen' where id = ${odd}`;
    try {
      expect(
        shared.canDeactivateAccount(
          { id: admin.id, role: "admin" },
          { id: odd, role: "member", status: "frozen" as never },
          2,
        ),
      ).toEqual({ allowed: false, reason: "fact_missing" });
      for (const [url, payload] of [
        [`/members/${odd}/deactivate`, undefined],
        [`/members/${odd}/role`, { role: "admin" }],
      ] as const) {
        const res = await h.post(admin, url, payload);
        expect(res.statusCode, url).toBe(500);
        expect(h.body(res).error.code).toBe("internal_error");
      }
      expect(
        (await h.sql`select status, role from users where id = ${odd}`)[0],
      ).toEqual({ status: "frozen", role: "member" });
    } finally {
      await h.sql`update users set status = 'active' where id = ${odd}`;
      await h.sql`alter table users add constraint users_status_check check (status in ('active', 'deactivated'))`;
    }
  });
});

describe("the list (R1, R3)", () => {
  it("is refused to a Member with 403, whatever the query, and without a session with 401", async () => {
    for (const query of ["", "?limit=0", "?status=revoked", "?cursor=zzz"]) {
      const res = await h.get(member, `/members${query}`);
      expect(res.statusCode, query).toBe(403);
      expect(h.body(res).error.code).toBe("forbidden");
    }
    const anonymous = await h.get(null, "/members");
    expect(anonymous.statusCode).toBe(401);
  });

  it("is passed by an Admin and changes no row of users, invitations, admin_actions or member_requests", async () => {
    const before = await counts();
    // Sessions made earlier share one time; move on so this request's is its own.
    h.clock.advance(1000);
    const res = await h.get(admin, "/members");
    expect(res.statusCode).toBe(200);
    expect(await counts()).toEqual(before);
    // The one row it touches is the caller's own session (TOKI-022 R25).
    const touched =
      await h.sql`select user_id from sessions where last_used_at = ${new Date(h.clock.now())}`;
    expect(touched.map((r) => r.user_id)).toEqual([admin.id]);
  });
});

describe("the registered routes (R3)", () => {
  it("are seven: one GET and six POST, with no PUT, PATCH or DELETE (the three public routes of the Join page, TOKI-097, are counted in join-hardening)", () => {
    const tree = h.app.printRoutes({ commonPrefix: false });
    // The lines of the two branches of this work only: the top-level line and
    // the lines indented under it, until the next top-level line.
    const own: string[] = [];
    let inside = false;
    for (const line of tree.split("\n")) {
      if (/^[├└]── /.test(line)) {
        inside = /^[├└]── \/api\/v1\/(members|invitations)\b/.test(line);
      }
      if (inside) own.push(line.replace(/^[│├└─\s]+/, "").trim());
    }
    // The three public routes of the Join page sit under the same prefix; they are POST only.
    const join = own.filter((l) => /^\/(lookup|codes|sessions) /.test(l));
    expect(join.sort()).toEqual(["/codes (POST)", "/lookup (POST)"]);
    own.splice(0, own.length, ...own.filter((l) => !join.includes(l)));
    // The tree lists the branches in an order that follows the routes registered under the same
    // prefix, so the lines are compared as a set.
    expect([...own].sort()).toEqual(
      [
        "/api/v1/members (GET, HEAD)",
        "/:userId/role (POST)",
        "/:userId/reactivate (POST)",
        "/:userId/deactivate (POST)",
        "/api/v1/invitations (POST)",
        "/:invitationId/resend (POST)",
        "/:invitationId/revoke (POST)",
      ].sort(),
    );
  });
});
