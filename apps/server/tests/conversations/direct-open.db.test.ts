import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError } from "../../src/errors.js";
import type { DirectDeps } from "../../src/modules/conversations/deps.js";
import { handleOpenDirect } from "../../src/modules/conversations/direct-routes.js";
import { getAccountsByIds } from "../../src/modules/members/index.js";
import { createHarness, type Harness } from "../auth/test-harness.js";

let h: Harness;
let deps: DirectDeps;
beforeAll(async () => {
  h = await createHarness();
  deps = { db: h.db, clock: h.clock, getAccountsByIds };
});
afterAll(async () => {
  await h?.close();
});

let counter = 0;
type User = { id: string; role: "member" | "admin" };
async function user(
  values: Record<string, unknown> = {},
  role: "member" | "admin" = "member",
): Promise<User> {
  counter += 1;
  const id = await h.addUser(`d-${counter}@example.com`, { role, ...values });
  return { id, role };
}
const open = (
  who: { id: string; role: string },
  userIds: string[],
  d: DirectDeps = deps,
) => handleOpenDirect(d, who, { userIds });
const snapshot = async () => ({
  conversations: await h.sql`select * from conversations order by id`,
  members:
    await h.sql`select * from conversation_members order by conversation_id, user_id`,
});
const counts = async () =>
  (
    await h.sql<{ c: number; m: number }[]>`select
      (select count(*)::int from conversations) as c,
      (select count(*)::int from conversation_members) as m`
  )[0]!;
const fails = async (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected a failure");
    },
    (e: unknown) => e,
  );
// A refusal leaves both tables as they were (R21).
async function refused(p: () => Promise<unknown>) {
  const before = await snapshot();
  const error = await fails(p());
  expect(await snapshot()).toEqual(before);
  return error;
}

describe("create, R11 and R18", () => {
  it("writes a dm: every column of both tables, and answers 201 with the entry", async () => {
    const a = await user();
    const b = await user();
    const res = await open(a, [b.id]);
    expect(res.status).toBe(201);
    const key = [a.id, b.id].sort().join(",");
    expect(res.conversation).toEqual({
      id: res.conversation.id,
      kind: "dm",
      name: null,
      topic: null,
      isPrivate: true,
      isGeneral: false,
      notificationLevel: "all",
      isMuted: false,
      isStarred: false,
      memberIds: key.split(","),
    });
    const [row] =
      await h.sql`select * from conversations where id = ${res.conversation.id}`;
    expect(row).toMatchObject({
      workspace_id: h.workspaceId,
      kind: "dm",
      name: null,
      topic: null,
      description: null,
      is_private: true,
      is_general: false,
      dm_key: key,
      created_by: a.id,
      archived_at: null,
    });
    expect(row!.created_at).toEqual(new Date(h.clock.now()));
    expect(row!.id[14]).toBe("7");
    const members =
      await h.sql`select * from conversation_members where conversation_id = ${res.conversation.id} order by user_id`;
    expect(members.map((m) => m.user_id)).toEqual(key.split(","));
    for (const m of members) {
      expect(m).toMatchObject({
        workspace_id: h.workspaceId,
        notification_level: null,
        is_muted: false,
        is_starred: false,
      });
      expect(m.created_at).toEqual(new Date(h.clock.now()));
    }
  });

  it("writes a group of 8 with a row for each person", async () => {
    const a = await user();
    const others = await Promise.all(Array.from({ length: 7 }, () => user()));
    const res = await open(
      a,
      others.map((o) => o.id),
    );
    expect(res.status).toBe(201);
    expect(res.conversation.kind).toBe("group_dm");
    const all = [a, ...others].map((u) => u.id).sort();
    expect(res.conversation.memberIds).toEqual(all);
    const members =
      await h.sql`select user_id from conversation_members where conversation_id = ${res.conversation.id} order by user_id`;
    expect(members.map((m) => m.user_id)).toEqual(all);
    const [row] =
      await h.sql`select kind, dm_key from conversations where id = ${res.conversation.id}`;
    expect(row).toMatchObject({ kind: "group_dm", dm_key: all.join(",") });
  });

  it("an Admin and a Member can both open", async () => {
    const admin = await user({}, "admin");
    const member = await user();
    expect((await open(admin, [member.id])).status).toBe(201);
    const other = await user({}, "admin");
    expect((await open(member, [other.id])).status).toBe(201);
  });

  it("a failed member insert leaves no conversation row (the foreign key of R11)", async () => {
    const a = await user();
    const ghost = crypto.randomUUID();
    const before = await counts();
    const ghostDeps: DirectDeps = {
      ...deps,
      getAccountsByIds: async (client, ids, options) => [
        ...(await getAccountsByIds(client, ids, options)),
        ...(ids.includes(ghost)
          ? [
              {
                id: ghost,
                workspaceId: h.workspaceId,
                role: "member",
                status: "active" as const,
              },
            ]
          : []),
      ],
    };
    const error = await fails(open(a, [ghost], ghostDeps));
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AppError);
    expect(await counts()).toEqual(before);
  });
});

