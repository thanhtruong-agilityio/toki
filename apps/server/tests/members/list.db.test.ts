import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertInvitation } from "../test-rows.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

// The member list (R21 to R25).

type Row = {
  kind: string;
  userId: string | null;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  lastActiveAt: string | null;
  invitation: null | {
    id: string;
    state: string;
    role: string;
    mailStatus: string;
    invitedBy: { id: string; displayName: string };
    createdAt: string;
    sentAt: string;
    expiresAt: string;
  };
};
type List = {
  members: Row[];
  counts: Record<string, number>;
  activeAdminCount: number;
  nextCursor: string | null;
  error: { code: string };
};

let h: MemberHarness;
let lan: Awaited<ReturnType<MemberHarness["admin"]>>;
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
  lan = await h.admin("lan@example.com", { display_name: "Lan" });
});

const list = async (query: Record<string, string | number> = {}) => {
  const text = new URLSearchParams(
    Object.entries(query).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await h.get(lan, `/members${text ? `?${text}` : ""}`);
  return { status: res.statusCode, body: JSON.parse(res.body) as List };
};
const names = (body: List) => body.members.map((m) => m.displayName ?? m.email);
const invitation = (values: Record<string, unknown>) =>
  insertInvitation(h.sql, {
    workspace_id: h.workspaceId,
    invited_by: lan.id,
    created_at: new Date(h.clock.now()),
    sent_at: new Date(h.clock.now()),
    code_issued_at: new Date(h.clock.now()),
    expires_at: new Date(h.clock.now() + 7 * DAY),
    ...values,
  });

describe("the rows (R22)", () => {
  it("gives the fields of an account row and of an invitation row", async () => {
    const minh = await h.addUser("minh@example.com", {
      display_name: "Minh",
      status: "deactivated",
      role: "admin",
    });
    const pending = await invitation({
      email: "pending@example.com",
      role: "admin",
      mail_status: "failed",
    });
    const expired = await invitation({
      email: "expired@example.com",
      sent_at: new Date(h.clock.now() - 8 * DAY),
      created_at: new Date(h.clock.now() - 8 * DAY),
      expires_at: new Date(h.clock.now() - DAY),
    });
    const { status, body } = await list();
    expect(status).toBe(200);
    const now = new Date(h.clock.now()).toISOString();
    expect(body.members).toEqual([
      {
        kind: "invitation",
        userId: null,
        email: "expired@example.com",
        displayName: null,
        role: "member",
        status: "expired",
        lastActiveAt: null,
        invitation: {
          id: expired,
          state: "expired",
          role: "member",
          mailStatus: "sent",
          invitedBy: { id: lan.id, displayName: "Lan" },
          createdAt: new Date(h.clock.now() - 8 * DAY).toISOString(),
          sentAt: new Date(h.clock.now() - 8 * DAY).toISOString(),
          expiresAt: new Date(h.clock.now() - DAY).toISOString(),
        },
      },
      {
        kind: "account",
        userId: lan.id,
        email: "lan@example.com",
        displayName: "Lan",
        role: "admin",
        status: "active",
        lastActiveAt: now,
        invitation: null,
      },
      {
        kind: "account",
        userId: minh,
        email: "minh@example.com",
        displayName: "Minh",
        role: "admin",
        status: "deactivated",
        lastActiveAt: null,
        invitation: null,
      },
      {
        kind: "invitation",
        userId: null,
        email: "pending@example.com",
        displayName: null,
        role: "admin",
        status: "invited",
        lastActiveAt: null,
        invitation: {
          id: pending,
          state: "pending",
          role: "admin",
          mailStatus: "failed",
          invitedBy: { id: lan.id, displayName: "Lan" },
          createdAt: now,
          sentAt: now,
          expiresAt: new Date(h.clock.now() + 7 * DAY).toISOString(),
        },
      },
    ]);
    expect(body.nextCursor).toBeNull();
  });

  it("shows a deactivated person with an invitation as one account row, Deactivated, with the invitation as a field", async () => {
    const old = await h.addUser("old@example.com", {
      display_name: "Old",
      status: "deactivated",
    });
    const id = await invitation({
      email: "old@example.com",
      user_id: old,
      role: "admin",
    });
    const { body } = await list();
    const rows = body.members.filter((m) => m.email === "old@example.com");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "account",
      userId: old,
      role: "member",
      status: "deactivated",
      invitation: { id, state: "pending", role: "admin" },
    });
    expect(body.counts).toEqual({
      invited: 0,
      expired: 0,
      active: 1,
      deactivated: 1,
    });
  });

  it("has no row for an invitation that is used or revoked", async () => {
    await invitation({
      email: "used@example.com",
      used_at: new Date(h.clock.now()),
      used_by: lan.id,
    });
    await invitation({
      email: "revoked@example.com",
      revoked_at: new Date(h.clock.now()),
    });
    const { body } = await list();
    expect(body.members.map((m) => m.email)).toEqual(["lan@example.com"]);
  });

  it("turns an invitation expired at exactly 7 days", async () => {
    await invitation({ email: "p@example.com" });
    h.clock.advance(7 * DAY - 1000);
    expect((await list()).body.counts).toMatchObject({
      invited: 1,
      expired: 0,
    });
    h.clock.advance(1000);
    expect((await list()).body.counts).toMatchObject({
      invited: 0,
      expired: 1,
    });
  });
});

