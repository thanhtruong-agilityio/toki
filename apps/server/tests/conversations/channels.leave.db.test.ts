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
let admin2: Person;
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
  admin = await person(h, "l-admin", "admin");
  admin2 = await person(h, "l-admin2", "admin");
  member = await person(h, "l-member");
  lone = await person(h, "l-lone");
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
// One #general per workspace.
let generalId: string | undefined;
const general = async () =>
  (generalId ??= await channel("general", {
    general: true,
    members: [admin.id, member.id],
  }));
const leave = (who: Person, id: string) =>
  send(h, who, "POST", `/api/v1/channels/${id}/leave`);
const remove = (who: Person, id: string, userId: string) =>
  send(h, who, "DELETE", `/api/v1/channels/${id}/members/${userId}`);
const archivedAt = async (id: string) =>
  (await h.sql`select archived_at from conversations where id = ${id}`)[0]!
    .archived_at;
const rowOf = async (id: string, userId: string) =>
  (await memberRows(h.sql, id)).find((r) => r.user_id === userId);

describe("leave, R12", () => {
  it("lets a member leave a public channel and records it once; a join with the kept values is Undo", async () => {
    const id = await channel("lv-public");
    await h.sql`update conversation_members set notification_level = 'all', is_muted = true, is_starred = true where conversation_id = ${id} and user_id = ${member.id}`;
    const before = changes.length;
    const res = await leave(member, id);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res)).toEqual({ changed: true, archived: false });
    expect(await rowOf(id, member.id)).toBeUndefined();
    expect(changes.length - before).toBe(1);
    expect(changes.at(-1)).toMatchObject({
      type: "member_left",
      userIds: [member.id],
    });
    const back = await send(h, member, "POST", `/api/v1/channels/${id}/join`, {
      settings: { notificationLevel: "all", isMuted: true, isStarred: true },
    });
    expect(back.statusCode).toBe(200);
    expect(await rowOf(id, member.id)).toMatchObject({
      notification_level: "all",
      is_muted: true,
      is_starred: true,
    });
  });

  it("a repeat is harmless: 200 changed false, nothing written, nothing recorded", async () => {
    const id = await channel("lv-twice");
    await leave(member, id);
    const before = changes.length;
    const res = await leave(member, id);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res)).toEqual({ changed: false, archived: false });
    expect(changes.length).toBe(before);
  });

  it("refuses #general with 409 to a member and answers changed false to a person outside it", async () => {
    const id = await general();
    for (const who of [member, admin]) {
      const res = await leave(who, id);
      expect(res.statusCode).toBe(409);
      expect(jsonOf(res).error.code).toBe("channel_is_general");
    }
    const outside = await leave(lone, id);
    expect(outside.statusCode).toBe(200);
    expect(jsonOf(outside)).toEqual({ changed: false, archived: false });
    expect(await memberRows(h.sql, id)).toHaveLength(2);
  });

  it("archives a private channel when its last member leaves, records member_left then channel_archived, and keeps nothing else", async () => {
    const id = await channel("lv-last-private", {
      isPrivate: true,
      members: [member.id],
    });
    const before = changes.length;
    const res = await leave(member, id);
    expect(jsonOf(res)).toEqual({ changed: true, archived: true });
    expect(await archivedAt(id)).not.toBeNull();
    expect(await memberRows(h.sql, id)).toHaveLength(0);
    expect(changes.slice(before).map((c) => c.type)).toEqual([
      "member_left",
      "channel_archived",
    ]);
  });

  it("does not archive a private channel while a member is left", async () => {
    const id = await channel("lv-private", { isPrivate: true });
    const res = await leave(member, id);
    expect(jsonOf(res)).toEqual({ changed: true, archived: false });
    expect(await archivedAt(id)).toBeNull();
  });

  it("leaves a public channel active when its last member leaves", async () => {
    const id = await channel("lv-last-public", { members: [member.id] });
    const res = await leave(member, id);
    expect(jsonOf(res)).toEqual({ changed: true, archived: false });
    expect(await archivedAt(id)).toBeNull();
    expect(await memberRows(h.sql, id)).toHaveLength(0);
  });

  it("archives a private channel when the last active member leaves and keeps the row of the deactivated one", async () => {
    const gone = await bystander(h, "lv-gone", { status: "deactivated" });
    const id = await channel("lv-deactivated", {
      isPrivate: true,
      members: [member.id, gone],
    });
    const res = await leave(member, id);
    expect(jsonOf(res)).toEqual({ changed: true, archived: true });
    expect(await archivedAt(id)).not.toBeNull();
    expect(await rowOf(id, gone)).toBeDefined();
  });

  it("answers 404 for a private channel of which the person is not a member and for a DM", async () => {
    const priv = await channel("lv-hidden", {
      isPrivate: true,
      members: [admin.id],
    });
    const dm = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [member.id, lone.id],
      created_by: member.id,
    });
    expect((await leave(lone, priv)).statusCode).toBe(404);
    expect((await leave(member, dm)).statusCode).toBe(404);
  });

  it("allows leaving an archived channel, archiving nothing more; a non-member gets changed false and the state", async () => {
    const id = await channel("lv-old", {
      archived: true,
      members: [member.id, admin.id],
    });
    const before = changes.length;
    const res = await leave(member, id);
    expect(jsonOf(res)).toEqual({ changed: true, archived: true });
    expect(changes.slice(before).map((c) => c.type)).toEqual(["member_left"]);
    const outside = await leave(lone, id);
    expect(jsonOf(outside)).toEqual({ changed: false, archived: true });
  });
});

