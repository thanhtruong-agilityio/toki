import { z } from "zod";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createApiClient } from "./client";
import { ApiError } from "./errors";
import { fakeFetch, fakeTimers, json } from "./test-support";

const make = (
  answers: Parameters<typeof fakeFetch>[0] = () => json({ ok: true }),
  options: Partial<Parameters<typeof createApiClient>[0]> = {},
) => {
  const fetch = fakeFetch(answers);
  const t = fakeTimers();
  const api = createApiClient({ timers: t.timers, fetch, ...options });
  return { api, fetch, t };
};
const Ok = z.object({ ok: z.boolean() });
const get = (api: ReturnType<typeof make>["api"], extra = {}) =>
  api.request({ method: "GET", path: "/x", schema: Ok, ...extra });
const fail = async (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("it should have rejected");
    },
    (error: unknown) => error as ApiError,
  );

describe("request core (R2)", () => {
  it("sends baseUrl + path, the query without undefined values, same-origin credentials and Accept", async () => {
    const { api, fetch } = make();
    await get(api, { query: { search: "a b", limit: undefined } });
    const call = fetch.calls[0]!;
    expect(call.url).toBe("/api/v1/x?search=a+b");
    expect(call.method).toBe("GET");
    expect(call.credentials).toBe("same-origin");
    expect(call.headers.get("accept")).toBe("application/json");
    expect(call.body).toBeUndefined();
    expect(call.headers.has("content-type")).toBe(false);
  });

  it("sends no query string when every value is undefined", async () => {
    const { api, fetch } = make();
    await get(api, { query: { a: undefined } });
    expect(fetch.calls[0]!.url).toBe("/api/v1/x");
  });

  it("sends a body as JSON with the JSON type, and none without a body", async () => {
    const { api, fetch } = make(() => json({ ok: true }));
    await api.request({
      method: "POST",
      path: "/x",
      body: { a: 1 },
      schema: Ok,
    });
    expect(fetch.calls[0]!.body).toBe('{"a":1}');
    expect(fetch.calls[0]!.headers.get("content-type")).toBe(
      "application/json",
    );
    await api.request({ method: "POST", path: "/x", schema: Ok });
    expect(fetch.calls[1]!.body).toBeUndefined();
    expect(fetch.calls[1]!.headers.has("content-type")).toBe(false);
    await api.request({ method: "DELETE", path: "/x", schema: Ok });
    expect(fetch.calls[2]!.method).toBe("DELETE");
    expect(fetch.calls[2]!.body).toBeUndefined();
    expect(fetch.calls[2]!.headers.has("content-type")).toBe(false);
  });

  it("sets no Origin header", async () => {
    const { api, fetch } = make();
    await get(api);
    expect(fetch.calls[0]!.headers.has("origin")).toBe(false);
  });

  it("reads globalThis.fetch when a request is sent, not when the client is made", async () => {
    const t = fakeTimers();
    const api = createApiClient({ timers: t.timers });
    const replacement = fakeFetch(json({ ok: true }));
    const original = globalThis.fetch;
    globalThis.fetch = replacement;
    try {
      await get(api);
    } finally {
      globalThis.fetch = original;
    }
    expect(replacement.calls).toHaveLength(1);
  });

  it("adds the headers of one call, and ignores Accept, Content-Type and Origin among them", async () => {
    const { api, fetch } = make();
    await get(api, { headers: { "Idempotency-Key": "k1" } });
    expect(fetch.calls[0]!.headers.get("idempotency-key")).toBe("k1");
    expect(fetch.calls[0]!.headers.get("accept")).toBe("application/json");

    await api.request({
      method: "POST",
      path: "/x",
      body: { a: 1 },
      schema: Ok,
      headers: {
        accept: "text/html",
        "Content-Type": "text/plain",
        Origin: "http://evil",
      },
    });
    const second = fetch.calls[1]!;
    expect(second.headers.get("accept")).toBe("application/json");
    expect(second.headers.get("content-type")).toBe("application/json");
    expect(second.headers.has("origin")).toBe(false);

    await get(api, { headers: { "Content-Type": "text/plain", Origin: "x" } });
    const third = fetch.calls[2]!;
    expect(third.headers.has("content-type")).toBe(false);
    expect(third.headers.has("origin")).toBe(false);
  });

  it("types: request is on the client, createApiClient needs timers", () => {
    const { api } = make();
    expectTypeOf(api.request).toBeFunction();
    // @ts-expect-error timers is required
    createApiClient({});
  });
});

