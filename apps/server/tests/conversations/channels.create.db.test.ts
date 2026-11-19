import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import type { Change } from "../../src/modules/conversations/changes.js";
import {
  bystander,
  conversationRows,
  jsonOf,
  memberRows,
  newChannelId,
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
  admin = await person(h, "admin1", "admin");
  admin2 = await person(h, "admin2", "admin");
  member = await person(h, "member1");
});
afterAll(async () => {
  await h?.close();
});

const create = (who: Person, body: unknown) =>
  send(h, who, "POST", "/api/v1/channels", body);
const rowsOf = async (name: string) =>
  conversationRows(h.sql, `name = '${name}'`);

describe("create, R3 and R4", () => {
  it("creates a public channel with the actor as its only member", async () => {
    const id = newChannelId();
    const res = await create(admin, { id, name: "launch" });
    expect(res.statusCode).toBe(201);
    expect(jsonOf(res).channel).toEqual({
      id,
      name: "launch",
      topic: null,
      isPrivate: false,
      isGeneral: false,
      archived: false,
      memberCount: 1,
      isMember: true,
      description: null,
      createdBy: admin.id,
      createdAt: new Date(h.clock.now()).toISOString(),
    });
    const [row] = await rowsOf("launch");
    expect(row).toMatchObject({
      id,
      workspace_id: h.workspaceId,
      kind: "channel",
      is_private: false,
      is_general: false,
      description: null,
      created_by: admin.id,
      archived_at: null,
    });
    const members = await memberRows(h.sql, id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      user_id: admin.id,
      workspace_id: h.workspaceId,
      notification_level: null,
      is_muted: false,
      is_starred: false,
    });
  });

  it("creates a private channel with a topic and the chosen people, and nobody else", async () => {
    const a = await bystander(h, "p-a");
    const b = await bystander(h, "p-b");
    await bystander(h, "p-outsider");
    const id = newChannelId();
    const res = await create(admin, {
      id,
      name: "secret-plans",
      isPrivate: true,
      topic: "  Plans for Q3  ",
      memberIds: [a, b, admin.id, a],
    });
    expect(res.statusCode).toBe(201);
    expect(jsonOf(res).channel).toMatchObject({
      isPrivate: true,
      topic: "Plans for Q3",
      memberCount: 3,
    });
    const members = await memberRows(h.sql, id);
    expect(members.map((m) => m.user_id).sort()).toEqual(
      [admin.id, a, b].sort(),
    );
  });

  it.each([
    ["a valid body", { id: "0", name: "x" }],
    ["an invalid body", { nonsense: true }],
    ["an empty body", undefined],
  ])("refuses a Member with 403 and a %s", async (_label, body) => {
    const payload =
      body && "id" in body ? { id: newChannelId(), name: "nope" } : body;
    const res = await create(member, payload);
    expect(res.statusCode).toBe(403);
    expect(jsonOf(res).error.code).toBe("forbidden");
    expect(await rowsOf("nope")).toHaveLength(0);
  });

  it.each([
    ["81 characters", "a".repeat(81)],
    ["an empty name", ""],
    ["Q&A Team!", "Q&A Team!"],
    ["QA", "QA"],
    ["qa team", "qa team"],
  ])("refuses the name %s with 400 and converts nothing", async (_l, name) => {
    const before = (await conversationRows(h.sql)).length;
    const res = await create(admin, { id: newChannelId(), name });
    expect(res.statusCode).toBe(400);
    expect(jsonOf(res).error.code).toBe("validation_failed");
    expect((await conversationRows(h.sql)).length).toBe(before);
  });

  it("accepts a name of 80 characters", async () => {
    const res = await create(admin, {
      id: newChannelId(),
      name: "b".repeat(80),
    });
    expect(res.statusCode).toBe(201);
  });

  it("refuses a version-4 id and an upper-case id", async () => {
    const v4 = "7d1c3b2a-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
    for (const id of [v4, newChannelId().toUpperCase()]) {
      const res = await create(admin, { id, name: "wrong-id" });
      expect(res.statusCode).toBe(400);
    }
    expect(await rowsOf("wrong-id")).toHaveLength(0);
  });

  it("takes a topic of 250 and refuses 251; white space only is stored as null", async () => {
    const ok = await create(admin, {
      id: newChannelId(),
      name: "topic-250",
      topic: "t".repeat(250),
    });
    expect(ok.statusCode).toBe(201);
    const bad = await create(admin, {
      id: newChannelId(),
      name: "topic-251",
      topic: "t".repeat(251),
    });
    expect(bad.statusCode).toBe(400);
    const blank = await create(admin, {
      id: newChannelId(),
      name: "topic-blank",
      topic: "   ",
    });
    expect(blank.statusCode).toBe(201);
    expect(jsonOf(blank).channel.topic).toBe(null);
    expect((await rowsOf("topic-blank"))[0]!.topic).toBe(null);
  });

  it("refuses the name general with 409 whether or not #general exists", async () => {
    const res = await create(admin, { id: newChannelId(), name: "general" });
    expect(res.statusCode).toBe(409);
    expect(jsonOf(res).error.code).toBe("channel_name_taken");
    expect(await rowsOf("general")).toHaveLength(0);
  });

  it("answers 400 invalid_member for an unknown, another-workspace and deactivated id, and creates nothing", async () => {
    const otherWorkspace = crypto.randomUUID();
    await h.sql`insert into workspaces (id, name, created_at) values (${otherWorkspace}, 'Other', now())`;
    const foreign = await bystander(h, "foreign", {
      workspace_id: otherWorkspace,
    });
    const gone = await bystander(h, "gone", { status: "deactivated" });
    const unknown = newChannelId();
    for (const memberIds of [[unknown], [foreign], [gone]]) {
      const res = await create(admin, {
        id: newChannelId(),
        name: "no-such-people",
        memberIds,
      });
      expect(res.statusCode).toBe(400);
      expect(jsonOf(res).error.code).toBe("invalid_member");
      expect(jsonOf(res).error.details).toBeUndefined();
    }
    expect(await rowsOf("no-such-people")).toHaveLength(0);
  });
});

