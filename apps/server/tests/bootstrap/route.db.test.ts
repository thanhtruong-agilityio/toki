import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BootstrapResponse,
  ErrorResponseSchema,
  type BootstrapResponse as Answer,
} from "@toki/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import { sourceFiles } from "../source-files.js";
import {
  insertConversation,
  insertConversationMember,
  insertDirectConversation,
} from "../test-rows.js";
import {
  bystander,
  person,
  send,
  type Person,
} from "../conversations/channel-helpers.js";

const URL_PATH = "/api/v1/bootstrap";

let h: Harness;
let ada: Person; // admin, the person who reads
let sam: Person; // member
let dee: string; // deactivated
let zoe: string; // member, in none of the private things
let ids: Record<string, string>;

beforeAll(async () => {
  h = await createHarness();
  ada = await person(h, "ada", "admin", { display_name: "Ada" });
  sam = await person(h, "sam", "member", { display_name: "sam" });
  dee = await bystander(h, "dee", {
    display_name: "Dee",
    status: "deactivated",
  });
  zoe = await bystander(h, "zoe", { display_name: "Zoe" });

  const channel = async (
    name: string,
    members: string[],
    values: Record<string, unknown> = {},
  ) => {
    const id = await insertConversation(h.sql, {
      workspace_id: h.workspaceId,
      created_by: ada.id,
      name,
      ...values,
    });
    for (const user_id of members) {
      await insertConversationMember(h.sql, {
        conversation_id: id,
        user_id,
        workspace_id: h.workspaceId,
      });
    }
    return id;
  };
  const direct = (user_ids: string[]) =>
    insertDirectConversation(h.sql, { workspace_id: h.workspaceId, user_ids });

  ids = {
    joined: await channel("joined", [ada.id, sam.id], {
      topic: "Roadmap talk",
      description: "A secret description text",
    }),
    priv: await channel("priv-room", [ada.id], { is_private: true }),
    general: await channel("general", [ada.id, sam.id], { is_general: true }),
    dm: await direct([ada.id, sam.id]),
    group: await direct([ada.id, sam.id, zoe]),
    deactivatedDm: await direct([ada.id, dee]),
    unjoined: await channel("open-room", [sam.id]),
    secret: await channel("secret-plan", [sam.id, zoe], {
      is_private: true,
      topic: "hidden topic",
    }),
    othersDm: await direct([sam.id, zoe]),
    archived: await channel("old-news", [ada.id], {
      archived_at: new Date("2026-02-01T00:00:00Z"),
    }),
  };
  // Ada's own settings in one channel.
  await h.sql`update conversation_members set notification_level = 'none', is_muted = true, is_starred = true where conversation_id = ${ids.priv} and user_id = ${ada.id}`;
  await h.sql`update conversation_members set notification_level = 'mentions' where conversation_id = ${ids.dm} and user_id = ${ada.id}`;
  await h.sql`update conversation_members set notification_level = 'all', is_starred = true where conversation_id = ${ids.joined} and user_id = ${sam.id}`;
});
afterAll(async () => {
  await h?.close();
});

const get = (who: Person) => send(h, who, "GET", URL_PATH);
const answerOf = (res: { statusCode: number; body: string }): Answer => {
  expect(res.statusCode, res.body).toBe(200);
  const parsed = BootstrapResponse.safeParse(JSON.parse(res.body));
  expect(parsed.success, res.body).toBe(true);
  return JSON.parse(res.body) as Answer;
};

