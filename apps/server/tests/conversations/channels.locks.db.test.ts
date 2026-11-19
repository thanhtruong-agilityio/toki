import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import {
  bystander,
  conversationRows,
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
