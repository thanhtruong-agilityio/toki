import type { ConversationFacts } from "@toki/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import { getConversationFacts } from "../../src/modules/conversations/index.js";
import { getAccountsByIds } from "../../src/modules/members/index.js";
import {
  insertConversation,
  insertConversationMember,
  insertDirectConversation,
} from "../test-rows.js";
import {
  bystander,
  jsonOf,
  newChannelId,
  person,
  send,
  type Person,
} from "./channel-helpers.js";

// R1 and R2 through the routes (TOKI-029). The facts and account reads are
// replaced only where the database cannot hold the case.
type FactsMode = "real" | "broken";
let factsMode: FactsMode = "real";
let guestActor: string | undefined;
let h: Harness;
let admin: Person;
let member: Person;
beforeAll(async () => {
  h = await createHarness({
    channelDeps: {
      getConversationFacts: async (db, actorId, id) => {
        const facts = await getConversationFacts(db, actorId, id);
        return factsMode === "broken" && facts
          ? ({ ...facts, isMember: "yes" } as unknown as ConversationFacts)
          : facts;
      },
      getAccountsByIds: async (client, ids, options) => {
        const rows = await getAccountsByIds(client, ids, options);
        // The role check constraint of `users` refuses a role the functions do
        // not know, so the read is given one.
        return rows.map((r) =>
          r.id === guestActor ? { ...r, role: "guest" } : r,
        );
      },
    },
  });
  admin = await person(h, "x-admin", "admin");
  member = await person(h, "x-member");
});
afterAll(async () => {
  await h?.close();
});

async function channel(name: string, isPrivate: boolean, members: string[]) {
  const id = await insertConversation(h.sql, {
    workspace_id: h.workspaceId,
    created_by: admin.id,
    name,
    is_private: isPrivate,
  });
  for (const user_id of members) {
    await insertConversationMember(h.sql, {
      conversation_id: id,
      user_id,
      workspace_id: h.workspaceId,
    });
  }
  return id;
}

// Every route that names a conversation, with a body that passes its schema.
const NAMED_ROUTES = (id: string, user: string) =>
  [
    ["GET", `/api/v1/channels/${id}`, undefined],
    ["GET", `/api/v1/channels/${id}/members`, undefined],
    ["PATCH", `/api/v1/channels/${id}`, { topic: "x" }],
    ["POST", `/api/v1/channels/${id}/join`, undefined],
    ["POST", `/api/v1/channels/${id}/members`, { userIds: [user] }],
    ["POST", `/api/v1/channels/${id}/leave`, undefined],
    ["DELETE", `/api/v1/channels/${id}/members/${user}`, undefined],
    ["POST", `/api/v1/channels/${id}/archive`, undefined],
    ["POST", `/api/v1/channels/${id}/restore`, undefined],
  ] as const;

describe("a private channel and a DM are never confirmed (R1 step 3)", () => {
  it("answers 404 with one body on every route that names it, to a Member and to an Admin who are not in it", async () => {
    const priv = await channel("ac-private", true, [admin.id]);
    const dm = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [admin.id, member.id],
      created_by: admin.id,
    });
    const third = await bystander(h, "x-third");
    const group = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [admin.id, member.id, third],
      created_by: admin.id,
    });
    const outsider = await person(h, "x-outsider", "admin");
    const bodies = new Set<string>();
    // A Member who is not in the private channel, an Admin who is not in it
    // and the DM id: never 403, whatever the route.
    for (const [who, id] of [
      [member, priv],
      [outsider, priv],
      [outsider, dm],
      [outsider, group],
      [admin, group],
      [member, newChannelId()],
    ] as const) {
      for (const [method, url, body] of NAMED_ROUTES(id, member.id)) {
        const res = await send(h, who, method, url, body);
        expect(res.statusCode, `${method} ${url}`).toBe(404);
        bodies.add(res.body);
      }
    }
    expect(bodies.size).toBe(1);
  });
});

describe("the reasons of R2 that real requests reach", () => {
  it.each([
    ["role_not_allowed", 403, "forbidden"],
    ["not_a_member of a public channel", 403, "forbidden"],
    ["private_channel", 404, "not_found"],
    ["channel_is_general", 409, "channel_is_general"],
    ["channel_archived", 409, "channel_archived"],
  ])("%s answers %i %s", async (reason, status, code) => {
    const mine = await channel(`ac-r-${status}-${reason.length}`, false, [
      admin.id,
      member.id,
    ]);
    let res;
    if (reason === "role_not_allowed") {
      res = await send(h, member, "POST", `/api/v1/channels/${mine}/archive`);
    } else if (reason.startsWith("not_a_member")) {
      const open = await channel("ac-not-member", false, [admin.id]);
      res = await send(h, member, "PATCH", `/api/v1/channels/${open}`, {
        topic: "x",
      });
    } else if (reason === "private_channel") {
      const priv = await channel("ac-priv-join", true, [admin.id, member.id]);
      res = await send(h, member, "POST", `/api/v1/channels/${priv}/join`);
    } else if (reason === "channel_is_general") {
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
      res = await send(h, admin, "POST", `/api/v1/channels/${general}/leave`);
    } else {
      const old = await insertConversation(h.sql, {
        workspace_id: h.workspaceId,
        created_by: admin.id,
        name: "ac-old",
        archived_at: new Date("2026-02-01T00:00:00Z"),
      });
      await insertConversationMember(h.sql, {
        conversation_id: old,
        user_id: member.id,
        workspace_id: h.workspaceId,
      });
      res = await send(h, member, "PATCH", `/api/v1/channels/${old}`, {
        topic: "x",
      });
    }
    expect(res.statusCode).toBe(status);
    expect(jsonOf(res).error.code).toBe(code);
  });
});

describe("the reasons of R2 that no real request reaches", () => {
  it("fact_missing answers 500 internal_error", async () => {
    const id = await channel("ac-fact", false, [admin.id, member.id]);
    factsMode = "broken";
    try {
      const res = await send(h, member, "PATCH", `/api/v1/channels/${id}`, {
        topic: "x",
      });
      expect(res.statusCode).toBe(500);
      expect(jsonOf(res).error.code).toBe("internal_error");
    } finally {
      factsMode = "real";
    }
  });

  it("unknown_role answers 500 internal_error", async () => {
    const guest = await person(h, "x-guest", "admin");
    guestActor = guest.id;
    try {
      const res = await send(h, guest, "POST", "/api/v1/channels", {
        id: newChannelId(),
        name: "ac-guest",
      });
      expect(res.statusCode).toBe(500);
      expect(jsonOf(res).error.code).toBe("internal_error");
    } finally {
      guestActor = undefined;
    }
    const rows =
      await h.sql`select 1 from conversations where name = 'ac-guest'`;
    expect(rows).toHaveLength(0);
  });
});
