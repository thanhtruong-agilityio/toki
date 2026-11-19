import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as shared from "@toki/shared";
import { createMemberHarness, type MemberHarness } from "./setup.js";

// Who may call the routes (R1, R3, R34). A Member gets 403 whatever is sent:
// never a 400, a 404 or a 500.

let h: MemberHarness;
let admin: Awaited<ReturnType<MemberHarness["admin"]>>;
let member: Awaited<ReturnType<MemberHarness["person"]>>;
let other: string;
const NO_ONE = "0193f0a0-0000-7000-8000-00000000dead";

beforeAll(async () => {
  h = await createMemberHarness();
  admin = await h.admin("admin@example.com");
  await h.admin("second-admin@example.com");
  member = await h.person("member@example.com");
  other = await h.addUser("other@example.com");
});
afterAll(async () => {
  await h?.close();
});

type Case = { name: string; url: () => string; payload?: unknown };
const personRoutes: Case[] = [
  {
    name: "role",
    url: () => `/members/${other}/role`,
    payload: { role: "admin" },
  },
  { name: "deactivate", url: () => `/members/${other}/deactivate` },
  { name: "reactivate", url: () => `/members/${other}/reactivate` },
];
const routes: Case[] = [...personRoutes];

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
    const res = await h.post(member, c.url(), c.payload);
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
      const bad = c.url().replace(other, "not-a-uuid");
      const missing = c.url().replace(other, NO_ONE);
      for (const [url, payload] of [
        [c.url(), { role: "owner" }],
        [c.url(), { emails: "x" }],
        [c.url(), []],
        [bad, c.payload],
        [missing, c.payload],
      ] as const) {
        const res = await h.post(member, url, payload);
        expect(res.statusCode, `${url} ${JSON.stringify(payload)}`).toBe(403);
        expect(h.body(res).error.code).toBe("forbidden");
      }
    },
  );
});

describe("without a session (R1)", () => {
  it.each(routes)("$name: 401 unauthenticated", async (c) => {
    const res = await h.post(null, c.url(), c.payload);
    expect(res.statusCode).toBe(401);
    expect(h.body(res).error.code).toBe("unauthenticated");
  });
});

describe("an Admin passes (R1)", () => {
  it.each(routes)("$name: 200", async (c) => {
    const res = await h.post(admin, c.url(), c.payload);
    expect(res.statusCode).toBe(200);
  });
});

describe("a permission function that cannot decide is a server error (R1)", () => {
  it("answers 500 internal_error for fact_missing", async () => {
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
