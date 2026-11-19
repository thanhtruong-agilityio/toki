import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import type { Change } from "../../src/modules/conversations/changes.js";
import {
  insertConversation,
  insertConversationMember,
  insertDirectConversation,
} from "../test-rows.js";
import {
  bystander,
  jsonOf,
  memberRows,
  person,
  send,
  type Person,
} from "./channel-helpers.js";

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
  admin = await person(h, "j-admin", "admin");
  member = await person(h, "j-member");
  lone = await person(h, "j-lone");
});
afterAll(async () => {
  await h?.close();
});

async function channel(
  name: string,
  options: {
    isPrivate?: boolean;
    archived?: boolean;
    members?: string[];
  } = {},
) {
  const id = await insertConversation(h.sql, {
    workspace_id: h.workspaceId,
    created_by: admin.id,
    name,
    is_private: options.isPrivate ?? false,
    archived_at: options.archived ? new Date("2026-02-01T00:00:00Z") : null,
  });
  for (const user_id of options.members ?? [admin.id]) {
    await insertConversationMember(h.sql, {
      conversation_id: id,
      user_id,
      workspace_id: h.workspaceId,
    });
  }
  return id;
}
const join = (who: Person, id: string, body?: unknown) =>
  send(h, who, "POST", `/api/v1/channels/${id}/join`, body);
const add = (who: Person, id: string, userIds: unknown) =>
  send(h, who, "POST", `/api/v1/channels/${id}/members`, { userIds });
const rowOf = async (id: string, userId: string) =>
  (await memberRows(h.sql, id)).find((r) => r.user_id === userId);

describe("join, R10", () => {
  it("lets a Member and an Admin join a public channel with the defaults and records it once", async () => {
    const id = await channel("jn-public");
    const before = changes.length;
    const res = await join(member, id);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res)).toMatchObject({
      changed: true,
      channel: { id, isMember: true, memberCount: 2 },
    });
    expect(await rowOf(id, member.id)).toMatchObject({
      notification_level: null,
      is_muted: false,
      is_starred: false,
    });
    expect(changes.length - before).toBe(1);
    expect(changes.at(-1)).toMatchObject({
      type: "member_joined",
      userIds: [member.id],
    });
    expect((await join(lone, id)).statusCode).toBe(200);
  });

  it("answers changed false for a person who is already a member and records nothing", async () => {
    const id = await channel("jn-twice", { members: [admin.id, member.id] });
    const before = changes.length;
    const res = await join(member, id);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res).changed).toBe(false);
    expect(await memberRows(h.sql, id)).toHaveLength(2);
    expect(changes.length).toBe(before);
  });

  it("answers 404 for a private channel, also to a member, and 409 for an archived one", async () => {
    const priv = await channel("jn-private", {
      isPrivate: true,
      members: [admin.id, member.id],
    });
    expect((await join(lone, priv)).statusCode).toBe(404);
    expect((await join(member, priv)).statusCode).toBe(404);
    const old = await channel("jn-old", { archived: true });
    const res = await join(lone, old);
    expect(res.statusCode).toBe(409);
    expect(jsonOf(res).error.code).toBe("channel_archived");
    expect(await rowOf(old, lone.id)).toBeUndefined();
  });

  it("answers 404 for a DM", async () => {
    const dm = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [admin.id, member.id],
      created_by: admin.id,
    });
    expect((await join(lone, dm)).statusCode).toBe(404);
  });

  it("takes the three body forms and refuses any other key", async () => {
    const a = await channel("jn-body-a");
    const b = await channel("jn-body-b");
    const c = await channel("jn-body-c");
    expect((await join(lone, a)).statusCode).toBe(200);
    expect((await join(lone, b, {})).statusCode).toBe(200);
    const empty = await h.call({
      method: "POST",
      url: `/api/v1/channels/${c}/join`,
      headers: { ...lone.headers, "content-type": "application/json" },
    });
    expect(empty.statusCode).toBe(200);
    const bad = await channel("jn-body-d");
    const res = await join(lone, bad, { x: 1 });
    expect(res.statusCode).toBe(400);
    expect(jsonOf(res).error.code).toBe("validation_failed");
    expect(await rowOf(bad, lone.id)).toBeUndefined();
  });

  it("stores the settings that come with a join (Undo of a leave), and refuses a bad level or key", async () => {
    const id = await channel("jn-settings");
    const res = await join(member, id, {
      settings: { notificationLevel: "all", isMuted: true, isStarred: true },
    });
    expect(res.statusCode).toBe(200);
    expect(await rowOf(id, member.id)).toMatchObject({
      notification_level: "all",
      is_muted: true,
      is_starred: true,
    });
    const partial = await channel("jn-settings-2");
    await join(lone, partial, { settings: { isStarred: true } });
    expect(await rowOf(partial, lone.id)).toMatchObject({
      notification_level: null,
      is_muted: false,
      is_starred: true,
    });
    const other = await channel("jn-settings-3");
    for (const settings of [{ notificationLevel: "loud" }, { x: 1 }]) {
      expect((await join(lone, other, { settings })).statusCode).toBe(400);
    }
    expect(await rowOf(other, lone.id)).toBeUndefined();
  });

  it("ignores the settings when the person is already a member", async () => {
    const id = await channel("jn-settings-member", {
      members: [admin.id, member.id],
    });
    await join(member, id, { settings: { isMuted: true } });
    expect(await rowOf(id, member.id)).toMatchObject({ is_muted: false });
  });
});

