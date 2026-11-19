import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordAction } from "../../src/modules/members/record.js";
import { createMigratedDb } from "../migrated-db.js";
import { insertUser, insertWorkspace } from "../test-rows.js";

let t: Awaited<ReturnType<typeof createMigratedDb>>;
let ws: string;
let admin: string;
let person: string;
const AT = new Date("2026-03-04T05:06:07.000Z");

beforeAll(async () => {
  t = await createMigratedDb();
  ws = await insertWorkspace(t.sql);
  admin = await insertUser(t.sql, { workspace_id: ws, role: "admin" });
  person = await insertUser(t.sql, { workspace_id: ws });
});
afterAll(async () => {
  await t?.close();
});

const rows = () => t.sql`select * from admin_actions order by id`;

describe("recordAction (R31)", () => {
  it("writes the actor, the action, the person, the detail and the given time", async () => {
    await recordAction(t.db, {
      workspaceId: ws,
      actorId: admin,
      action: "role_changed",
      targetUserId: person,
      detail: { role: "admin", earlierRole: "member" },
      at: AT,
    });
    const [row] = await rows();
    expect(row).toMatchObject({
      workspace_id: ws,
      actor_id: admin,
      action: "role_changed",
      target_user_id: person,
      target_email: null,
      detail: { role: "admin", earlierRole: "member" },
    });
    expect((row!.created_at as Date).toISOString()).toBe(AT.toISOString());
    expect((row!.id as string)[14]).toBe("7");
  });

  it("writes the address for an invitation", async () => {
    await recordAction(t.db, {
      workspaceId: ws,
      actorId: admin,
      action: "invitation_created",
      targetEmail: "new@example.com",
      detail: { invitationId: "x", role: "member" },
      at: AT,
    });
    const all = await rows();
    expect(all.at(-1)).toMatchObject({
      action: "invitation_created",
      target_user_id: null,
      target_email: "new@example.com",
    });
  });

  it("is rolled back with the transaction it is given", async () => {
    const before = (await rows()).length;
    await t.db
      .transaction(async (tx) => {
        await recordAction(tx, {
          workspaceId: ws,
          actorId: admin,
          action: "account_deactivated",
          targetUserId: person,
          detail: {},
          at: AT,
        });
        throw new Error("the change failed");
      })
      .catch(() => {});
    expect((await rows()).length).toBe(before);
  });
});
