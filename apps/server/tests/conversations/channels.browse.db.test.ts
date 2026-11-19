import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import {
  insertConversation,
  insertConversationMember,
  insertDirectConversation,
} from "../test-rows.js";
import {
  bystander,
  jsonOf,
  person,
  send,
  type Json,
  type Person,
} from "./channel-helpers.js";

let h: Harness;
let admin: Person;
let outsiderAdmin: Person;
let member: Person;
let lone: Person;
beforeAll(async () => {
  h = await createHarness();
  admin = await person(h, "b-admin", "admin");
  outsiderAdmin = await person(h, "b-admin-out", "admin");
  member = await person(h, "b-member");
  lone = await person(h, "b-lone");
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
    topic?: string;
    description?: string;
  } = {},
) {
  const id = await insertConversation(h.sql, {
    workspace_id: h.workspaceId,
    created_by: admin.id,
    name,
    is_private: options.isPrivate ?? false,
    archived_at: options.archived ? new Date("2026-02-01T00:00:00Z") : null,
    topic: options.topic ?? null,
    description: options.description ?? null,
  });
  for (const user_id of options.members ?? []) {
    await insertConversationMember(h.sql, {
      conversation_id: id,
      user_id,
      workspace_id: h.workspaceId,
    });
  }
  return id;
}
const browse = (who: Person, query = "") =>
  send(h, who, "GET", `/api/v1/channels${query}`);
const names = (res: { body: string }) =>
  (jsonOf(res).channels as Json[]).map((c) => c.name);

