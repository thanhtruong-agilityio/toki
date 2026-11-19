import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import type { Change } from "../../src/modules/conversations/changes.js";
import { addMemberToGeneral } from "../../src/modules/conversations/index.js";
import { insertConversation, insertConversationMember } from "../test-rows.js";
import {
  bystander,
  conversationRows,
  memberRows,
  jsonOf,
  newChannelId,
  person,
  secondConnection,
  send,
  waitForLock,
  type Person,
} from "./channel-helpers.js";

// The two-connection cases of TOKI-029 R15, grown with the routes. Each one
// sets up the only order that can happen: the second connection changes a
// `users` row first and holds it; the request then waits on its `FOR SHARE`
// read of that row and, after the commit, reads the result.
// A test can hold the first write inside its transaction: `hook` runs where the
// change is recorded, after the write and before the commit.
let hook: ((change: Change) => Promise<void>) | undefined;
let h: Harness;
beforeAll(async () => {
  h = await createHarness({
    channelDeps: {
      recordChange: async (_tx, change) => {
        await hook?.(change);
      },
    },
  });
});
afterAll(async () => {
  await h?.close();
});

// Runs `change` in a transaction on a second connection and holds it open
// while `request` starts and waits; then commits and returns the response.
async function whileHeld(
  change: (tx: ReturnType<typeof secondConnection>) => Promise<unknown>,
  request: () => Promise<{ statusCode: number; body: string }>,
) {
  const other = secondConnection(h);
  try {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let held!: () => void;
    const heldP = new Promise<void>((r) => (held = r));
    const holder = other.begin(async (tx) => {
      await change(tx as unknown as ReturnType<typeof secondConnection>);
      held();
      await gate;
    });
    await heldP;
    const pending = request();
    await waitForLock(h.sql);
    release();
    await holder;
    return await pending;
  } finally {
    await other.end();
  }
}

describe("create (S4)", () => {
  it("a person who is deactivated while the request waits is refused: 400 invalid_member and no row", async () => {
    const admin = await person(h, "lock-admin-1", "admin");
    const guest = await bystander(h, "lock-guest-1");
    const res = await whileHeld(
      (tx) => tx`update users set status = 'deactivated' where id = ${guest}`,
      () =>
        send(h, admin, "POST", "/api/v1/channels", {
          id: newChannelId(),
          name: "lock-create-1",
          memberIds: [guest],
        }),
    );
    expect(res.statusCode).toBe(400);
    expect(jsonOf(res).error.code).toBe("invalid_member");
    expect(
      await conversationRows(h.sql, "name = 'lock-create-1'"),
    ).toHaveLength(0);
  });

  it("an Admin who is demoted while the request waits gets 403 forbidden", async () => {
    const admin: Person = await person(h, "lock-admin-2", "admin");
    const res = await whileHeld(
      (tx) => tx`update users set role = 'member' where id = ${admin.id}`,
      () =>
        send(h, admin, "POST", "/api/v1/channels", {
          id: newChannelId(),
          name: "lock-create-2",
        }),
    );
    expect(res.statusCode).toBe(403);
    expect(jsonOf(res).error.code).toBe("forbidden");
    expect(
      await conversationRows(h.sql, "name = 'lock-create-2'"),
    ).toHaveLength(0);
  });

  it("an Admin who is deactivated while the request waits gets 401 account_deactivated", async () => {
    const admin: Person = await person(h, "lock-admin-3", "admin");
    const res = await whileHeld(
      (tx) =>
        tx`update users set status = 'deactivated' where id = ${admin.id}`,
      () =>
        send(h, admin, "POST", "/api/v1/channels", {
          id: newChannelId(),
          name: "lock-create-3",
        }),
    );
    expect(res.statusCode).toBe(401);
    expect(jsonOf(res).error.code).toBe("account_deactivated");
    expect(
      await conversationRows(h.sql, "name = 'lock-create-3'"),
    ).toHaveLength(0);
  });
});

// A public channel with one member, made by rows.
async function openChannel(
  name: string,
  memberIds: string[],
  isPrivate = false,
) {
  const id = await insertConversation(h.sql, {
    workspace_id: h.workspaceId,
    created_by: memberIds[0]!,
    name,
    is_private: isPrivate,
  });
  for (const user_id of memberIds) {
    await insertConversationMember(h.sql, {
      conversation_id: id,
      user_id,
      workspace_id: h.workspaceId,
    });
  }
  return id;
}