describe("add, R11", () => {
  it("lets a Member add people to a public and to a private channel", async () => {
    const a = await bystander(h, "ad-a");
    const b = await bystander(h, "ad-b");
    const pub = await channel("ad-public", { members: [admin.id, member.id] });
    const priv = await channel("ad-private", {
      isPrivate: true,
      members: [admin.id, member.id],
    });
    const before = changes.length;
    const res = await add(member, pub, [a]);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res)).toEqual({ added: [a], alreadyMembers: [] });
    expect(await rowOf(pub, a)).toMatchObject({
      notification_level: null,
      is_muted: false,
      is_starred: false,
    });
    expect((await add(member, priv, [b])).statusCode).toBe(200);
    expect(changes.length - before).toBe(2);
    expect(changes.at(-1)).toMatchObject({
      type: "members_added",
      userIds: [b],
    });
  });

  it("skips people who are already members and answers in the order of the request without repeats", async () => {
    const a = await bystander(h, "ord-a");
    const b = await bystander(h, "ord-b");
    const id = await channel("ad-order", { members: [admin.id, member.id, b] });
    const before = changes.length;
    const res = await add(admin, id, [a, b, a, member.id]);
    expect(jsonOf(res)).toEqual({ added: [a], alreadyMembers: [b, member.id] });
    expect(await memberRows(h.sql, id)).toHaveLength(4);
    const again = await add(admin, id, [a]);
    expect(jsonOf(again)).toEqual({ added: [], alreadyMembers: [a] });
    expect(changes.length - before).toBe(1);
  });

  it("refuses the whole request with 400 invalid_member for an unknown, another-workspace or deactivated id, also for one who is already a member", async () => {
    const otherWorkspace = crypto.randomUUID();
    await h.sql`insert into workspaces (id, name, created_at) values (${otherWorkspace}, 'Other', now())`;
    const foreign = await bystander(h, "ad-foreign", {
      workspace_id: otherWorkspace,
    });
    const gone = await bystander(h, "ad-gone", { status: "deactivated" });
    const good = await bystander(h, "ad-good");
    const id = await channel("ad-invalid", { members: [admin.id, gone] });
    for (const ids of [
      ["01930b7e-7a53-7c2e-9f1a-00000000dead"],
      [foreign],
      [gone],
      [good, gone],
    ]) {
      const res = await add(admin, id, ids);
      expect(res.statusCode).toBe(400);
      expect(jsonOf(res).error.code).toBe("invalid_member");
    }
    expect(await rowOf(id, good)).toBeUndefined();
  });

  it("refuses a non-member of a public channel with 403, of a private one with 404, an archived channel with 409, and a DM with 404", async () => {
    const a = await bystander(h, "ad-x");
    const pub = await channel("ad-p");
    const priv = await channel("ad-q", { isPrivate: true });
    const old = await channel("ad-o", { archived: true });
    const dm = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [member.id, lone.id],
      created_by: admin.id,
    });
    expect((await add(lone, pub, [a])).statusCode).toBe(403);
    expect((await add(lone, priv, [a])).statusCode).toBe(404);
    const archived = await add(admin, old, [a]);
    expect(archived.statusCode).toBe(409);
    expect(jsonOf(archived).error.code).toBe("channel_archived");
    expect((await add(admin, dm, [a])).statusCode).toBe(404);
    expect(await rowOf(pub, a)).toBeUndefined();
  });

  it("refuses an empty list, 201 ids, an upper-case id and another key", async () => {
    const id = await channel("ad-shape");
    const ids = (n: number) =>
      Array.from(
        { length: n },
        (_, i) => `01930b7e-7a53-7c2e-9f1a-${String(i).padStart(12, "0")}`,
      );
    for (const userIds of [[], ids(201), [ids(1)[0]!.toUpperCase()]]) {
      expect((await add(admin, id, userIds)).statusCode).toBe(400);
    }
    const res = await send(h, admin, "POST", `/api/v1/channels/${id}/members`, {
      userIds: ids(1),
      x: 1,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns a person to a private channel they left only by being added, with the defaults", async () => {
    const id = await channel("ad-return", {
      isPrivate: true,
      members: [admin.id, member.id],
    });
    await h.sql`update conversation_members set notification_level = 'none', is_muted = true where conversation_id = ${id} and user_id = ${member.id}`;
    await h.sql`delete from conversation_members where conversation_id = ${id} and user_id = ${member.id}`;
    expect((await join(member, id)).statusCode).toBe(404);
    expect((await add(admin, id, [member.id])).statusCode).toBe(200);
    expect(await rowOf(id, member.id)).toMatchObject({
      notification_level: null,
      is_muted: false,
      is_starred: false,
    });
  });
});
