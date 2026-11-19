import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import type { Change } from "../../src/modules/conversations/changes.js";
import {
  insertConversation,
  insertConversationMember,
  insertDirectConversation,
} from "../test-rows.js";
import {
  jsonOf,
  memberRows,
  person,
  send,
  type Person,
} from "./channel-helpers.js";

const changes: Change[] = [];
let h: Harness;
let admin: Person;
let admin2: Person;
let member: Person;
beforeAll(async () => {
  h = await createHarness({
    channelDeps: {
      recordChange: async (_tx, change) => {
        changes.push(change);
      },
    },
  });
  admin = await person(h, "a-admin", "admin");
  admin2 = await person(h, "a-admin2", "admin");
  member = await person(h, "a-member");
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
  } = {},
) {
  const id = await insertConversation(h.sql, {
    workspace_id: h.workspaceId,
    created_by: admin.id,
    name,
    is_private: options.isPrivate ?? false,
    is_general: options.general ?? false,
    archived_at: options.archived ? new Date("2026-02-01T00:00:00Z") : null,
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
const archive = (who: Person, id: string) =>
  send(h, who, "POST", `/api/v1/channels/${id}/archive`);
const restore = (who: Person, id: string) =>
  send(h, who, "POST", `/api/v1/channels/${id}/restore`);
const archivedAt = async (id: string) =>
  (await h.sql`select archived_at from conversations where id = ${id}`)[0]!
    .archived_at as Date | null;
let generalId: string | undefined;
const general = async () =>
  (generalId ??= await channel("general", { general: true }));

describe("archive, R14", () => {
  it.each([
    ["public", false],
    ["private", true],
  ])(
    "lets an Admin who is a member archive a %s channel, keeps its members and records it",
    async (_l, isPrivate) => {
      const id = await channel(`ar-${_l}`, { isPrivate });
      const before = changes.length;
      const res = await archive(admin, id);
      expect(res.statusCode).toBe(200);
      expect(jsonOf(res)).toMatchObject({
        changed: true,
        channel: { id, archived: true, isMember: true },
      });
      expect((await archivedAt(id))!.toISOString()).toBe(
        new Date(h.clock.now()).toISOString(),
      );
      expect(await memberRows(h.sql, id)).toHaveLength(2);
      expect(changes.length - before).toBe(1);
      expect(changes.at(-1)).toMatchObject({
        type: "channel_archived",
        conversationId: id,
      });
    },
  );

  it("archiving an archived channel changes nothing and records nothing", async () => {
    const id = await channel("ar-twice", { archived: true });
    const before = changes.length;
    const res = await archive(admin, id);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res).changed).toBe(false);
    expect(changes.length).toBe(before);
  });

  it("refuses a Member with 403, an Admin outside a public channel with 403 and outside a private one with 404", async () => {
    const pub = await channel("ar-pub-out");
    const priv = await channel("ar-priv-out", { isPrivate: true });
    const a = await archive(member, pub);
    expect(a.statusCode).toBe(403);
    expect(jsonOf(a).error.code).toBe("forbidden");
    expect((await archive(admin2, pub)).statusCode).toBe(403);
    expect((await archive(admin2, priv)).statusCode).toBe(404);
    expect(await archivedAt(pub)).toBeNull();
  });

  it("refuses #general with 409 and a DM with 404", async () => {
    const res = await archive(admin, await general());
    expect(res.statusCode).toBe(409);
    expect(jsonOf(res).error.code).toBe("channel_is_general");
    const dm = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [admin.id, member.id],
      created_by: admin.id,
    });
    expect((await archive(admin, dm)).statusCode).toBe(404);
    expect((await restore(admin, dm)).statusCode).toBe(404);
  });
});

describe("restore, R14", () => {
  it("lets an Admin who is a member restore, keeping members and their settings", async () => {
    const id = await channel("rs-member", { archived: true });
    await h.sql`update conversation_members set notification_level = 'none', is_muted = true where conversation_id = ${id} and user_id = ${member.id}`;
    const before = changes.length;
    const res = await restore(admin, id);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res)).toMatchObject({
      changed: true,
      channel: { archived: false },
    });
    expect(await archivedAt(id)).toBeNull();
    const rows = await memberRows(h.sql, id);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.user_id === member.id)).toMatchObject({
      notification_level: "none",
      is_muted: true,
    });
    expect(changes.slice(before).map((c) => c.type)).toEqual([
      "channel_restored",
    ]);
  });

  it("lets an Admin who is not a member restore an archived public channel and become its member with the defaults", async () => {
    const id = await channel("rs-outsider", {
      archived: true,
      members: [member.id],
    });
    const before = changes.length;
    const res = await restore(admin2, id);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res)).toMatchObject({
      changed: true,
      channel: { archived: false, isMember: true, memberCount: 2 },
    });
    const rows = await memberRows(h.sql, id);
    expect(rows.find((r) => r.user_id === admin2.id)).toMatchObject({
      notification_level: null,
      is_muted: false,
      is_starred: false,
    });
    expect(changes.slice(before).map((c) => c.type)).toEqual([
      "channel_restored",
      "member_joined",
    ]);
  });

  it("answers 404 to an Admin who is not in an archived private channel, and the channel stays archived", async () => {
    const id = await channel("rs-private", {
      archived: true,
      isPrivate: true,
      members: [member.id],
    });
    expect((await restore(admin2, id)).statusCode).toBe(404);
    expect(await archivedAt(id)).not.toBeNull();
    // A member who is an Admin restores it.
    const mine = await channel("rs-private-mine", {
      archived: true,
      isPrivate: true,
    });
    expect((await restore(admin, mine)).statusCode).toBe(200);
  });

  it("restoring an active channel changes nothing and adds no member row", async () => {
    const id = await channel("rs-active", { members: [member.id] });
    const before = changes.length;
    const res = await restore(admin2, id);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res).changed).toBe(false);
    expect(await memberRows(h.sql, id)).toHaveLength(1);
    expect(changes.length).toBe(before);
  });

  it("refuses a Member with 403 and #general with 409", async () => {
    const id = await channel("rs-by-member", { archived: true });
    expect((await restore(member, id)).statusCode).toBe(403);
    const res = await restore(admin, await general());
    expect(res.statusCode).toBe(409);
    expect(jsonOf(res).error.code).toBe("channel_is_general");
  });
});