describe("last active (R25)", () => {
  it("is the latest use of the person's sessions, ended or not, and null with none", async () => {
    const minh = await h.person("minh@example.com", { display_name: "Minh" });
    const seen = h.clock.now();
    await h.sql`update sessions set ended_at = ${new Date(seen)}, ended_reason = 'signed_out' where user_id = ${minh.id}`;
    await h.addUser("never@example.com", { display_name: "Never" });
    h.clock.advance(DAY);
    const { body } = await list();
    const of = (email: string) =>
      body.members.find((m) => m.email === email)!.lastActiveAt;
    expect(of("minh@example.com")).toBe(new Date(seen).toISOString());
    expect(of("never@example.com")).toBeNull();
    // The caller's own session was used by this very request.
    expect(of("lan@example.com")).toBe(new Date(h.clock.now()).toISOString());
  });
});

describe("counts and filters (R24)", () => {
  beforeEach(async () => {
    await h.addUser("an@example.com", { display_name: "An", role: "admin" });
    await h.addUser("binh@example.com", { display_name: "Binh" });
    await h.addUser("gone@example.com", {
      display_name: "Gone",
      status: "deactivated",
      role: "admin",
    });
    await invitation({ email: "new-an@example.com" });
    await invitation({
      email: "late@example.com",
      sent_at: new Date(h.clock.now() - 9 * DAY),
      created_at: new Date(h.clock.now() - 9 * DAY),
      expires_at: new Date(h.clock.now() - 2 * DAY),
    });
  });

  it("counts every status and the active Admins", async () => {
    const { body } = await list();
    expect(body.counts).toEqual({
      invited: 1,
      expired: 1,
      active: 3,
      deactivated: 1,
    });
    // Lan and An; a deactivated Admin does not count.
    expect(body.activeAdminCount).toBe(2);
  });

  it.each([
    ["invited", ["new-an@example.com"]],
    ["expired", ["late@example.com"]],
    ["active", ["An", "Binh", "Lan"]],
    ["deactivated", ["Gone"]],
  ])(
    "keeps the rows of the status %s, and the counts do not follow it",
    async (status, expected) => {
      const { body } = await list({ status });
      expect(names(body)).toEqual(expected);
      expect(body.counts).toEqual({
        invited: 1,
        expired: 1,
        active: 3,
        deactivated: 1,
      });
    },
  );

  it("searches the name and the address without regard to case, and the counts follow the search", async () => {
    const { body } = await list({ search: "AN" });
    // An, Lan (name), new-an@ (address); not Binh, Gone, late@.
    expect(names(body)).toEqual(["An", "Lan", "new-an@example.com"]);
    expect(body.counts).toEqual({
      invited: 1,
      expired: 0,
      active: 2,
      deactivated: 0,
    });
    expect(body.activeAdminCount).toBe(2);
    const both = await list({ search: "an", status: "invited" });
    expect(names(both.body)).toEqual(["new-an@example.com"]);
    expect(both.body.counts.active).toBe(2);
  });

  it("matches the address of an account as well as its name", async () => {
    const { body } = await list({ search: "binh@exam" });
    expect(names(body)).toEqual(["Binh"]);
  });

  it("takes a percent sign and an underscore as they are typed", async () => {
    await h.addUser("pct@example.com", { display_name: "100% Minh_Anh" });
    expect(names((await list({ search: "%" })).body)).toEqual([
      "100% Minh_Anh",
    ]);
    expect(names((await list({ search: "h_a" })).body)).toEqual([
      "100% Minh_Anh",
    ]);
    expect(names((await list({ search: "h_x" })).body)).toEqual([]);
  });
});

