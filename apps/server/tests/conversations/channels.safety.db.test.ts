import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import { insertConversation, insertConversationMember } from "../test-rows.js";
import {
  jsonOf,
  newChannelId,
  person,
  send,
  type Person,
} from "./channel-helpers.js";

// R20: no log line holds a channel name, topic, description or id list, and the
// four routes with no body take the three forms of an empty body.
const SECRET_NAME = "zz-secret-launch-name";
const SECRET_TOPIC = "zz-secret-launch-topic";
let force = false;
let h: Harness;
let admin: Person;
beforeAll(async () => {
  h = await createHarness({
    channelDeps: {
      recordChange: async (tx) => {
        if (!force) return;
        // A failure of the database that carries the offending value in its
        // message: a topic of 300 characters breaks conversations_topic_check.
        await (
          tx as unknown as { execute: (q: unknown) => Promise<unknown> }
        ).execute(
          sql`insert into conversations (id, workspace_id, kind, name, topic, is_private, is_general, created_by, created_at)
              values (${newChannelId()}, ${h.workspaceId}, 'channel', ${`${SECRET_NAME}-2`}, ${SECRET_TOPIC + "x".repeat(300)}, false, false, ${admin.id}, now())`,
        );
      },
    },
  });
  admin = await person(h, "y-admin", "admin");
});
afterAll(async () => {
  await h?.close();
});

describe("what the log may hold (R20)", () => {
  it("a database failure inside a request answers 500 and leaves no name, topic or parameter in the log", async () => {
    force = true;
    let res;
    try {
      res = await send(h, admin, "POST", "/api/v1/channels", {
        id: newChannelId(),
        name: SECRET_NAME,
        topic: SECRET_TOPIC,
      });
    } finally {
      force = false;
    }
    expect(res.statusCode).toBe(500);
    expect(jsonOf(res).error.code).toBe("internal_error");
    const log = h.logText();
    expect(log).toContain("conversations_topic_check");
    expect(log).not.toContain(SECRET_NAME);
    expect(log).not.toContain(SECRET_TOPIC);
    expect(log).not.toContain("insert into");
    expect(res.body).not.toContain(SECRET_NAME);
  });

  it("does not log the query string, so a search is not logged", async () => {
    await send(
      h,
      admin,
      "GET",
      "/api/v1/channels?search=zz-secret-search-text",
    );
    expect(h.logText()).not.toContain("zz-secret-search-text");
  });

  it("a taken name is answered 409 and its name is not logged", async () => {
    await send(h, admin, "POST", "/api/v1/channels", {
      id: newChannelId(),
      name: "zz-taken-name",
    });
    const res = await send(h, admin, "POST", "/api/v1/channels", {
      id: newChannelId(),
      name: "zz-taken-name",
    });
    expect(res.statusCode).toBe(409);
    expect(h.logText()).not.toContain("zz-taken-name");
  });
});

describe("the routes with no body (Design, the empty JSON body)", () => {
  async function fresh(name: string, archived = false) {
    const id = await insertConversation(h.sql, {
      workspace_id: h.workspaceId,
      created_by: admin.id,
      name,
      archived_at: archived ? new Date("2026-02-01T00:00:00Z") : null,
    });
    await insertConversationMember(h.sql, {
      conversation_id: id,
      user_id: admin.id,
      workspace_id: h.workspaceId,
    });
    return id;
  }
  const forms = [
    ["no body", {}],
    [
      "an empty body with the JSON type",
      { headers: { "content-type": "application/json" } },
    ],
    ["{}", { headers: { "content-type": "application/json" }, payload: "{}" }],
  ] as const;

  it.each(["leave", "archive", "restore"] as const)(
    "%s takes no body, an empty JSON body and {} and refuses any other body",
    async (action) => {
      for (const [label, extra] of forms) {
        const id = await fresh(
          `nb-${action}-${label.replace(/[^a-z]/g, "")}`,
          action === "restore",
        );
        const res = await h.call({
          method: "POST",
          url: `/api/v1/channels/${id}/${action}`,
          ...extra,
          headers: {
            ...admin.headers,
            ...("headers" in extra ? extra.headers : {}),
          },
        });
        expect(res.statusCode, `${action} with ${label}`).toBe(200);
      }
      const id = await fresh(`nb-${action}-bad`, action === "restore");
      const bad = await send(
        h,
        admin,
        "POST",
        `/api/v1/channels/${id}/${action}`,
        { x: 1 },
      );
      expect(bad.statusCode).toBe(400);
      expect(jsonOf(bad).error.code).toBe("validation_failed");
    },
  );
});