// A checksum of every table except sessions, to show that the call wrote nothing.
async function checksum() {
  const tables = await h.sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name <> 'sessions' order by 1`;
  const out: Record<string, string> = {};
  for (const { table_name } of tables) {
    const [row] = await h.sql.unsafe<{ c: string }[]>(
      `select count(*)::text || ':' || coalesce(md5(string_agg(t::text, '|' order by t::text)), '') as c from ${table_name} t`,
    );
    out[table_name] = row!.c;
  }
  return out;
}

describe("access (R1)", () => {
  it("is registered once, as a GET under /api/v1", () => {
    expect(h.app.hasRoute({ method: "GET", url: URL_PATH })).toBe(true);
    const printed = h.app.printRoutes({ commonPrefix: false });
    expect(printed.match(/bootstrap/g)).toHaveLength(1);
  });

  it("answers 200 to a member and to an admin, with the same shape", async () => {
    const a = answerOf(await get(ada));
    const m = answerOf(await get(sam));
    expect(Object.keys(a).sort()).toEqual(Object.keys(m).sort());
    expect(a.user.role).toBe("admin");
    expect(m.user.role).toBe("member");
  });

  it("answers the three 401 codes with an error body and no workspace data", async () => {
    const none = await h.call({ method: "GET", url: URL_PATH });
    const ended = await person(h, "ended-one");
    await h.sql`update sessions set ended_at = now(), ended_reason = 'signed_out' where user_id = ${ended.id}`;
    const endedRes = await get(ended);
    const gone = await person(h, "gone-one");
    await h.sql`update users set status = 'deactivated' where id = ${gone.id}`;
    const goneRes = await get(gone);
    const codes = [none, endedRes, goneRes].map((r) => {
      expect(r.statusCode).toBe(401);
      const parsed = ErrorResponseSchema.safeParse(JSON.parse(r.body));
      expect(parsed.success, r.body).toBe(true);
      expect(r.body).not.toContain("Acme");
      expect(r.body).not.toContain("Ada");
      return JSON.parse(r.body).error.code as string;
    });
    expect(codes).toEqual([
      "unauthenticated",
      "session_ended",
      "account_deactivated",
    ]);
  });

  it("ignores a query string", async () => {
    const res = await h.call({
      method: "GET",
      url: `${URL_PATH}?limit=1&x=2`,
      headers: ada.headers,
    });
    expect(answerOf(res).conversations.length).toBeGreaterThan(1);
  });
});

describe("the parts (R3, R5)", () => {
  it("holds user equal to /auth/session, and the only address in the body is that one", async () => {
    const res = await get(ada);
    const answer = answerOf(res);
    const session = await send(h, ada, "GET", "/api/v1/auth/session");
    expect(answer.user).toEqual(JSON.parse(session.body).user);
    expect(res.body.match(/[\w.+-]+@[\w-]+\.[\w.]+/g)).toEqual([
      "ada@example.com",
    ]);
  });

  it("holds the workspace and every person with four keys, ordered by lower-cased name", async () => {
    const answer = answerOf(await get(ada));
    expect(answer.workspace).toEqual({ id: h.workspaceId, name: "Acme" });
    const named = answer.members.filter((m) =>
      ["Ada", "sam", "Dee", "Zoe"].includes(m.displayName),
    );
    expect(named.map((m) => m.displayName)).toEqual([
      "Ada",
      "Dee",
      "sam",
      "Zoe",
    ]);
    expect(named.find((m) => m.displayName === "Dee")).toEqual({
      id: dee,
      displayName: "Dee",
      role: "member",
      status: "deactivated",
    });
  });
});

describe("the conversations (R6, R7, R8, R18, R19)", () => {
  it("holds exactly the conversations of the person that are not archived, in id order", async () => {
    const answer = answerOf(await get(ada));
    const expected = [
      ids.joined,
      ids.priv,
      ids.general,
      ids.dm,
      ids.group,
      ids.deactivatedDm,
    ]!.sort();
    expect(answer.conversations.map((c) => c.id)).toEqual(expected);
    expect(answer.conversations.map((c) => c.id)).not.toContain(ids.archived);
  });

  it("omits a conversation after the person leaves it and another after it is archived", async () => {
    const reader = await person(h, "leaver");
    const a = await insertConversation(h.sql, {
      workspace_id: h.workspaceId,
      created_by: ada.id,
      name: "leave-a",
    });
    const b = await insertConversation(h.sql, {
      workspace_id: h.workspaceId,
      created_by: ada.id,
      name: "leave-b",
    });
    for (const id of [a, b]) {
      await insertConversationMember(h.sql, {
        conversation_id: id,
        user_id: reader.id,
        workspace_id: h.workspaceId,
      });
    }
    expect(
      answerOf(await get(reader))
        .conversations.map((c) => c.id)
        .sort(),
    ).toEqual([a, b].sort());
    await h.sql`delete from conversation_members where conversation_id = ${a} and user_id = ${reader.id}`;
    await h.sql`update conversations set archived_at = now() where id = ${b}`;
    expect(answerOf(await get(reader)).conversations).toEqual([]);
  });

  it("gives a channel and a direct message their own shape and values", async () => {
    const answer = answerOf(await get(ada));
    const by = new Map(answer.conversations.map((c) => [c.id, c]));
    expect(by.get(ids.priv)).toEqual({
      id: ids.priv,
      kind: "channel",
      name: "priv-room",
      topic: null,
      isPrivate: true,
      isGeneral: false,
      notificationLevel: "none",
      isMuted: true,
      isStarred: true,
      memberIds: null,
    });
    expect(by.get(ids.general)).toMatchObject({
      isGeneral: true,
      notificationLevel: "mentions",
    });
    expect(by.get(ids.dm)).toEqual({
      id: ids.dm,
      kind: "dm",
      name: null,
      topic: null,
      isPrivate: true,
      isGeneral: false,
      notificationLevel: "mentions",
      isMuted: false,
      isStarred: false,
      memberIds: [ada.id, sam.id].sort(),
    });
    const group = by.get(ids.group)!;
    expect(group.kind).toBe("group_dm");
    expect(group.notificationLevel).toBe("all");
    expect(group.memberIds).toEqual([ada.id, sam.id, zoe].sort());
  });

  it("gives each person their own level, mute and star, and none of the other's", async () => {
    const mine = answerOf(await get(ada));
    const his = answerOf(await get(sam));
    const adaJoined = mine.conversations.find((c) => c.id === ids.joined)!;
    const samJoined = his.conversations.find((c) => c.id === ids.joined)!;
    expect(adaJoined).toMatchObject({
      notificationLevel: "mentions",
      isStarred: false,
    });
    expect(samJoined).toMatchObject({
      notificationLevel: "all",
      isStarred: true,
    });
  });

  it("keeps a direct message with a deactivated person, with the person in members", async () => {
    const answer = answerOf(await get(ada));
    const entry = answer.conversations.find((c) => c.id === ids.deactivatedDm)!;
    expect(entry.memberIds).toContain(dee);
    expect(answer.members.find((m) => m.id === dee)!.status).toBe(
      "deactivated",
    );
    await h.sql`update users set status = 'active' where id = ${dee}`;
    expect(
      answerOf(await get(ada)).members.find((m) => m.id === dee)!.status,
    ).toBe("active");
    await h.sql`update users set status = 'deactivated' where id = ${dee}`;
  });

  it("shows a person nothing of what they may not see (R18), and shows the same names to who may", async () => {
    const outsider = await person(h, "outsider");
    const body = (await get(outsider)).body;
    for (const hidden of [
      "secret-plan",
      "hidden topic",
      "open-room",
      ids.secret,
      ids.othersDm,
      ids.unjoined,
    ]) {
      expect(body).not.toContain(hidden);
    }
    const member = (await get(sam)).body;
    expect(member).toContain("secret-plan");
    expect(member).toContain("hidden topic");
  });

  it("holds no description and no seeded text other than names and topics (R12)", async () => {
    const body = (await get(ada)).body;
    expect(body).not.toContain("A secret description text");
    expect(body).toContain("Roadmap talk");
  });
});

describe("headers and writes (R13)", () => {
  it("sends no-store and a JSON media type, and writes nothing but the session's last use", async () => {
    const before = await checksum();
    const res = await get(ada);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(String(res.headers["content-type"]).split(";")[0]).toBe(
      "application/json",
    );
    expect(await checksum()).toEqual(before);
    // The check can see a change: it is not blind.
    await h.sql`update users set language = 'vi' where id = ${ada.id}`;
    expect(await checksum()).not.toEqual(before);
    await h.sql`update users set language = 'en' where id = ${ada.id}`;
  });
});

describe("where the code lives (R16)", () => {
  it("is imported by app.ts and by no file under modules/", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../src");
    expect(readFileSync(join(root, "app.ts"), "utf8")).toMatch(
      /from "\.\/bootstrap\/index\.js"/,
    );
    const offenders = sourceFiles(join(root, "modules"), true).filter((f) =>
      /\/bootstrap\//.test(readFileSync(f, "utf8").replace(/\\/g, "/")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("failures of the build through the route (R4, R10)", () => {
  it("answers 500 internal_error with no workspace data when the workspace ids differ", async () => {
    const own = await createHarness({
      bootstrapDeps: {
        getAccountsByIds: async (client, accountIds) => [
          {
            id: accountIds[0]!,
            workspaceId: crypto.randomUUID(),
            role: "member",
            status: "active",
          },
        ],
      },
    });
    try {
      const who = await person(own, "r4", "member", { display_name: "Ruth" });
      const res = await send(own, who, "GET", URL_PATH);
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).error.code).toBe("internal_error");
      expect(res.body).not.toContain("Acme");
      expect(res.body).not.toContain("Ruth");
    } finally {
      await own.close();
    }
  });

  it("answers 401 account_deactivated with nothing else when the snapshot shows the account deactivated", async () => {
    const own = await createHarness({
      bootstrapDeps: {
        getAccountById: async (client, id) => {
          const { getAccountById } =
            await import("../../src/modules/members/index.js");
          const real = await getAccountById(client, id);
          return real && { ...real, status: "deactivated" as const };
        },
      },
    });
    try {
      const who = await person(own, "r10", "member", { display_name: "Rae" });
      const res = await send(own, who, "GET", URL_PATH);
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error.code).toBe("account_deactivated");
      expect(res.body).not.toContain("Acme");
      expect(res.body).not.toContain("Rae");
    } finally {
      await own.close();
    }
  });
});
