import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import type { Change } from "../../src/modules/conversations/changes.js";
import {
  insertConversation,
  insertConversationMember,
  insertDirectConversation,
} from "../test-rows.js";
import { jsonOf, person, send, type Person } from "./channel-helpers.js";

const changes: Change[] = [];
let h: Harness;
let admin: Person;
let member: Person;
let lone: Person;
beforeAll(async () => {
  h = await createHarness({
    channelDeps: {
      recordChange: async (_tx, change) => {
        changes.push(change);
      },
    },
  });
  admin = await person(h, "e-admin", "admin");
  member = await person(h, "e-member");
  lone = await person(h, "e-lone");
});
afterAll(async () => {
  await h?.close();
});

async function channel(
  name: string,
  options: {
    isPrivate?: boolean;
    archived?: boolean;
    general?: boolean;
    members?: string[];
    topic?: string | null;
    description?: string | null;
  } = {},
) {
  const id = await insertConversation(h.sql, {
    workspace_id: h.workspaceId,
    created_by: admin.id,
    name,
    is_private: options.isPrivate ?? false,
    is_general: options.general ?? false,
    archived_at: options.archived ? new Date("2026-02-01T00:00:00Z") : null,
    topic: options.topic ?? null,
    description: options.description ?? null,
  });
  for (const user_id of options.members ?? [admin.id, member.id]) {
    await insertConversationMember(h.sql, {
      conversation_id: id,
      user_id,
      workspace_id: h.workspaceId,
    });
  }
  return id;
}
const edit = (who: Person, id: string, body: unknown) =>
  send(h, who, "PATCH", `/api/v1/channels/${id}`, body);
const row = async (id: string) =>
  (
    await h.sql`select topic, description, name, is_private from conversations where id = ${id}`
  )[0]!;

describe("edit, R9", () => {
  it.each([
    ["a Member", () => member],
    ["an Admin", () => admin],
  ])(
    "lets %s who is a member change the topic and the description",
    async (_l, who) => {
      const id = await channel(
        `ed-ok-${_l.toLowerCase().replace(/[^a-z]/g, "")}`,
      );
      const before = changes.length;
      const res = await edit(who(), id, {
        topic: "  new topic ",
        description: "why",
      });
      expect(res.statusCode).toBe(200);
      expect(jsonOf(res)).toMatchObject({
        changed: true,
        channel: { id, topic: "new topic", description: "why", isMember: true },
      });
      expect(await row(id)).toMatchObject({
        topic: "new topic",
        description: "why",
      });
      expect(changes.length - before).toBe(1);
      expect(changes.at(-1)).toMatchObject({
        type: "details_changed",
        conversationId: id,
      });
    },
  );

  it("refuses a non-member of a public channel with 403 and of a private one with 404", async () => {
    const pub = await channel("ed-pub", { members: [admin.id] });
    const priv = await channel("ed-priv", {
      isPrivate: true,
      members: [admin.id],
    });
    const a = await edit(lone, pub, { topic: "x" });
    expect(a.statusCode).toBe(403);
    expect(jsonOf(a).error.code).toBe("forbidden");
    const b = await edit(lone, priv, { topic: "x" });
    expect(b.statusCode).toBe(404);
    expect((await row(pub)).topic).toBe(null);
  });

  it("answers 404 for a DM and for an unknown id", async () => {
    const dm = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [admin.id, member.id],
      created_by: admin.id,
    });
    expect((await edit(admin, dm, { topic: "x" })).statusCode).toBe(404);
    expect(
      (
        await edit(admin, "01930b7e-7a53-7c2e-9f1a-00000000dead", {
          topic: "x",
        })
      ).statusCode,
    ).toBe(404);
  });

  it("refuses an edit of an archived channel with 409 channel_archived", async () => {
    const id = await channel("ed-old", { archived: true });
    const res = await edit(member, id, { topic: "x" });
    expect(res.statusCode).toBe(409);
    expect(jsonOf(res).error.code).toBe("channel_archived");
    expect((await row(id)).topic).toBe(null);
  });

  it("holds the limits: topic 250 and 251, 250 and 251 emoji, description 500 and 501", async () => {
    const id = await channel("ed-limits");
    expect(
      (await edit(member, id, { topic: "t".repeat(250) })).statusCode,
    ).toBe(200);
    expect(
      (await edit(member, id, { topic: "t".repeat(251) })).statusCode,
    ).toBe(400);
    expect(
      (await edit(member, id, { topic: "😀".repeat(250) })).statusCode,
    ).toBe(200);
    expect(
      (await edit(member, id, { topic: "😀".repeat(251) })).statusCode,
    ).toBe(400);
    expect(
      (await edit(member, id, { description: "d".repeat(500) })).statusCode,
    ).toBe(200);
    const bad = await edit(member, id, { description: "d".repeat(501) });
    expect(bad.statusCode).toBe(400);
    expect(jsonOf(bad).error.code).toBe("validation_failed");
  });

  it("stores an emptied topic as null", async () => {
    const id = await channel("ed-empty", { topic: "had one" });
    const res = await edit(member, id, { topic: "   " });
    expect(jsonOf(res)).toMatchObject({
      changed: true,
      channel: { topic: null },
    });
    expect((await row(id)).topic).toBe(null);
  });

  it("refuses name, isPrivate, kind and an empty body, and changes nothing", async () => {
    const id = await channel("ed-strict", { topic: "keep" });
    for (const body of [
      { name: "other" },
      { isPrivate: true },
      { kind: "dm" },
      { topic: "x", name: "other" },
      {},
    ]) {
      const res = await edit(member, id, body);
      expect(res.statusCode).toBe(400);
      expect(jsonOf(res).error.code).toBe("validation_failed");
    }
    expect(await row(id)).toMatchObject({
      topic: "keep",
      name: "ed-strict",
      is_private: false,
    });
  });

  it("answers 200 changed false and records nothing when the value is already stored", async () => {
    const id = await channel("ed-same", { topic: "same", description: "d" });
    const before = changes.length;
    const res = await edit(member, id, { topic: "same", description: "d" });
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res).changed).toBe(false);
    expect(changes.length).toBe(before);
  });

  it("works in #general", async () => {
    const id = await channel("general", { general: true });
    const res = await edit(member, id, { topic: "Everyone" });
    expect(res.statusCode).toBe(200);
    expect((await row(id)).topic).toBe("Everyone");
  });

  it("keeps both changes when the topic and the description are changed at the same moment", async () => {
    const id = await channel("ed-both");
    const [a, b] = await Promise.all([
      edit(member, id, { topic: "one" }),
      edit(admin, id, { description: "two" }),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(await row(id)).toMatchObject({ topic: "one", description: "two" });
  });
});