describe("join and add (S7)", () => {
  it("a Member who is deactivated while their join waits gets 401 account_deactivated and no member row", async () => {
    const owner = await bystander(h, "lock-owner-4");
    const id = await openChannel("lock-join-4", [owner]);
    const joiner: Person = await person(h, "lock-joiner-4");
    const res = await whileHeld(
      (tx) =>
        tx`update users set status = 'deactivated' where id = ${joiner.id}`,
      () => send(h, joiner, "POST", `/api/v1/channels/${id}/join`),
    );
    expect(res.statusCode).toBe(401);
    expect(jsonOf(res).error.code).toBe("account_deactivated");
    expect(await memberRows(h.sql, id)).toHaveLength(1);
  });

  it("an add of a person who is being deactivated is 400 invalid_member and writes no member row", async () => {
    const adder: Person = await person(h, "lock-adder-5");
    const id = await openChannel("lock-add-5", [adder.id]);
    const target = await bystander(h, "lock-target-5");
    const res = await whileHeld(
      (tx) => tx`update users set status = 'deactivated' where id = ${target}`,
      () =>
        send(h, adder, "POST", `/api/v1/channels/${id}/members`, {
          userIds: [target],
        }),
    );
    expect(res.statusCode).toBe(400);
    expect(jsonOf(res).error.code).toBe("invalid_member");
    expect(await memberRows(h.sql, id)).toHaveLength(1);
  });
});

// Holds the first change of `type` inside its transaction until `release()`.
function holdFirst(type: Change["type"]) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let entered!: () => void;
  const enteredP = new Promise<void>((r) => (entered = r));
  let taken = false;
  hook = async (change) => {
    if (change.type === type && !taken) {
      taken = true;
      entered();
      await gate;
    }
  };
  return {
    entered: enteredP,
    release: () => {
      release();
    },
    done: () => {
      hook = undefined;
    },
  };
}

describe("leave and remove (S8)", () => {
  it("two last members of a private channel leaving at the same moment leave it archived with no member", async () => {
    const a: Person = await person(h, "lock-last-a");
    const b: Person = await person(h, "lock-last-b");
    const id = await openChannel("lock-last", [a.id, b.id], true);
    const held = holdFirst("member_left");
    try {
      const first = send(h, a, "POST", `/api/v1/channels/${id}/leave`);
      await held.entered;
      // The first has deleted its row and holds the transaction open; the
      // second must wait on the conversation row, not read the first's row.
      const second = send(h, b, "POST", `/api/v1/channels/${id}/leave`);
      await waitForLock(h.sql);
      held.release();
      const [x, y] = await Promise.all([first, second]);
      expect([x.statusCode, y.statusCode]).toEqual([200, 200]);
      expect(jsonOf(x).archived).toBe(false);
      expect(jsonOf(y).archived).toBe(true);
    } finally {
      held.done();
    }
    expect(await memberRows(h.sql, id)).toHaveLength(0);
    const [row] =
      await h.sql`select archived_at from conversations where id = ${id}`;
    expect(row!.archived_at).not.toBeNull();
  });

  it("a leave that meets an add of the same person waits for it and removes the person added", async () => {
    const adder: Person = await person(h, "lock-adder-7");
    const x: Person = await person(h, "lock-x-7");
    const id = await openChannel("lock-leave-add", [adder.id]);
    const held = holdFirst("members_added");
    try {
      const add = send(h, adder, "POST", `/api/v1/channels/${id}/members`, {
        userIds: [x.id],
      });
      await held.entered;
      const leave = send(h, x, "POST", `/api/v1/channels/${id}/leave`);
      await waitForLock(h.sql);
      held.release();
      const [a, l] = await Promise.all([add, leave]);
      expect(jsonOf(a).added).toEqual([x.id]);
      expect(jsonOf(l)).toEqual({ changed: true, archived: false });
    } finally {
      held.done();
    }
    const rows = await memberRows(h.sql, id);
    expect(rows.map((r) => r.user_id)).toEqual([adder.id]);
  });
});

