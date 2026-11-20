import { describe, expect, expectTypeOf, it } from "vitest";
import { createApiClient } from "./client";
import { ApiError } from "./errors";
import { bootstrapBody, detailBody, id, summaryBody } from "./fixtures";
import { fakeFetch, fakeTimers, json } from "./test-support";

function make(answer: Parameters<typeof fakeFetch>[0]) {
  const fetch = fakeFetch(answer);
  const t = fakeTimers();
  return { api: createApiClient({ timers: t.timers, fetch }), fetch };
}
const rejects = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (e: unknown) => e as ApiError,
  );

describe("typed methods (R9)", () => {
  it("bootstrap: GET /bootstrap, returns the body, takes a signal", async () => {
    const { api, fetch } = make(() => json(bootstrapBody()));
    const controller = new AbortController();
    const body = await api.bootstrap(controller.signal);
    expect(body.eventNumber).toBe(41);
    const call = fetch.calls[0]!;
    expect(call.method).toBe("GET");
    expect(call.url).toBe("/api/v1/bootstrap");
    expect(call.body).toBeUndefined();
  });

  it("bootstrap: an invalid body is invalid_response", async () => {
    const { api } = make(() => json({ nope: 1 }));
    expect((await rejects(api.bootstrap()))?.kind).toBe("invalid_response");
  });

  it("channels.create: POST /channels with the body, created true for 201 and false for 200", async () => {
    const { api, fetch } = make([
      json({ channel: detailBody() }, 201),
      json({ channel: detailBody() }, 200),
    ]);
    const body = { id: id(11), name: "project-launch", isPrivate: false };
    const first = await api.channels.create(body);
    expect(first).toEqual({ channel: detailBody(), created: true });
    expect(fetch.calls[0]!.method).toBe("POST");
    expect(fetch.calls[0]!.url).toBe("/api/v1/channels");
    expect(fetch.calls[0]!.body).toBe(JSON.stringify(body));
    expect((await api.channels.create(body)).created).toBe(false);
  });

  it("channels.list: GET /channels with the query, undefined values left out", async () => {
    const { api, fetch } = make(() =>
      json({ channels: [summaryBody()], nextCursor: null }),
    );
    const answer = await api.channels.list({
      search: "a b",
      limit: undefined,
      cursor: "c1",
    });
    expect(answer.channels).toHaveLength(1);
    expect(fetch.calls[0]!.url).toBe("/api/v1/channels?search=a+b&cursor=c1");
    await api.channels.list();
    expect(fetch.calls[1]!.url).toBe("/api/v1/channels");
  });

  it("channels.get: GET /channels/{id}, a path part is encoded", async () => {
    const { api, fetch } = make(() => json({ channel: detailBody() }));
    await api.channels.get("a/b");
    expect(fetch.calls[0]!.url).toBe("/api/v1/channels/a%2Fb");
    expect((await api.channels.get(id(11))).channel).toEqual(detailBody());
  });

  it("channels.members: GET /channels/{id}/members with the query", async () => {
    const { api, fetch } = make(() =>
      json({
        members: [{ userId: id(1), joinedAt: "2026-01-01T00:00:00Z" }],
        nextCursor: null,
      }),
    );
    const answer = await api.channels.members(id(11), { limit: 50 });
    expect(answer.members[0]!.userId).toBe(id(1));
    expect(fetch.calls[0]!.url).toBe(
      `/api/v1/channels/${id(11)}/members?limit=50`,
    );
  });

  it("channels.update: PATCH /channels/{id} with the given keys", async () => {
    const { api, fetch } = make(() =>
      json({ channel: detailBody(), changed: true }),
    );
    const answer = await api.channels.update(id(11), { topic: "New" });
    expect(answer.changed).toBe(true);
    expect(fetch.calls[0]!.method).toBe("PATCH");
    expect(fetch.calls[0]!.body).toBe('{"topic":"New"}');
  });

  it("channels.join: no body without settings or with {}, and { settings } with a key", async () => {
    const { api, fetch } = make(() =>
      json({ channel: detailBody(), changed: true }),
    );
    await api.channels.join(id(11));
    await api.channels.join(id(11), {});
    await api.channels.join(id(11), { isMuted: true });
    expect(fetch.calls.map((c) => c.method)).toEqual(["POST", "POST", "POST"]);
    expect(fetch.calls[0]!.url).toBe(`/api/v1/channels/${id(11)}/join`);
    expect(fetch.calls[0]!.body).toBeUndefined();
    expect(fetch.calls[1]!.body).toBeUndefined();
    expect(fetch.calls[2]!.body).toBe('{"settings":{"isMuted":true}}');
  });

  it("channels.addMembers: POST /channels/{id}/members with { userIds }", async () => {
    const { api, fetch } = make(() =>
      json({ added: [id(2)], alreadyMembers: [] }),
    );
    expect((await api.channels.addMembers(id(11), [id(2)])).added).toEqual([
      id(2),
    ]);
    expect(fetch.calls[0]!.body).toBe(JSON.stringify({ userIds: [id(2)] }));
  });

  it("channels.leave, archive and restore: POST with no body", async () => {
    const { api, fetch } = make([
      json({ changed: true, archived: false }),
      json({ channel: detailBody(), changed: true }),
      json({ channel: detailBody(), changed: true }),
    ]);
    await api.channels.leave(id(11));
    await api.channels.archive(id(11));
    await api.channels.restore(id(11));
    expect(fetch.calls.map((c) => c.url.replace(`/${id(11)}`, ""))).toEqual([
      "/api/v1/channels/leave",
      "/api/v1/channels/archive",
      "/api/v1/channels/restore",
    ]);
    for (const call of fetch.calls) {
      expect(call.method).toBe("POST");
      expect(call.body).toBeUndefined();
      expect(call.headers.has("content-type")).toBe(false);
    }
  });

  it("channels.removeMember: DELETE /channels/{id}/members/{userId}, no body", async () => {
    const { api, fetch } = make(() => json({ changed: true }));
    await api.channels.removeMember(id(11), "u/1");
    expect(fetch.calls[0]!.method).toBe("DELETE");
    expect(fetch.calls[0]!.url).toBe(
      `/api/v1/channels/${id(11)}/members/u%2F1`,
    );
    expect(fetch.calls[0]!.body).toBeUndefined();
  });

  it("directConversations.open: POST /direct-conversations, created true for 201 and false for 200", async () => {
    const entry = bootstrapBody().conversations[3]!;
    const { api, fetch } = make([
      json({ conversation: entry }, 201),
      json({ conversation: entry }, 200),
    ]);
    const first = await api.directConversations.open([id(2)]);
    expect(first).toEqual({ conversation: entry, created: true });
    expect(fetch.calls[0]!.url).toBe("/api/v1/direct-conversations");
    expect(fetch.calls[0]!.body).toBe(JSON.stringify({ userIds: [id(2)] }));
    expect((await api.directConversations.open([id(2)])).created).toBe(false);
  });

  it("conversations.saveSettings: PATCH /conversations/{id}/settings with only the given keys", async () => {
    const { api, fetch } = make(() =>
      json({
        settings: { notificationLevel: "all", isMuted: true, isStarred: false },
        changed: true,
      }),
    );
    await api.conversations.saveSettings(id(11), { isMuted: true });
    expect(fetch.calls[0]!.method).toBe("PATCH");
    expect(fetch.calls[0]!.url).toBe(
      `/api/v1/conversations/${id(11)}/settings`,
    );
    expect(fetch.calls[0]!.body).toBe('{"isMuted":true}');
    await api.conversations.saveSettings(id(11), {});
    expect(fetch.calls[1]!.body).toBe("{}");
  });

  it("each method reads its answer with its schema: a wrong shape is invalid_response", async () => {
    const { api } = make(() => json({ channel: { id: "x" } }));
    expect((await rejects(api.channels.get(id(11))))?.kind).toBe(
      "invalid_response",
    );
    expect((await rejects(api.channels.archive(id(11))))?.kind).toBe(
      "invalid_response",
    );
  });

  it("types: the typed methods take no headers or timeoutMs", () => {
    const { api } = make(() => json({}));
    expectTypeOf(api.channels.list).parameter(0).not.toHaveProperty("headers");
    expectTypeOf(api.channels.list).parameters.toEqualTypeOf<
      [
        query?: { search?: string; limit?: number; cursor?: string },
        signal?: AbortSignal,
      ]
    >();
  });
});