describe("a good answer (R3)", () => {
  it("returns the parsed body, drops unknown keys, and fails with invalid_response otherwise", async () => {
    const { api } = make([
      json({ ok: true, extra: 1 }),
      json({ nope: 1 }),
      new Response("<html>", { status: 200 }),
    ]);
    expect(await get(api)).toEqual({ ok: true });
    const mismatch = await fail(get(api));
    expect(mismatch.kind).toBe("invalid_response");
    expect(mismatch.status).toBe(200);
    expect(mismatch.message).not.toContain("nope");
    const notJson = await fail(get(api));
    expect(notJson.kind).toBe("invalid_response");
  });

  it("returns undefined for a 204 without running the schema, and for z.undefined() whatever the body", async () => {
    const { api } = make([
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
      new Response("", { status: 200 }),
      json({ any: 1 }),
    ]);
    expect(await get(api)).toBeUndefined(); // 204 with schema Ok
    const none = (extra = {}) =>
      api.request({
        method: "DELETE",
        path: "/x",
        schema: z.undefined(),
        ...extra,
      });
    expect(await none()).toBeUndefined();
    expect(await none()).toBeUndefined();
    expect(await none()).toBeUndefined();
  });

  it("reads an empty 2xx body as no value: a schema that accepts undefined takes it, another fails", async () => {
    const { api } = make([
      new Response("", { status: 200 }),
      new Response("", { status: 200 }),
    ]);
    expect(
      await api.request({ method: "GET", path: "/x", schema: z.unknown() }),
    ).toBeUndefined();
    expect((await fail(get(api))).kind).toBe("invalid_response");
  });

  it("requestWithStatus returns the status with the data", async () => {
    const { api } = make([json({ ok: true }, 201)]);
    expect(
      await api.requestWithStatus({ method: "POST", path: "/x", schema: Ok }),
    ).toEqual({ status: 201, data: { ok: true } });
  });
});

describe("error answers (R4)", () => {
  it("reads the code, message and details of a conforming body", async () => {
    const { api } = make(
      json(
        {
          error: {
            code: "channel_archived",
            message: "Archived.",
            details: { x: 1 },
          },
        },
        409,
      ),
    );
    const error = await fail(get(api));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("http");
    expect(error.status).toBe(409);
    expect(error.code).toBe("channel_archived");
    expect(error.message).toBe("Archived.");
    expect(error.details).toEqual({ x: 1 });
  });

  it("reads requestId from the details of a 500", async () => {
    const { api } = make(
      json(
        {
          error: {
            code: "internal_error",
            message: "x",
            details: { requestId: "r-9" },
          },
        },
        500,
      ),
    );
    expect((await fail(get(api))).requestId).toBe("r-9");
  });

  it("gives code null for an HTML page, an empty body and text, and copies none of them", async () => {
    const { api } = make([
      new Response("<html>bad gateway secret-text</html>", { status: 502 }),
      new Response("", { status: 503 }),
      new Response("plain secret-text", { status: 500 }),
    ]);
    for (const status of [502, 503, 500]) {
      const error = await fail(get(api));
      expect(error.kind).toBe("http");
      expect(error.status).toBe(status);
      expect(error.code).toBeNull();
      expect(error.details).toBeNull();
      expect(JSON.stringify(error)).not.toContain("secret-text");
    }
  });

  it("holds nothing of the request in the error", async () => {
    const { api } = make(json({ error: { code: "x", message: "m" } }, 400));
    const error = await fail(
      api.request({
        method: "POST",
        path: "/x",
        body: { password: "hunter2" },
        schema: Ok,
        headers: { Cookie: "s=1" },
      }),
    );
    expect(JSON.stringify(error)).not.toContain("hunter2");
    expect(JSON.stringify(error)).not.toContain("s=1");
  });
});

