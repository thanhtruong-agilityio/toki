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
  admin = await person(h, "s-admin", "admin");
  member = await person(h, "s-member");
  lone = await person(h, "s-lone");
});
afterAll(async () => {
  await h?.close();
});

async function channel(
  name: string,
  options: { isPrivate?: boolean; archived?: boolean; general?: boolean } = {},
) {
  const id = await insertConversation(h.sql, {
    workspace_id: h.workspaceId,
    created_by: admin.id,
    name,
    is_private: options.isPrivate ?? false,
    is_general: options.general ?? false,
    archived_at: options.archived ? new Date("2026-02-01T00:00:00Z") : null,
  });
  for (const user_id of [admin.id, member.id]) {
    await insertConversationMember(h.sql, {
      conversation_id: id,
      user_id,
      workspace_id: h.workspaceId,
    });
  }
  return id;
}
const save = (who: Person, id: string, body: unknown) =>
  send(h, who, "PATCH", `/api/v1/conversations/${id}/settings`, body);
const rowOf = async (id: string, userId: string) =>
  (await memberRows(h.sql, id)).find((r) => r.user_id === userId)!;

describe("settings, R22", () => {
  it("saves the three values of a channel member, answers the level that applies and records one change", async () => {
    const id = await channel("st-channel");
    const before = changes.length;
    const res = await save(member, id, {
      notificationLevel: "all",
      isMuted: true,
      isStarred: true,
    });
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res)).toEqual({
      settings: { notificationLevel: "all", isMuted: true, isStarred: true },
      changed: true,
    });
    expect(await rowOf(id, member.id)).toMatchObject({
      notification_level: "all",
      is_muted: true,
      is_starred: true,
    });
    expect(changes.length - before).toBe(1);
    expect(changes.at(-1)).toMatchObject({
      type: "settings_changed",
      actorId: member.id,
      userIds: [member.id],
    });
  });

  it("changes only the caller's own row", async () => {
    const id = await channel("st-own");
    await save(member, id, { isStarred: true, notificationLevel: "none" });
    expect(await rowOf(id, admin.id)).toMatchObject({
      notification_level: null,
      is_starred: false,
    });
  });

  it("works for a direct message and a group, with the default level all", async () => {
    const dm = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [admin.id, member.id],
      created_by: admin.id,
    });
    const res = await save(member, dm, { isMuted: true });
    expect(jsonOf(res)).toEqual({
      settings: { notificationLevel: "all", isMuted: true, isStarred: false },
      changed: true,
    });
    const group = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [admin.id, member.id, lone.id],
      created_by: admin.id,
    });
    const g = await save(lone, group, { notificationLevel: "none" });
    expect(jsonOf(g).settings.notificationLevel).toBe("none");
    expect(await rowOf(group, lone.id)).toMatchObject({
      notification_level: "none",
    });
  });

  it("a request whose values equal what applies writes nothing: the stored null level stays null", async () => {
    const id = await channel("st-default");
    const before = changes.length;
    const res = await save(member, id, { notificationLevel: "mentions" });
    expect(jsonOf(res)).toEqual({
      settings: {
        notificationLevel: "mentions",
        isMuted: false,
        isStarred: false,
      },
      changed: false,
    });
    expect((await rowOf(id, member.id)).notification_level).toBeNull();
    expect(changes.length).toBe(before);
  });

  it("saving the star with the default level stores the star and leaves the level null", async () => {
    const id = await channel("st-mixed");
    const res = await save(member, id, {
      notificationLevel: "mentions",
      isStarred: true,
    });
    expect(jsonOf(res).changed).toBe(true);
    expect(await rowOf(id, member.id)).toMatchObject({
      notification_level: null,
      is_starred: true,
    });
  });

  it("saving only the star leaves the level and mute as they were", async () => {
    const id = await channel("st-only-star");
    await save(member, id, { notificationLevel: "none", isMuted: true });
    await save(member, id, { isStarred: true });
    expect(await rowOf(id, member.id)).toMatchObject({
      notification_level: "none",
      is_muted: true,
      is_starred: true,
    });
  });

  it("is allowed in an archived channel and in #general", async () => {
    const old = await channel("st-old", { archived: true });
    expect((await save(member, old, { isStarred: true })).statusCode).toBe(200);
    const general = await channel("general", { general: true });
    expect((await save(member, general, { isMuted: true })).statusCode).toBe(
      200,
    );
  });

  it("refuses a non-member of a public channel with 403, and 404 for a private channel, a DM and an unknown id, all with one body", async () => {
    const pub = await channel("st-pub");
    const priv = await channel("st-priv", { isPrivate: true });
    const dm = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [admin.id, member.id],
      created_by: admin.id,
    }).catch(async () => {
      // The pair has a DM from the test above; read its id.
      const [row] = await h.sql<
        { id: string }[]
      >`select id from conversations where kind = 'dm' limit 1`;
      return row!.id;
    });
    const forbidden = await save(lone, pub, { isMuted: true });
    expect(forbidden.statusCode).toBe(403);
    expect(jsonOf(forbidden).error.code).toBe("forbidden");
    const bodies = new Set<string>();
    for (const id of [priv, dm, "01930b7e-7a53-7c2e-9f1a-00000000dead"]) {
      const res = await save(lone, id, { isMuted: true });
      expect(res.statusCode).toBe(404);
      bodies.add(res.body);
    }
    expect(bodies.size).toBe(1);
    expect(await memberRows(h.sql, pub)).toHaveLength(2);
  });

  it("refuses an empty body, an unknown key and a level of loud with 400", async () => {
    const id = await channel("st-bad");
    for (const body of [
      {},
      { x: 1 },
      { notificationLevel: "loud" },
      { isMuted: "no" },
      undefined,
    ]) {
      const res = await save(member, id, body);
      expect(res.statusCode).toBe(400);
      expect(jsonOf(res).error.code).toBe("validation_failed");
    }
  });
});