describe("search ignores Vietnamese diacritics (R24, concern 11)", () => {
  beforeEach(async () => {
    await h.addUser("u1@example.com", { display_name: "Nguyễn Văn" });
    await h.addUser("u2@example.com", { display_name: "Đào Thị" });
    await h.addUser("u3@example.com", { display_name: "Ngọc" });
    // The same name stored in decomposed form (NFD).
    await h.addUser("u4@example.com", {
      display_name: "Trần Đức".normalize("NFD"),
    });
    // An accented query finds an unaccented address.
    await invitation({ email: "anh.u5@example.com" });
  });

  it.each([
    ["nguyen", ["Nguyễn Văn"]],
    ["dao", ["Đào Thị"]],
    ["NGOC", ["Ngọc"]],
    ["NGỌC", ["Ngọc"]],
    ["tran duc", ["Trần Đức".normalize("NFD")]],
    ["Trần Đức", ["Trần Đức".normalize("NFD")]],
    ["đào", ["Đào Thị"]],
    ["ánh", ["anh.u5@example.com"]],
  ])("%s finds %j", async (search, expected) => {
    const { body } = await list({ search });
    expect(names(body)).toEqual(expected);
    expect(
      body.counts.invited +
        body.counts.expired +
        body.counts.active +
        body.counts.deactivated,
    ).toBe(expected.length);
  });
});

describe("order and pages (R23)", () => {
  it("orders by the lower-cased name or address in byte order, an accented first letter after the others", async () => {
    await h.addUser("z1@example.com", { display_name: "binh" });
    await h.addUser("z2@example.com", { display_name: "An" });
    await h.addUser("z3@example.com", { display_name: "Chi" });
    await h.addUser("z4@example.com", { display_name: "ánh" });
    await invitation({ email: "bao@example.com" });
    const { body } = await list();
    expect(names(body)).toEqual([
      "An",
      "bao@example.com",
      "binh",
      "Chi",
      "Lan",
      "ánh",
    ]);
  });

  it("orders two rows with the same name by id", async () => {
    const a = await h.addUser("same1@example.com", { display_name: "Same" });
    const b = await h.addUser("same2@example.com", { display_name: "same" });
    const { body } = await list({ search: "same" });
    expect(body.members.map((m) => m.userId)).toEqual([a, b].sort());
  });

  it("reads 120 rows in pages of 50, each row once and in order", async () => {
    const rows = [];
    for (let i = 0; i < 100; i += 1) {
      const id = crypto.randomUUID();
      rows.push({
        id,
        workspace_id: h.workspaceId,
        email: `p${i}@example.com`,
        display_name: `Person ${String(i).padStart(3, "0")}`,
        role: "member",
        status: i % 7 === 0 ? "deactivated" : "active",
        language: "en",
        created_at: new Date(h.clock.now()),
      });
    }
    await h.sql`insert into users ${h.sql(rows)}`;
    for (let i = 0; i < 19; i += 1) {
      await invitation({
        email: `inv${String(i).padStart(2, "0")}@example.com`,
      });
    }
    // 100 people, 19 invitations and Lan.
    const seen: string[] = [];
    let cursor: string | null = null;
    const sizes: number[] = [];
    do {
      const { body }: { body: List } = await list(cursor ? { cursor } : {});
      sizes.push(body.members.length);
      seen.push(...names(body));
      cursor = body.nextCursor;
    } while (cursor);
    expect(sizes).toEqual([50, 50, 20]);
    expect(new Set(seen).size).toBe(120);
    const all = (await list({ limit: 100 })).body;
    const rest = (await list({ limit: 100, cursor: all.nextCursor! })).body;
    expect(seen).toEqual([...names(all), ...names(rest)]);
    expect(rest.nextCursor).toBeNull();
  });

  it("keeps the search and the status across pages", async () => {
    for (let i = 0; i < 5; i += 1) {
      await h.addUser(`k${i}@example.com`, { display_name: `Keep ${i}` });
    }
    const first = (await list({ search: "keep", limit: 2 })).body;
    expect(names(first)).toEqual(["Keep 0", "Keep 1"]);
    const second = (
      await list({ search: "keep", limit: 2, cursor: first.nextCursor! })
    ).body;
    expect(names(second)).toEqual(["Keep 2", "Keep 3"]);
    expect(second.counts.active).toBe(5);
  });

  it("gives a null cursor when the page ends exactly at the last row", async () => {
    await h.addUser("b@example.com", { display_name: "B" });
    const { body } = await list({ limit: 2 });
    expect(body.members).toHaveLength(2);
    expect(body.nextCursor).toBeNull();
  });
});

describe("the query (R21)", () => {
  it.each([
    [{ limit: 0 }],
    [{ limit: 101 }],
    [{ limit: "abc" }],
    [{ status: "revoked" }],
    [{ cursor: "not-a-cursor" }],
    [{ cursor: Buffer.from("[1,2]").toString("base64url") }],
    [{ cursor: Buffer.from('["a","not-a-uuid"]').toString("base64url") }],
  ])("refuses %j with validation_failed", async (query) => {
    const { status, body } = await list(query as Record<string, string>);
    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_failed");
  });

  it("accepts a limit of 1 and of 100", async () => {
    expect((await list({ limit: 1 })).status).toBe(200);
    expect((await list({ limit: 100 })).status).toBe(200);
  });
});