describe("an existing conversation, R9 and R12", () => {
  it("returns 200 with the same id and writes nothing, whoever of the set asks", async () => {
    const a = await user();
    const b = await user();
    const first = await open(a, [b.id]);
    const before = await snapshot();
    const second = await open(b, [a.id]);
    expect(second.status).toBe(200);
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(await snapshot()).toEqual(before);
  });

  it("gives the caller's own stored level, mute and star, and a new conversation the defaults", async () => {
    const a = await user();
    const b = await user();
    const first = await open(a, [b.id]);
    await h.sql`update conversation_members set notification_level = 'none', is_muted = true, is_starred = true where conversation_id = ${first.conversation.id} and user_id = ${b.id}`;
    const asB = await open(b, [a.id]);
    expect(asB.conversation).toMatchObject({
      notificationLevel: "none",
      isMuted: true,
      isStarred: true,
    });
    const asA = await open(a, [b.id]);
    expect(asA.conversation).toMatchObject({
      notificationLevel: "all",
      isMuted: false,
      isStarred: false,
    });
  });

  it("still opens a conversation with a person who was deactivated since, and does not look at their status (R9)", async () => {
    const a = await user();
    const b = await user();
    const first = await open(a, [b.id]);
    await h.sql`update users set status = 'deactivated' where id = ${b.id}`;
    const again = await open(a, [b.id]);
    expect(again.status).toBe(200);
    expect(again.conversation.id).toBe(first.conversation.id);
  });

  it("is one conversation for the same people in any order and letter case, and another for a set that differs by one person (R12, R14)", async () => {
    const [a, b, c, d] = await Promise.all([user(), user(), user(), user()]);
    const g1 = await open(a, [b.id, c.id]);
    const g2 = await open(b, [c.id, a.id]);
    const g3 = await open(c, [a.id.toUpperCase(), b.id]);
    expect([g1.status, g2.status, g3.status]).toEqual([201, 200, 200]);
    expect(g2.conversation.id).toBe(g1.conversation.id);
    expect(g3.conversation.id).toBe(g1.conversation.id);
    const fourth = await open(d, [a.id, b.id, c.id]);
    const dm = await open(a, [b.id]);
    expect(
      new Set([g1.conversation.id, fourth.conversation.id, dm.conversation.id])
        .size,
    ).toBe(3);
    // The first group still has exactly its three people.
    const members =
      await h.sql`select user_id from conversation_members where conversation_id = ${g1.conversation.id}`;
    expect(members).toHaveLength(3);
  });
});

describe("people, R6, R7, R8, R10", () => {
  it("answers 409 person_deactivated with the sorted ids for a dm and for one of three, writes nothing, and opens the person when they are active again", async () => {
    const a = await user();
    const gone = await user({ status: "deactivated" });
    const gone2 = await user({ status: "deactivated" });
    const fine = await user();
    const dm = await refused(() => open(a, [gone.id]));
    expect(dm).toMatchObject({
      status: 409,
      code: "person_deactivated",
      details: { userIds: [gone.id] },
    });
    const group = await refused(() => open(a, [gone2.id, fine.id, gone.id]));
    expect(group).toMatchObject({
      status: 409,
      code: "person_deactivated",
      details: { userIds: [gone.id, gone2.id].sort() },
    });
    await h.sql`update users set status = 'active' where id = ${gone.id}`;
    expect((await open(a, [gone.id])).status).toBe(201);
  });

  it("answers one 404 not_found, with no details, for an unknown id and for an account of another workspace", async () => {
    const a = await user();
    const otherWorkspace = crypto.randomUUID();
    await h.sql`insert into workspaces (id, name, created_at) values (${otherWorkspace}, 'Other', now())`;
    const foreign = await user({ workspace_id: otherWorkspace });
    const unknown = await refused(() => open(a, [crypto.randomUUID()]));
    const elsewhere = await refused(() => open(a, [foreign.id]));
    for (const e of [unknown, elsewhere]) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ status: 404, code: "not_found" });
      expect((e as AppError).details).toBeUndefined();
    }
    expect((unknown as AppError).message).toBe((elsewhere as AppError).message);
  });

  it("a group with one bad id writes nothing, not even for the valid ids (R8)", async () => {
    const a = await user();
    const b = await user();
    const c = await user();
    const error = await refused(() =>
      open(a, [b.id, c.id, crypto.randomUUID()]),
    );
    expect(error).toMatchObject({ status: 404 });
  });
});