describe("browse, R6", () => {
  it("shows public channels, archived ones included, and the private channels the person is in", async () => {
    await channel("pub-open");
    await channel("pub-old", { archived: true });
    await channel("priv-mine", { isPrivate: true, members: [member.id] });
    await channel("priv-other", { isPrivate: true, members: [admin.id] });
    const res = await browse(member, "?search=pub-");
    expect(res.statusCode).toBe(200);
    expect(names(res)).toEqual(["pub-old", "pub-open"]);
    const mine = await browse(member, "?search=priv-");
    expect(names(mine)).toEqual(["priv-mine"]);
    // An Admin who is not in a private channel does not see it (concern 3).
    const out = await browse(outsiderAdmin, "?search=priv-");
    expect(names(out)).toEqual([]);
    const inside = await browse(admin, "?search=priv-");
    expect(names(inside)).toEqual(["priv-other"]);
  });

  it("returns the summary fields, archived and isMember included", async () => {
    await channel("shape-a", { archived: true, members: [member.id] });
    const [c] = jsonOf(await browse(member, "?search=shape-a")).channels;
    expect(Object.keys(c).sort()).toEqual(
      [
        "archived",
        "id",
        "isGeneral",
        "isMember",
        "isPrivate",
        "memberCount",
        "name",
        "topic",
      ].sort(),
    );
    expect(c).toMatchObject({
      name: "shape-a",
      archived: true,
      isMember: true,
      memberCount: 1,
    });
    const [again] = jsonOf(await browse(lone, "?search=shape-a")).channels;
    expect(again.isMember).toBe(false);
  });

  it("counts members without the deactivated ones", async () => {
    const gone = await bystander(h, "b-gone", { status: "deactivated" });
    const stay = await bystander(h, "b-stay");
    await channel("count-me", { members: [gone, stay, member.id] });
    const [c] = jsonOf(await browse(member, "?search=count-me")).channels;
    expect(c.memberCount).toBe(2);
  });

  it("counts members without the deactivated ones in the details too", async () => {
    const gone = await bystander(h, "b-gone-2", { status: "deactivated" });
    const id = await channel("count-details", { members: [gone, member.id] });
    const res = await send(h, member, "GET", `/api/v1/channels/${id}`);
    expect(jsonOf(res).channel.memberCount).toBe(1);
  });

  it("orders by bytes: digits, then a, a-1, b", async () => {
    for (const n of ["ord-b", "ord-a-1", "ord-a", "ord-10", "ord-9"]) {
      await channel(n);
    }
    expect(names(await browse(member, "?search=ord-"))).toEqual([
      "ord-10",
      "ord-9",
      "ord-a",
      "ord-a-1",
      "ord-b",
    ]);
  });

  it("reads every channel once across pages of 50 (120 channels)", async () => {
    const want: string[] = [];
    for (let i = 0; i < 120; i += 1) {
      const name = `page-${String(i).padStart(3, "0")}`;
      want.push(name);
      await channel(name);
    }
    const got: string[] = [];
    let cursor: string | null = null;
    let requests = 0;
    do {
      const res = await browse(
        member,
        `?search=page-&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      expect(res.statusCode).toBe(200);
      got.push(...names(res));
      cursor = jsonOf(res).nextCursor;
      requests += 1;
    } while (cursor);
    expect(requests).toBe(3);
    expect(got).toEqual(want);
  });

  it("defaults the page to 50", async () => {
    const res = await browse(member, "?search=page-");
    expect(names(res)).toHaveLength(50);
    expect(jsonOf(res).nextCursor).not.toBeNull();
  });

  it("searches the name, ignoring case, and takes % and _ as plain characters", async () => {
    await channel("search-launch");
    expect(names(await browse(member, "?search=LAUNCH"))).toContain(
      "search-launch",
    );
    expect(names(await browse(member, "?search=%25"))).toEqual([]);
    expect(names(await browse(member, "?search=_"))).toEqual([]);
    expect(names(await browse(member, "?search=search-l_unch"))).toEqual([]);
  });

  it("refuses a bad query with 400", async () => {
    for (const q of [
      `?search=${"a".repeat(81)}`,
      "?limit=0",
      "?limit=101",
      "?limit=x",
      "?cursor=%25%25%25",
      "?other=1",
    ]) {
      const res = await browse(member, q);
      expect(res.statusCode, q).toBe(400);
      expect(jsonOf(res).error.code).toBe("validation_failed");
    }
  });
});

describe("details, R7", () => {
  it("gives a member the detail, of an archived channel too", async () => {
    const id = await channel("det-member", {
      members: [member.id],
      topic: "t",
      description: "d",
      archived: true,
    });
    const res = await send(h, member, "GET", `/api/v1/channels/${id}`);
    expect(res.statusCode).toBe(200);
    expect(jsonOf(res).channel).toMatchObject({
      id,
      name: "det-member",
      topic: "t",
      description: "d",
      createdBy: admin.id,
      archived: true,
      isMember: true,
      memberCount: 1,
    });
    expect(typeof jsonOf(res).channel.createdAt).toBe("string");
  });

  it("gives a person outside a public channel the summary and no description, creator or time", async () => {
    const id = await channel("det-public", {
      description: "secret",
      topic: "t",
    });
    const res = await send(h, lone, "GET", `/api/v1/channels/${id}`);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(jsonOf(res).channel).sort()).toEqual(
      [
        "archived",
        "id",
        "isGeneral",
        "isMember",
        "isPrivate",
        "memberCount",
        "name",
        "topic",
      ].sort(),
    );
    expect(jsonOf(res).channel.isMember).toBe(false);
    expect(res.body).not.toContain("secret");
  });

  it("answers 404 for a private channel of which the person is not a member, an unknown id and a DM", async () => {
    const priv = await channel("det-private", {
      isPrivate: true,
      members: [admin.id],
    });
    const dm = await insertDirectConversation(h.sql, {
      workspace_id: h.workspaceId,
      user_ids: [admin.id, member.id],
      created_by: admin.id,
    });
    const unknown = "01930b7e-7a53-7c2e-9f1a-00000000dead";
    const bodies = new Set<string>();
    for (const [who, id] of [
      [member, priv],
      [outsiderAdmin, priv],
      [member, unknown],
      [member, dm],
    ] as const) {
      const res = await send(h, who, "GET", `/api/v1/channels/${id}`);
      expect(res.statusCode).toBe(404);
      expect(jsonOf(res).error.code).toBe("not_found");
      bodies.add(res.body);
    }
    // Hidden and missing answer alike.
    expect(bodies.size).toBe(1);
  });

  it("answers 400 for an id that is not a uuid", async () => {
    const res = await send(h, member, "GET", "/api/v1/channels/not-an-id");
    expect(res.statusCode).toBe(400);
  });
});

describe("members, R8", () => {
  it("lists every row, deactivated people included, 100 then 20 for 120 members, each once", async () => {
    const people: string[] = [];
    for (let i = 0; i < 120; i += 1) {
      people.push(
        await bystander(h, `m-${i}`, i === 7 ? { status: "deactivated" } : {}),
      );
    }
    const id = await channel("mem-120");
    for (const [i, user_id] of people.entries()) {
      await insertConversationMember(h.sql, {
        conversation_id: id,
        user_id,
        workspace_id: h.workspaceId,
        // Ties on the time are ordered by user id.
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, Math.floor(i / 3))),
      });
    }
    await insertConversationMember(h.sql, {
      conversation_id: id,
      user_id: member.id,
      workspace_id: h.workspaceId,
      created_at: new Date("2026-03-01T00:00:00Z"),
    });
    const seen: Json[] = [];
    let cursor: string | null = null;
    let requests = 0;
    do {
      const res = await send(
        h,
        member,
        "GET",
        `/api/v1/channels/${id}/members?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      expect(res.statusCode).toBe(200);
      seen.push(...jsonOf(res).members);
      cursor = jsonOf(res).nextCursor;
      requests += 1;
    } while (cursor);
    expect(requests).toBe(2);
    expect(seen).toHaveLength(121);
    expect(new Set(seen.map((m) => m.userId)).size).toBe(121);
    const key = (m: Json) => `${m.joinedAt}|${m.userId}`;
    expect(seen.map(key)).toEqual([...seen.map(key)].sort());
    expect(Object.keys(seen[0]!).sort()).toEqual(["joinedAt", "userId"]);
    expect(seen.map((m) => m.userId)).toContain(people[7]);
  });

  it("is for members: a non-member of a public channel gets 403, of a private one 404, of an archived one the members", async () => {
    const pub = await channel("mem-public", { members: [admin.id] });
    const priv = await channel("mem-private", {
      isPrivate: true,
      members: [admin.id],
    });
    const old = await channel("mem-old", {
      archived: true,
      members: [member.id],
    });
    const forbidden = await send(
      h,
      lone,
      "GET",
      `/api/v1/channels/${pub}/members`,
    );
    expect(forbidden.statusCode).toBe(403);
    expect(jsonOf(forbidden).error.code).toBe("forbidden");
    const hidden = await send(
      h,
      lone,
      "GET",
      `/api/v1/channels/${priv}/members`,
    );
    expect(hidden.statusCode).toBe(404);
    const archived = await send(
      h,
      member,
      "GET",
      `/api/v1/channels/${old}/members`,
    );
    expect(archived.statusCode).toBe(200);
    expect(jsonOf(archived).members).toHaveLength(1);
  });

  it("refuses a limit above 100 and a bad cursor with 400", async () => {
    const id = await channel("mem-query", { members: [member.id] });
    for (const q of ["?limit=101", "?cursor=%25%25", "?search=a"]) {
      const res = await send(
        h,
        member,
        "GET",
        `/api/v1/channels/${id}/members${q}`,
      );
      expect(res.statusCode, q).toBe(400);
    }
  });
});