describe("network, timeout and abort (R5, R6)", () => {
  it("ends with timeout when the timer fires, aborts the fetch, and uses 10 000 by default", async () => {
    const { api, fetch, t } = make("never");
    const pending = fail(get(api));
    await Promise.resolve();
    expect(t.delays()).toEqual([10_000]);
    t.fire();
    const error = await pending;
    expect(error.kind).toBe("timeout");
    expect(error.status).toBeNull();
    expect(fetch.calls[0]!.signal?.aborted).toBe(true);
  });

  it("cancels the timer when the answer arrives", async () => {
    const { api, t } = make();
    await get(api);
    expect(t.cancels()).toBe(1);
  });

  it("cancels the timer when the request fails", async () => {
    const { api, t } = make(new Error("offline"));
    await fail(get(api));
    expect(t.cancels()).toBe(1);
  });

  it("ends with network when fetch rejects", async () => {
    const { api } = make(new TypeError("Failed to fetch"));
    const error = await fail(get(api));
    expect(error.kind).toBe("network");
    expect(error.status).toBeNull();
  });

  it("ends with aborted, and no other kind, when the caller's signal aborts", async () => {
    const { api, t } = make("never");
    const controller = new AbortController();
    const pending = fail(get(api, { signal: controller.signal }));
    await Promise.resolve();
    controller.abort();
    expect((await pending).kind).toBe("aborted");
    expect(t.cancels()).toBe(1);
  });

  it("does not send a request when the signal is already aborted", async () => {
    const { api, fetch } = make();
    const controller = new AbortController();
    controller.abort();
    expect((await fail(get(api, { signal: controller.signal }))).kind).toBe(
      "aborted",
    );
    expect(fetch.calls).toHaveLength(0);
  });

  it("uses requestTimeoutMs, a call's timeoutMs once, and ignores a bad timeoutMs", async () => {
    const { api, t } = make(() => json({ ok: true }), {
      requestTimeoutMs: 8_000,
    });
    await get(api);
    await get(api, { timeoutMs: 75_000 });
    await get(api);
    for (const bad of [0, -1, Number.NaN, Infinity])
      await get(api, { timeoutMs: bad });
    expect(t.delays()).toEqual([
      8_000, 75_000, 8_000, 8_000, 8_000, 8_000, 8_000,
    ]);
  });

  it("sends each request once and does not retry", async () => {
    const { api, fetch } = make([new Error("fails once"), json({ ok: true })]);
    await fail(get(api));
    expect(fetch.calls).toHaveLength(1);
  });
});

describe("unauthenticated answers (R7)", () => {
  const unauth = (code: string, status = 401) =>
    json({ error: { code, message: "m" } }, status);

  it("calls the hook once for each of the three codes, and the request still rejects", async () => {
    const seen: string[] = [];
    const { api } = make(
      [
        unauth("unauthenticated"),
        unauth("session_ended"),
        unauth("account_deactivated"),
      ],
      { onUnauthenticated: (code) => seen.push(code) },
    );
    for (const code of [
      "unauthenticated",
      "session_ended",
      "account_deactivated",
    ]) {
      const error = await fail(get(api));
      expect(error.kind).toBe("http");
      expect(error.code).toBe(code);
    }
    expect(seen).toEqual([
      "unauthenticated",
      "session_ended",
      "account_deactivated",
    ]);
  });

  it("does not call it for another code, another status or a good answer", async () => {
    const seen: string[] = [];
    const { api } = make(
      [
        unauth("invalid_code"),
        unauth("unauthenticated", 403),
        json({ error: { code: "internal_error", message: "m" } }, 500),
        json({ ok: true }),
      ],
      { onUnauthenticated: (code) => seen.push(code) },
    );
    await fail(get(api));
    await fail(get(api));
    await fail(get(api));
    await get(api);
    expect(seen).toEqual([]);
  });

  it("leaves the rejection as the ApiError when the hook throws", async () => {
    const { api } = make(() => unauth("session_ended"), {
      onUnauthenticated: () => {
        throw new Error("boom");
      },
    });
    const error = await fail(get(api));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("session_ended");
  });

  it("calls a hook set later with setOnUnauthenticated, and null removes it", async () => {
    const { api } = make(() => unauth("session_ended"));
    const seen: string[] = [];
    api.setOnUnauthenticated((code) => seen.push(code));
    await fail(get(api));
    api.setOnUnauthenticated(null);
    await fail(get(api));
    expect(seen).toEqual(["session_ended"]);
  });
});
