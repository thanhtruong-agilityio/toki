import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError } from "../../src/errors.js";
import type { DirectDeps } from "../../src/modules/conversations/deps.js";
import { handleOpenDirect } from "../../src/modules/conversations/direct-routes.js";
import { getAccountsByIds } from "../../src/modules/members/index.js";
import { createHarness, type Harness } from "../auth/test-harness.js";
import { secondConnection, waitForLock } from "./channel-helpers.js";

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
      await h.sql`select * from conversation_members where conversation_id = ${res.conversation.id} order by user_id`;
    expect(members.map((m) => m.user_id)).toEqual(all);
    for (const m of members) {
      expect(m).toMatchObject({
        workspace_id: h.workspaceId,
        notification_level: null,
        is_muted: false,
        is_starred: false,
      });
      expect(m.created_at).toEqual(new Date(h.clock.now()));
    }
    const [row] =
      await h.sql`select * from conversations where id = ${res.conversation.id}`;
    expect(row).toMatchObject({
      workspace_id: h.workspaceId,
      kind: "group_dm",
      name: null,
      topic: null,
      description: null,
      is_private: true,
      is_general: false,
      dm_key: all.join(","),
      created_by: a.id,
      archived_at: null,
    });
    expect(row!.created_at).toEqual(new Date(h.clock.now()));
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
    const before = await snapshot();
    const again = await open(a, [b.id]);
    expect(again.status).toBe(200);
    expect(again.conversation.id).toBe(first.conversation.id);
    expect(await snapshot()).toEqual(before);
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
      await h.sql`select user_id from conversation_members where conversation_id = ${g1.conversation.id} order by user_id`;
    expect(members.map((m) => m.user_id)).toEqual([a.id, b.id, c.id].sort());
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
    const third = await user();
    const oneOfThree = await refused(() =>
      open(a, [fine.id, gone.id, third.id]),
    );
    expect(oneOfThree).toMatchObject({
      status: 409,
      details: { userIds: [gone.id] },
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
    const otherWorkspace = crypto.randomUUID();
    await h.sql`insert into workspaces (id, name, created_at) values (${otherWorkspace}, 'Other group', now())`;
    const foreign = await user({ workspace_id: otherWorkspace });
    const elsewhere = await refused(() => open(a, [b.id, c.id, foreign.id]));
    expect(elsewhere).toMatchObject({ status: 404, code: "not_found" });
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

// ---- S5: two requests at the same moment, locks and isolation (R13, R22)

describe("the same set at the same moment, R13", () => {
  // Each request runs on its own connection: one pool of n, one drizzle client.
  async function together(
    requests: { who: User; ids: string[] }[],
    wrap?: (d: DirectDeps) => DirectDeps,
  ) {
    const pool = postgres(h.config.database.url, {
      max: requests.length,
      onnotice: () => {},
    });
    try {
      const base: DirectDeps = { ...deps, db: drizzle(pool) };
      const d = wrap ? wrap(base) : base;
      return await Promise.all(
        requests.map((r) => handleOpenDirect(d, r.who, { userIds: r.ids })),
      );
    } finally {
      await pool.end();
    }
  }
  const REPEAT = 20;

  it(`a dm from both people together: one 201, one 200, one id, one row and a row for each person, ${REPEAT} times`, async () => {
    for (let i = 0; i < REPEAT; i += 1) {
      const a = await user();
      const b = await user();
      const before = await counts();
      const res = await together([
        { who: a, ids: [b.id] },
        { who: b, ids: [a.id] },
      ]);
      expect(res.map((r) => r.status).sort()).toEqual([200, 201]);
      expect(res[0]!.conversation.id).toBe(res[1]!.conversation.id);
      const after = await counts();
      expect([after.c - before.c, after.m - before.m]).toEqual([1, 2]);
    }
  });

  it(`a group of 4 from its four members together: one 201, three 200, ${REPEAT} times`, async () => {
    for (let i = 0; i < REPEAT; i += 1) {
      const people = await Promise.all([user(), user(), user(), user()]);
      const before = await counts();
      const res = await together(
        people.map((p) => ({
          who: p,
          ids: people.filter((o) => o !== p).map((o) => o.id),
        })),
      );
      expect(res.map((r) => r.status).sort()).toEqual([200, 200, 200, 201]);
      expect(new Set(res.map((r) => r.conversation.id)).size).toBe(1);
      const after = await counts();
      expect([after.c - before.c, after.m - before.m]).toEqual([1, 4]);
    }
  });

  it(`10 requests of one person for one dm together: one 201, nine 200, ${REPEAT} times`, async () => {
    for (let i = 0; i < REPEAT; i += 1) {
      const a = await user();
      const b = await user();
      const before = await counts();
      const res = await together(
        Array.from({ length: 10 }, () => ({ who: a, ids: [b.id] })),
      );
      expect(res.filter((r) => r.status === 201)).toHaveLength(1);
      expect(res.filter((r) => r.status === 200)).toHaveLength(9);
      expect(new Set(res.map((r) => r.conversation.id)).size).toBe(1);
      const after = await counts();
      expect([after.c - before.c, after.m - before.m]).toEqual([1, 2]);
    }
  });

  it("the transaction is READ COMMITTED even on a connection whose default is REPEATABLE READ", async () => {
    const pool = postgres(h.config.database.url, {
      max: 2,
      onnotice: () => {},
      connection: { default_transaction_isolation: "repeatable read" },
    });
    try {
      const [outside] = await pool`show transaction_isolation`;
      // The default of this connection is the stricter one: the test would
      // prove nothing otherwise.
      expect(outside!.transaction_isolation).toBe("repeatable read");
      let inside: string | undefined;
      const spy: DirectDeps = {
        ...deps,
        db: drizzle(pool),
        getAccountsByIds: async (client, ids, options) => {
          const rows = await getAccountsByIds(client, ids, options);
          const shown = await client.execute(sql`show transaction_isolation`);
          inside = (shown[0] as { transaction_isolation: string })
            .transaction_isolation;
          return rows;
        },
      };
      const a = await user();
      const b = await user();
      expect((await open(a, [b.id], spy)).status).toBe(201);
      expect(inside).toBe("read committed");
    } finally {
      await pool.end();
    }
  });
});

describe("locks, R22", () => {
  // Runs `change` in a transaction on a second connection, holds it, starts
  // `request`, waits until something waits on a lock, commits, and returns
  // what the request returned or threw.
  async function whileHeld(
    change: (tx: Sql) => Promise<unknown>,
    request: () => Promise<unknown>,
  ) {
    const other = secondConnection(h);
    try {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let held!: () => void;
      const heldP = new Promise<void>((r) => (held = r));
      const holder = other.begin(async (tx) => {
        await change(tx as unknown as Sql);
        held();
        await gate;
      });
      await heldP;
      const pending = request().then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      await waitForLock(h.sql);
      release();
      await holder;
      return await pending;
    } finally {
      await other.end();
    }
  }

  it("a person deactivated while the create waits is refused with 409 and no row", async () => {
    const a = await user();
    const b = await user();
    const before = await counts();
    const res = await whileHeld(
      (tx) => tx`update users set status = 'deactivated' where id = ${b.id}`,
      () => open(a, [b.id]),
    );
    expect(res).toMatchObject({
      error: {
        status: 409,
        code: "person_deactivated",
        details: { userIds: [b.id] },
      },
    });
    expect(await counts()).toEqual(before);
  });

  it("a caller deactivated while their own request waits gets 401", async () => {
    const a = await user();
    const b = await user();
    const before = await counts();
    const res = await whileHeld(
      (tx) => tx`update users set status = 'deactivated' where id = ${a.id}`,
      () => open(a, [b.id]),
    );
    expect(res).toMatchObject({
      error: { status: 401, code: "account_deactivated" },
    });
    expect(await counts()).toEqual(before);
  });

  it("a create and a person route that locks every users row in id order, started together, finish without a deadlock", async () => {
    // What the person routes of TOKI-024 do: every row, in id order, FOR NO KEY
    // UPDATE, then a change of one of them. Both sides lock in id order, so
    // 40P01 (deadlock detected) must never happen; the pairs are started at
    // the same moment and repeated.
    const other = secondConnection(h);
    try {
      for (let i = 0; i < 20; i += 1) {
        const a = await user();
        const b = await user();
        const [created, person] = await Promise.race([
          Promise.allSettled([
            open(a, [b.id]),
            other.begin(async (tx) => {
              await tx`select id from users where workspace_id = ${h.workspaceId} order by id for no key update`;
              await tx`update users set display_name = 'Renamed' where id = ${b.id}`;
            }),
          ]),
          new Promise<"deadlock">((r) =>
            setTimeout(() => r("deadlock"), 10_000),
          ),
        ]);
        expect(created, `round ${i}`).toMatchObject({ status: "fulfilled" });
        expect(person, `round ${i}`).toMatchObject({ status: "fulfilled" });
      }
    } finally {
      await other.end();
    }
  });
});
