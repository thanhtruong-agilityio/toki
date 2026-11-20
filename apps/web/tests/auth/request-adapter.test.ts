import { createApiClient } from "@toki/client-core";
import { describe, expect, test, vi } from "vitest";
import { toApiRequest } from "../../src/auth/request-adapter";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function setup(answer: () => Promise<Response>) {
  const fired: (() => void)[] = [];
  const fetchFn = vi.fn<typeof fetch>().mockImplementation(answer);
  const hook = vi.fn<(code: string) => void>();
  const api = createApiClient({
    timers: {
      after(_ms, fn) {
        fired.push(fn);
        return () => {};
      },
    },
    fetch: fetchFn,
    onUnauthenticated: hook,
  });
  return { request: toApiRequest(api), fetchFn, hook, fired };
}

describe("the adapter of the sign-in calls (TOKI-032 R25)", () => {
  test("a good answer is ok with the status and the body as it is, unknown keys kept", async () => {
    const { request, fetchFn } = setup(async () =>
      json(200, { name: "Acme", extra: 1 }),
    );
    const result = await request("/auth/codes", {
      method: "POST",
      body: { email: "a@example.com" },
    });
    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { name: "Acme", extra: 1 },
    });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("/api/v1/auth/codes");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ email: "a@example.com" }));
    expect(init?.credentials).toBe("same-origin");
  });

  test("a GET sends no body and no content type", async () => {
    const { request, fetchFn } = setup(async () => json(200, {}));
    await request("/auth/session", { method: "GET" });
    const init = fetchFn.mock.calls[0]![1]!;
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has("content-type")).toBe(false);
  });

  test("a 204 and an empty 200 are ok with undefined data", async () => {
    const a = setup(async () => new Response(null, { status: 204 }));
    expect(await a.request("/x", { method: "POST" })).toEqual({
      ok: true,
      status: 204,
      data: undefined,
    });
    const b = setup(async () => new Response("", { status: 200 }));
    expect(await b.request("/x", { method: "POST" })).toEqual({
      ok: true,
      status: 200,
      data: undefined,
    });
  });

  test("an error answer is http with the status, the code and the details", async () => {
    const { request } = setup(async () =>
      json(429, {
        error: {
          code: "rate_limited",
          message: "m",
          details: { retryAfterSeconds: 30 },
        },
      }),
    );
    expect(await request("/x", { method: "POST" })).toEqual({
      ok: false,
      kind: "http",
      status: 429,
      code: "rate_limited",
      details: { retryAfterSeconds: 30 },
    });
  });

  test("a body that is not the error format is http with code null and no details", async () => {
    const { request } = setup(
      async () => new Response("<html>", { status: 502 }),
    );
    expect(await request("/x", { method: "GET" })).toEqual({
      ok: false,
      kind: "http",
      status: 502,
      code: null,
    });
  });

  test("a 401 with each session code calls the hook once, and the result is still http", async () => {
    for (const code of [
      "unauthenticated",
      "session_ended",
      "account_deactivated",
    ]) {
      const { request, hook } = setup(async () =>
        json(401, { error: { code, message: "m" } }),
      );
      const result = await request("/auth/session", { method: "GET" });
      expect(result).toMatchObject({
        ok: false,
        kind: "http",
        status: 401,
        code,
      });
      expect(hook).toHaveBeenCalledTimes(1);
      expect(hook).toHaveBeenCalledWith(code);
    }
  });

  test("a 401 with invalid_code does not call the hook", async () => {
    const { request, hook } = setup(async () =>
      json(401, { error: { code: "invalid_code", message: "m" } }),
    );
    await request("/auth/sessions", { method: "POST", body: {} });
    expect(hook).not.toHaveBeenCalled();
  });

  test("a failed fetch is network, a body that is not JSON is invalid_response, and the timer is timeout", async () => {
    const down = setup(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await down.request("/x", { method: "GET" })).toEqual({
      ok: false,
      kind: "network",
    });

    const html = setup(async () => new Response("<html>", { status: 200 }));
    expect(await html.request("/x", { method: "GET" })).toEqual({
      ok: false,
      kind: "invalid_response",
    });

    const slow = setup(
      () => new Promise<Response>(() => {}), // never answers
    );
    const pending = slow.request("/x", { method: "GET" });
    await Promise.resolve();
    // The fake timer function of the setup fires the abort, but the fetch of
    // this test ignores the signal, so read the kind through an aborting fetch.
    expect(slow.fired).toHaveLength(1);
    void pending;
  });

  test("the timeout of the client ends the request with timeout", async () => {
    const fired: (() => void)[] = [];
    const api = createApiClient({
      timers: { after: (_ms, fn) => (fired.push(fn), () => {}) },
      fetch: ((_: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        })) as typeof fetch,
    });
    const pending = toApiRequest(api)("/x", { method: "GET" });
    await Promise.resolve();
    fired[0]!();
    expect(await pending).toEqual({ ok: false, kind: "timeout" });
  });
});
