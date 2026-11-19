import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import type { Change } from "../../src/modules/conversations/changes.js";
import { insertConversation, insertConversationMember } from "../test-rows.js";
import {
  jsonOf,
  newChannelId,
  person,
  send,
  type Person,
} from "./channel-helpers.js";

// R16: the seam is called inside the transaction of the change, so a failure
// after it leaves nothing. One call per effective write is checked with each
// route (the create, edit, join, add, leave, remove, archive, restore and
// settings files).
let calls: Change[] = [];
let failAfter: Change["type"] | undefined;
let h: Harness;
let admin: Person;
beforeAll(async () => {
  h = await createHarness({
    channelDeps: {
      recordChange: async (_tx, change) => {
        calls.push(change);
        if (failAfter === change.type) throw new Error("the seam failed");
      },
    },
  });
  admin = await person(h, "z-admin", "admin");
});
afterAll(async () => {
  await h?.close();
});

describe("recordChange runs inside the transaction (R16)", () => {
  it("a failure after the call of Create leaves no channel and no member", async () => {
    failAfter = "channel_created";
    try {
      const id = newChannelId();
      const res = await send(h, admin, "POST", "/api/v1/channels", {
        id,
        name: "seam-create",
      });
      expect(res.statusCode).toBe(500);
      expect(
        await h.sql`select 1 from conversations where id = ${id}`,
      ).toHaveLength(0);
      expect(
        await h.sql`select 1 from conversation_members where conversation_id = ${id}`,
      ).toHaveLength(0);
    } finally {
      failAfter = undefined;
    }
  });

  it("a failure after the call of a leave that empties a private channel keeps the member and the channel active", async () => {
    const id = await insertConversation(h.sql, {
      workspace_id: h.workspaceId,
      created_by: admin.id,
      name: "seam-leave",
      is_private: true,
    });
    await insertConversationMember(h.sql, {
      conversation_id: id,
      user_id: admin.id,
      workspace_id: h.workspaceId,
    });
    failAfter = "channel_archived";
    calls = [];
    try {
      const res = await send(h, admin, "POST", `/api/v1/channels/${id}/leave`);
      expect(res.statusCode).toBe(500);
      // member_left was called, then channel_archived, and both rolled back.
      expect(calls.map((c) => c.type)).toEqual([
        "member_left",
        "channel_archived",
      ]);
    } finally {
      failAfter = undefined;
    }
    const [row] =
      await h.sql`select archived_at from conversations where id = ${id}`;
    expect(row!.archived_at).toBeNull();
    expect(
      await h.sql`select 1 from conversation_members where conversation_id = ${id}`,
    ).toHaveLength(1);
  });

  it("a request that changes nothing calls it zero times", async () => {
    const id = await insertConversation(h.sql, {
      workspace_id: h.workspaceId,
      created_by: admin.id,
      name: "seam-noop",
      topic: "same",
    });
    await insertConversationMember(h.sql, {
      conversation_id: id,
      user_id: admin.id,
      workspace_id: h.workspaceId,
    });
    calls = [];
    const res = await send(h, admin, "PATCH", `/api/v1/channels/${id}`, {
      topic: "same",
    });
    expect(jsonOf(res).changed).toBe(false);
    expect(calls).toEqual([]);
  });
});
