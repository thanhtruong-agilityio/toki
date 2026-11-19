import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
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
let h: Harness;
beforeAll(async () => {
  h = await createHarness();
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
async function openChannel(name: string, memberIds: string[]) {
  const id = await insertConversation(h.sql, {
    workspace_id: h.workspaceId,
    created_by: memberIds[0]!,
    name,
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
