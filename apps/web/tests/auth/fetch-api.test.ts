import { describe, expect, test, vi } from "vitest";
import { createFetchApi } from "../../src/auth/fetch-api";

// A `timers` object the test fires by hand.
function fakeTimers() {
  const items: { ms: number; fn: () => void; cancelled: boolean }[] = [];
  return {
    items,
    after(ms: number, fn: () => void) {
      const item = { ms, fn, cancelled: false };
      items.push(item);
      return () => {
        item.cancelled = true;
      };
    },
    fire() {
      for (const item of items) if (!item.cancelled) item.fn();
    },
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function setup(response: () => Promise<Response>) {
  const timers = fakeTimers();
  const fetchFn = vi.fn<typeof fetch>().mockImplementation(response);
  const hook = vi.fn<(code: string) => void>();
  const api = createFetchApi({ timers, fetchFn, onUnauthenticated: hook });
  return { timers, fetchFn, hook, api };
}

describe("the stand-in request (replaced by api.request of TOKI-032)", () => {
  test("sends to /api/v1 + path with the method and a JSON body, same-origin cookies", async () => {
    const { api, fetchFn } = setup(async () => json(200, { name: "Acme" }));
    const res = await api("/auth/codes", {
      method: "POST",
      body: { email: "a@example.com" },
    });
    expect(res).toEqual({ ok: true, status: 200, data: { name: "Acme" } });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("/api/v1/auth/codes");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ email: "a@example.com" }));
    expect(new Headers(init?.headers).get("content-type")).toBe(
      "application/json",
    );
    expect(init?.credentials).toBe("same-origin");
  });

  test("a GET sends no body and no content type", async () => {
    const { api, fetchFn } = setup(async () => json(200, {}));
    await api("/auth/session", { method: "GET" });
    const init = fetchFn.mock.calls[0]![1]!;
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has("content-type")).toBe(false);
  });

  test("an error body gives the code and the details", async () => {
    const { api, hook } = setup(async () =>
      json(400, {
        error: {
          code: "code_incorrect",
          message: "x",
          details: { triesLeft: 3 },
        },
      }),
    );
    expect(await api("/auth/sessions", { method: "POST", body: {} })).toEqual({
      ok: false,
      kind: "http",
      status: 400,
      code: "code_incorrect",
      details: { triesLeft: 3 },
    });
    expect(hook).not.toHaveBeenCalled();
  });

  test("an error that is not the error body has no code", async () => {
    const { api } = setup(async () => new Response("<html>", { status: 502 }));
    expect(await api("/auth/codes", { method: "POST", body: {} })).toEqual({
      ok: false,
      kind: "http",
      status: 502,
      code: null,
    });
  });

  test("a 2xx that is not JSON is invalid_response; a 204 is ok with no data", async () => {
    const a = setup(async () => new Response("nope", { status: 200 }));
    expect(await a.api("/auth/session", { method: "GET" })).toEqual({
      ok: false,
      kind: "invalid_response",
    });
    const b = setup(async () => new Response(null, { status: 204 }));
    expect(await b.api("/auth/session", { method: "GET" })).toEqual({
      ok: true,
      status: 204,
      data: undefined,
    });
  });

  test("a rejected fetch is network", async () => {
    const { api } = setup(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await api("/auth/session", { method: "GET" })).toEqual({
      ok: false,
      kind: "network",
    });
  });

  test("no answer after 10 seconds aborts the request and is timeout, through timers.after", async () => {
    const timers = fakeTimers();
    let signal: AbortSignal | null | undefined;
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal;
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const api = createFetchApi({ timers, fetchFn });
    const pending = api("/auth/session", { method: "GET" });
    expect(timers.items).toHaveLength(1);
    expect(timers.items[0]!.ms).toBe(10_000);
    timers.fire();
    expect(signal?.aborted).toBe(true);
    expect(await pending).toEqual({ ok: false, kind: "timeout" });
  });

  test("the timer is cancelled when the answer arrives", async () => {
    const { api, timers } = setup(async () => json(200, {}));
    await api("/auth/session", { method: "GET" });
    expect(timers.items.every((i) => i.cancelled)).toBe(true);
  });

  test.each(["unauthenticated", "session_ended", "account_deactivated"])(
    "a 401 %s calls the hook once with the code",
    async (code) => {
      const { api, hook } = setup(async () =>
        json(401, { error: { code, message: "x" } }),
      );
      const res = await api("/auth/session", { method: "GET" });
      expect(res).toMatchObject({ ok: false, kind: "http", status: 401, code });
      expect(hook).toHaveBeenCalledTimes(1);
      expect(hook).toHaveBeenCalledWith(code);
    },
  );

  test("another 401 code, a 403 and a 500 do not call the hook; a throwing hook changes nothing", async () => {
    for (const [status, code] of [
      [401, "other"],
      [403, "origin_not_allowed"],
      [500, "internal_error"],
    ] as const) {
      const { api, hook } = setup(async () =>
        json(status, { error: { code, message: "x" } }),
      );
      await api("/auth/session", { method: "GET" });
      expect(hook).not.toHaveBeenCalled();
    }
    const timers = fakeTimers();
    const api = createFetchApi({
      timers,
      fetchFn: async () =>
        json(401, { error: { code: "session_ended", message: "x" } }),
      onUnauthenticated: () => {
        throw new Error("boom");
      },
    });
    expect(await api("/auth/session", { method: "GET" })).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  test("with no hook a 401 is only a result", async () => {
    const timers = fakeTimers();
    const api = createFetchApi({
      timers,
      fetchFn: async () =>
        json(401, { error: { code: "session_ended", message: "x" } }),
    });
    expect(await api("/auth/session", { method: "GET" })).toMatchObject({
      status: 401,
      code: "session_ended",
    });
  });
});