describe("archive and restore (S9)", () => {
  it("a join that meets an archive waits for it and is refused: no member is added after the archive was read as absent", async () => {
    const admin: Person = await person(h, "lock-arch-admin-8", "admin");
    const joiner: Person = await person(h, "lock-arch-joiner-8");
    const id = await openChannel("lock-join-archive", [admin.id]);
    const held = holdFirst("channel_archived");
    try {
      const archive = send(h, admin, "POST", `/api/v1/channels/${id}/archive`);
      await held.entered;
      const join = send(h, joiner, "POST", `/api/v1/channels/${id}/join`);
      await waitForLock(h.sql);
      held.release();
      const [a, j] = await Promise.all([archive, join]);
      expect(a.statusCode).toBe(200);
      expect(j.statusCode).toBe(409);
      expect(jsonOf(j).error.code).toBe("channel_archived");
    } finally {
      held.done();
    }
    expect(await memberRows(h.sql, id)).toHaveLength(1);
  });

  it("an edit of the topic that meets an archive is refused and changes nothing", async () => {
    const admin: Person = await person(h, "lock-arch-admin-9", "admin");
    const id = await openChannel("lock-edit-archive", [admin.id]);
    const held = holdFirst("channel_archived");
    try {
      const archive = send(h, admin, "POST", `/api/v1/channels/${id}/archive`);
      await held.entered;
      const edit = send(h, admin, "PATCH", `/api/v1/channels/${id}`, {
        topic: "late",
      });
      await waitForLock(h.sql);
      held.release();
      const [, e] = await Promise.all([archive, edit]);
      expect(e.statusCode).toBe(409);
    } finally {
      held.done();
    }
    const [row] = await h.sql`select topic from conversations where id = ${id}`;
    expect(row!.topic).toBeNull();
  });

  it("an Admin who is demoted before the archive reads their row gets 403 forbidden", async () => {
    const admin: Person = await person(h, "lock-arch-admin-10", "admin");
    const id = await openChannel("lock-demoted", [admin.id]);
    const res = await whileHeld(
      (tx) => tx`update users set role = 'member' where id = ${admin.id}`,
      () => send(h, admin, "POST", `/api/v1/channels/${id}/archive`),
    );
    expect(res.statusCode).toBe(403);
    expect(jsonOf(res).error.code).toBe("forbidden");
    const [row] =
      await h.sql`select archived_at from conversations where id = ${id}`;
    expect(row!.archived_at).toBeNull();
  });
});

describe("#general and a newcomer (S11)", () => {
  it("addMemberToGeneral is not held back by a write that holds the #general row", async () => {
    // The channel routes lock the conversation row FOR NO KEY UPDATE, so the
    // key share that the member row of a newcomer takes does not wait
    // (TOKI-028 hand-offs, TOKI-024 R39).
    const admin: Person = await person(h, "lock-gen-admin", "admin");
    const general = await insertConversation(h.sql, {
      workspace_id: h.workspaceId,
      created_by: admin.id,
      name: "general",
      is_general: true,
    });
    await insertConversationMember(h.sql, {
      conversation_id: general,
      user_id: admin.id,
      workspace_id: h.workspaceId,
    });
    const added = await bystander(h, "lock-gen-added");
    const newcomer = await bystander(h, "lock-gen-newcomer");
    const held = holdFirst("members_added");
    try {
      const add = send(
        h,
        admin,
        "POST",
        `/api/v1/channels/${general}/members`,
        {
          userIds: [added],
        },
      );
      await held.entered;
      const joined = await Promise.race([
        addMemberToGeneral(h.db, {
          workspaceId: h.workspaceId,
          userId: newcomer,
          createdAt: new Date(h.clock.now()),
        }),
        new Promise<"waited">((r) => setTimeout(() => r("waited"), 3000)),
      ]);
      expect(joined).toBe(true);
      held.release();
      expect((await add).statusCode).toBe(200);
    } finally {
      held.done();
    }
    expect(await memberRows(h.sql, general)).toHaveLength(3);
  });
});

describe("no deadlock with a newcomer (S11)", () => {
  it("a join, an add and a leave finish together with addMemberToGeneral", async () => {
    const admin: Person = await person(h, "lock-dead-admin", "admin");
    const joiner: Person = await person(h, "lock-dead-joiner");
    const leaver: Person = await person(h, "lock-dead-leaver");
    const target = await bystander(h, "lock-dead-target");
    const newcomer = await bystander(h, "lock-dead-newcomer");
    const [existing] =
      await h.sql`select id from conversations where is_general`;
    if (!existing) {
      const general = await insertConversation(h.sql, {
        workspace_id: h.workspaceId,
        created_by: admin.id,
        name: "general",
        is_general: true,
      });
      await insertConversationMember(h.sql, {
        conversation_id: general,
        user_id: admin.id,
        workspace_id: h.workspaceId,
      });
    }
    const id = await openChannel("lock-dead", [admin.id, leaver.id]);
    const results = await Promise.race([
      Promise.all([
        send(h, joiner, "POST", `/api/v1/channels/${id}/join`),
        send(h, admin, "POST", `/api/v1/channels/${id}/members`, {
          userIds: [target],
        }),
        send(h, leaver, "POST", `/api/v1/channels/${id}/leave`),
        addMemberToGeneral(h.db, {
          workspaceId: h.workspaceId,
          userId: newcomer,
          createdAt: new Date(h.clock.now()),
        }),
      ]),
      new Promise<"deadlock">((r) => setTimeout(() => r("deadlock"), 8000)),
    ]);
    expect(results).not.toBe("deadlock");
    const [j, a, l, g] = results as [
      { statusCode: number },
      { statusCode: number },
      { statusCode: number },
      boolean,
    ];
    expect([j.statusCode, a.statusCode, l.statusCode, g]).toEqual([
      200,
      200,
      200,
      true,
    ]);
  });
});
