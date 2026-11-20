import { describe, expect, it } from "vitest";
import { createApiClient } from "../api/client";
import type { ApiError } from "../api/errors";
import { fakeFetch, fakeTimers, json } from "../api/test-support";
import { createSessionsApi } from "./sessions";

const make = (
  answers: Parameters<typeof fakeFetch>[0],
  onUnauthenticated?: (code: string) => void,
) => {
  const fetch = fakeFetch(answers);
  const t = fakeTimers();
  const api = createApiClient({ timers: t.timers, fetch, onUnauthenticated });
  return { sessions: createSessionsApi(api), fetch };
};
const row = (extra: Record<string, unknown> = {}) => ({
  id: "s1",
  current: true,
  deviceKind: "desktop",
  browser: "chrome",
  lastUsedAt: "2026-11-16T09:00:00.000Z",
  ...extra,
});
const noContent = () => new Response(null, { status: 204 });
const failed = async (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("it should have rejected");
    },
    (error: unknown) => error as ApiError,
  );

describe("createSessionsApi (R13)", () => {
  it("list is GET /auth/sessions and returns the array in the server's order", async () => {
    const { sessions, fetch } = make(
      json({ sessions: [row(), row({ id: "s2", current: false })] }),
    );
    const list = await sessions.list();
    expect(fetch.calls[0]!.method).toBe("GET");
    expect(fetch.calls[0]!.url).toBe("/api/v1/auth/sessions");
    expect(list.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("endOne is DELETE /auth/sessions/{id} with the id encoded", async () => {
    const { sessions, fetch } = make(noContent);
    await expect(sessions.endOne("a/b c")).resolves.toBeUndefined();
    expect(fetch.calls[0]!.method).toBe("DELETE");
    expect(fetch.calls[0]!.url).toBe("/api/v1/auth/sessions/a%2Fb%20c");
  });

  it("endOthers is DELETE /auth/sessions", async () => {
    const { sessions, fetch } = make(noContent);
    await expect(sessions.endOthers()).resolves.toBeUndefined();
    expect(fetch.calls[0]!.method).toBe("DELETE");
    expect(fetch.calls[0]!.url).toBe("/api/v1/auth/sessions");
  });

  it("signOut is DELETE /auth/session", async () => {
    const { sessions, fetch } = make(noContent);
    await expect(sessions.signOut()).resolves.toBeUndefined();
    expect(fetch.calls[0]!.method).toBe("DELETE");
    expect(fetch.calls[0]!.url).toBe("/api/v1/auth/session");
  });

  it("a 404 not_found, a 400 current_session and a 401 session_ended are ApiErrors, the 401 calls the hook", async () => {
    const seen: string[] = [];
    const err = (status: number, code: string) =>
      json({ error: { code, message: "m" } }, status);
    const { sessions } = make(
      [
        err(404, "not_found"),
        err(400, "current_session"),
        err(401, "session_ended"),
      ],
      (code) => seen.push(code),
    );
    const a = await failed(sessions.endOne("x"));
    const b = await failed(sessions.endOne("y"));
    const c = await failed(sessions.endOthers());
    expect([a.kind, a.status, a.code]).toEqual(["http", 404, "not_found"]);
    expect([b.status, b.code]).toEqual([400, "current_session"]);
    expect([c.status, c.code]).toEqual([401, "session_ended"]);
    expect(seen).toEqual(["session_ended"]);
  });

  it("a body with no sessions is invalid_response", async () => {
    const { sessions } = make(json({}));
    expect((await failed(sessions.list())).kind).toBe("invalid_response");
  });

  it("a missing id, or a wrong type, is invalid_response", async () => {
    const noId: Record<string, unknown> = row();
    delete noId.id;
    expect(
      (await failed(make(json({ sessions: [noId] })).sessions.list())).kind,
    ).toBe("invalid_response");
    expect(
      (
        await failed(
          make(json({ sessions: [row({ current: "yes" })] })).sessions.list(),
        )
      ).kind,
    ).toBe("invalid_response");
  });

  it("an unknown key is dropped", async () => {
    const { sessions } = make(json({ sessions: [row({ ip: "1.2.3.4" })] }));
    const [first] = await sessions.list();
    expect(Object.keys(first!).sort()).toEqual([
      "browser",
      "current",
      "deviceKind",
      "id",
      "lastUsedAt",
    ]);
  });

  it("a browser or device kind outside the lists is read as unknown and the list is still returned", async () => {
    const { sessions } = make(
      json({
        sessions: [
          row({ browser: "brave" }),
          row({ id: "s2", current: false, deviceKind: "watch" }),
          row({ id: "s3", current: false, browser: "other" }),
        ],
      }),
    );
    const list = await sessions.list();
    expect(list.map((s) => [s.browser, s.deviceKind])).toEqual([
      ["unknown", "desktop"],
      ["chrome", "unknown"],
      ["other", "desktop"],
    ]);
  });
});