describe("the order of the checks, R3 and R5", () => {
  it("8 ids that do not exist are group_too_large with its details, not not_found", async () => {
    const a = await user();
    const error = await refused(() =>
      open(
        a,
        Array.from({ length: 8 }, () => crypto.randomUUID()),
      ),
    );
    expect(error).toMatchObject({
      status: 400,
      code: "group_too_large",
      details: { max: 8, maxOthers: 7 },
    });
  });

  it("the caller's own id with an unknown id is direct_with_self", async () => {
    const a = await user();
    const error = await refused(() => open(a, [a.id, crypto.randomUUID()]));
    expect(error).toMatchObject({ status: 400, code: "direct_with_self" });
    const upper = await refused(() => open(a, [a.id.toUpperCase()]));
    expect(upper).toMatchObject({ code: "direct_with_self" });
  });

  it("a request for an existing set with a deactivated person is 200 and not the 409", async () => {
    const a = await user();
    const b = await user();
    await open(a, [b.id]);
    await h.sql`update users set status = 'deactivated' where id = ${b.id}`;
    expect((await open(a, [b.id])).status).toBe(200);
  });

  it("checks the body before anything is read: an invalid body is a ZodError, which the route answers as validation_failed", async () => {
    const a = await user();
    for (const body of [
      undefined,
      {},
      { userIds: [] },
      { userIds: "x" },
      { userIds: [1] },
      { userIds: ["no"] },
    ]) {
      const error = await refused(() => handleOpenDirect(deps, a, body));
      expect(error, JSON.stringify(body)).toBeInstanceOf(ZodError);
    }
    const b = await user();
    const twice = await refused(() => open(a, [b.id, b.id.toUpperCase()]));
    expect(twice).toBeInstanceOf(ZodError);
  });
});

describe("the caller and the permission function, R4 and R7", () => {
  it("a role the functions do not know, as the caller, is a server failure and writes nothing", async () => {
    const a = await user();
    const b = await user();
    for (const role of ["guest", "owner"]) {
      const error = await refused(() => open({ id: a.id, role }, [b.id]));
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(AppError);
    }
  });

  it("a stub that says role_not_allowed gives 403 forbidden and no row; fact_missing gives a server failure", async () => {
    const a = await user();
    const b = await user();
    const no = await refused(() =>
      open(a, [b.id], {
        ...deps,
        canCreateDirectConversation: () => ({
          allowed: false,
          reason: "role_not_allowed",
        }),
      }),
    );
    expect(no).toMatchObject({ status: 403, code: "forbidden" });
    const missing = await refused(() =>
      open(a, [b.id], {
        ...deps,
        canCreateDirectConversation: () => ({
          allowed: false,
          reason: "fact_missing",
        }),
      }),
    );
    expect(missing).not.toBeInstanceOf(AppError);
  });

  it("a person the function refuses is 404 as an unknown id is; a role it does not know is a server failure; a member passes", async () => {
    const a = await user();
    const b = await user();
    const asRole = (role: string): DirectDeps => ({
      ...deps,
      getAccountsByIds: async (client, ids, options) =>
        (await getAccountsByIds(client, ids, options)).map((r) =>
          r.id === b.id ? { ...r, role } : r,
        ),
    });
    const unknownRole = await refused(() => open(a, [b.id], asRole("guest")));
    expect(unknownRole).not.toBeInstanceOf(AppError);
    const refusedTarget = await refused(() =>
      open(a, [b.id], {
        ...deps,
        canCreateDirectConversation: (p) =>
          p.id === b.id
            ? { allowed: false, reason: "role_not_allowed" }
            : { allowed: true },
      }),
    );
    expect(refusedTarget).toMatchObject({ status: 404, code: "not_found" });
    expect((await open(a, [b.id], asRole("member"))).status).toBe(201);
  });

  it("the caller's locked row decides: deactivated is 401 account_deactivated, a missing row is 401 unauthenticated", async () => {
    const a = await user({ status: "deactivated" });
    const b = await user();
    expect(await refused(() => open(a, [b.id]))).toMatchObject({
      status: 401,
      code: "account_deactivated",
    });
    const ghost = { id: crypto.randomUUID(), role: "member" };
    expect(await refused(() => open(ghost, [b.id]))).toMatchObject({
      status: 401,
      code: "unauthenticated",
    });
  });

  it("the role of the locked row is the one that decides, not the role of the account", async () => {
    const a = await user();
    const b = await user();
    // The account says admin, the row says member: both may open. The check is
    // that the function sees the row's role.
    const seen: string[] = [];
    await open({ id: a.id, role: "admin" }, [b.id], {
      ...deps,
      canCreateDirectConversation: (p) => {
        seen.push(`${p.id === a.id ? "caller" : "other"}:${p.role}`);
        return { allowed: true };
      },
    });
    expect(seen).toEqual(["caller:admin", "caller:member", "other:member"]);
  });
});