describe("remove, R13", () => {
  it("lets an Admin who is a member remove a person and records it", async () => {
    const id = await channel("rm-ok");
    const before = changes.length;
    const res = await remove(admin, id, member.id);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res)).toEqual({ changed: true });
    expect(await rowOf(id, member.id)).toBeUndefined();
    expect(changes.length - before).toBe(1);
    expect(changes.at(-1)).toMatchObject({
      type: "member_removed",
      userIds: [member.id],
    });
  });

  it("refuses a Member with 403", async () => {
    const id = await channel("rm-member", {
      members: [admin.id, member.id, lone.id],
    });
    const res = await remove(member, id, lone.id);
    expect(res.statusCode).toBe(403);
    expect(jsonOf(res).error.code).toBe("forbidden");
    expect(await rowOf(id, lone.id)).toBeDefined();
  });

  it("refuses an Admin who is not a member: 403 in a public channel, 404 in a private one (TS-095)", async () => {
    const pub = await channel("rm-out-pub");
    const priv = await channel("rm-out-priv", { isPrivate: true });
    expect((await remove(admin2, pub, member.id)).statusCode).toBe(403);
    expect((await remove(admin2, priv, member.id)).statusCode).toBe(404);
    expect(await rowOf(pub, member.id)).toBeDefined();
  });

  it("refuses #general with 409 and removing oneself with 409 self_target", async () => {
    const generalChannel = await general();
    const a = await remove(admin, generalChannel, member.id);
    expect(a.statusCode).toBe(409);
    expect(jsonOf(a).error.code).toBe("channel_is_general");
    const id = await channel("rm-self");
    const b = await remove(admin, id, admin.id);
    expect(b.statusCode).toBe(409);
    expect(jsonOf(b).error.code).toBe("self_target");
    expect(await rowOf(id, admin.id)).toBeDefined();
  });

  it("answers changed false for a person who is not a member and for one who does not exist", async () => {
    const id = await channel("rm-absent");
    const before = changes.length;
    for (const target of [lone.id, "01930b7e-7a53-7c2e-9f1a-00000000dead"]) {
      const res = await remove(admin, id, target);
      expect(res.statusCode).toBe(200);
      expect(jsonOf(res)).toEqual({ changed: false });
    }
    expect(changes.length).toBe(before);
  });

  it("refuses an archived channel with 409, a DM with 404 and a bad person id with 400", async () => {
    const old = await channel("rm-old", { archived: true });
    const res = await remove(admin, old, member.id);
    expect(res.statusCode).toBe(409);
    expect(jsonOf(res).error.code).toBe("channel_archived");
    const dm = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [admin.id, lone.id],
      created_by: admin.id,
    });
    expect((await remove(admin, dm, lone.id)).statusCode).toBe(404);
    const id = await channel("rm-bad");
    expect((await remove(admin, id, "nope")).statusCode).toBe(400);
  });
});