describe("create, a repeat and a name in use, R5", () => {
  it("the same body twice is one channel, one set of rows and one recorded change", async () => {
    const a = await bystander(h, "rep-a");
    const body = { id: newChannelId(), name: "repeat-me", memberIds: [a] };
    const before = changes.length;
    const first = await create(admin, body);
    const second = await create(admin, body);
    expect([first.statusCode, second.statusCode]).toEqual([201, 200]);
    expect(jsonOf(second).channel.id).toBe(body.id);
    expect(await rowsOf("repeat-me")).toHaveLength(1);
    expect(await memberRows(h.sql, body.id)).toHaveLength(2);
    expect(changes.length - before).toBe(1);
    expect(changes.at(-1)).toMatchObject({
      type: "channel_created",
      actorId: admin.id,
      conversationId: body.id,
    });
  });

  it("the same id with another name is 409 channel_id_in_use with no details", async () => {
    const id = newChannelId();
    await create(admin, { id, name: "first-name" });
    const res = await create(admin, { id, name: "second-name" });
    expect(res.statusCode).toBe(409);
    expect(jsonOf(res).error.code).toBe("channel_id_in_use");
    expect(jsonOf(res).error.details).toBeUndefined();
    expect(await rowsOf("second-name")).toHaveLength(0);
  });

  it("the same id and name with other memberIds is 200 and adds nobody", async () => {
    const other = await bystander(h, "late-guest");
    const id = newChannelId();
    await create(admin, { id, name: "same-name" });
    const res = await create(admin, {
      id,
      name: "same-name",
      memberIds: [other],
    });
    expect(res.statusCode).toBe(200);
    expect(await memberRows(h.sql, id)).toHaveLength(1);
  });

  it("a retry after the topic was edited still gets 200", async () => {
    const id = newChannelId();
    const body = { id, name: "edited-later", topic: "one" };
    await create(admin, body);
    await h.sql`update conversations set topic = 'two' where id = ${id}`;
    const res = await create(admin, body);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res).channel.topic).toBe("two");
  });

  it("an Admin who left the channel they created gets 409 channel_id_in_use, with the same body or another, and no channel content", async () => {
    const id = newChannelId();
    const body = { id, name: "left-behind", isPrivate: true, topic: "hush" };
    await create(admin, body);
    await h.sql`delete from conversation_members where conversation_id = ${id} and user_id = ${admin.id}`;
    for (const again of [body, { ...body, name: "other-name" }]) {
      const res = await create(admin, again);
      expect(res.statusCode).toBe(409);
      expect(jsonOf(res).error.code).toBe("channel_id_in_use");
      expect(res.body).not.toContain("hush");
      expect(res.body).not.toContain("left-behind");
    }
  });

  it("another Admin using the same id gets channel_id_in_use", async () => {
    const id = newChannelId();
    await create(admin, { id, name: "mine" });
    const res = await create(admin2, { id, name: "mine" });
    expect(res.statusCode).toBe(409);
    expect(jsonOf(res).error.code).toBe("channel_id_in_use");
  });

  it("a name used by an archived channel is channel_name_taken", async () => {
    const id = newChannelId();
    await create(admin, { id, name: "retired" });
    await h.sql`update conversations set archived_at = now() where id = ${id}`;
    const res = await create(admin2, { id: newChannelId(), name: "retired" });
    expect(res.statusCode).toBe(409);
    expect(jsonOf(res).error.code).toBe("channel_name_taken");
  });

  it("two Admins creating the same name at the same moment leave one row: 201 and 409 channel_name_taken", async () => {
    const [a, b] = await Promise.all([
      create(admin, { id: newChannelId(), name: "release" }),
      create(admin2, { id: newChannelId(), name: "release" }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    const loser = a.statusCode === 409 ? a : b;
    expect(jsonOf(loser).error.code).toBe("channel_name_taken");
    expect(await rowsOf("release")).toHaveLength(1);
  });

  it("two requests with one id and one body at the same moment leave one row: 201 and 200", async () => {
    const body = { id: newChannelId(), name: "double-press" };
    const [a, b] = await Promise.all([
      create(admin, body),
      create(admin, body),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
    expect(await rowsOf("double-press")).toHaveLength(1);
    expect(await memberRows(h.sql, body.id)).toHaveLength(1);
  });
});
