import { ErrorResponseSchema } from "@toki/shared";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildApp } from "../../src/app.js";
import type { Config } from "../../src/config.js";
import { AppError } from "../../src/errors.js";

const config: Config = {
  server: {
    env: "development",
    port: 3000,
    host: "127.0.0.1",
    logLevel: "info",
  },
  database: { url: "postgres://fake:fake@127.0.0.1:1/fake" },
};

function capture() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(chunk.toString());
      done();
    },
  });
  return {
    stream,
    text: () => chunks.join(""),
    lines: () =>
      chunks
        .join("")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

async function setup(level: Config["server"]["logLevel"] = "info") {
  const log = capture();
  const app = buildApp({
    config: { ...config, server: { ...config.server, logLevel: level } },
    logStream: log.stream,
    registerRoutes: (scope) => {
      scope.get("/ok", async () => ({ ok: true }));
      scope.get("/boom", async () => {
        throw new Error("boom-internal-detail");
      });
      scope.get("/app-error", async () => {
        throw new AppError(409, "conflict_test", "A test conflict.", {
          field: "x",
        });
      });
      scope.get("/validate", async (request) =>
        z.object({ n: z.coerce.number() }).parse(request.query),
      );
      scope.get(
        "/schema",
        { schema: { querystring: { type: "object", required: ["x"] } } },
        async () => ({ ok: true }),
      );
      scope.get("/status/:code", async (request) => {
        const code = Number((request.params as { code: string }).code);
        throw Object.assign(new Error("raised by a plugin"), {
          statusCode: code,
        });
      });
      scope.post("/echo", async (request) => ({ body: request.body }));
    },
  });
  await app.ready();
  return { app, log };
}

function expectErrorBody(body: string, code: string) {
  const parsed = ErrorResponseSchema.parse(JSON.parse(body));
  expect(parsed.error.code).toBe(code);
  return parsed.error;
}

describe("health (R5)", () => {
  it("answers 200 and ok without a database", async () => {
    const { app } = await setup();
    const response = await app.inject({ url: "/healthz" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("prefix (R10)", () => {
  it("serves a registered route under /api/v1 and not without it", async () => {
    const { app } = await setup();
    expect((await app.inject({ url: "/api/v1/ok" })).statusCode).toBe(200);
    expect((await app.inject({ url: "/ok" })).statusCode).toBe(404);
  });

  it("refuses to register a route outside /api/v1 other than /healthz", () => {
    const app = buildApp({ config });
    expect(() => app.get("/outside", async () => ({}))).toThrow(/\/api\/v1/);
  });
});

describe("error format (R8, R9, R12)", () => {
  it("unknown path: 404 not_found", async () => {
    const { app } = await setup();
    const response = await app.inject({ url: "/api/v1/nope" });
    expect(response.statusCode).toBe(404);
    expectErrorBody(response.body, "not_found");
  });

  it("failed validation: 400 validation_failed, no submitted value in details", async () => {
    const { app } = await setup();
    const zod = await app.inject({ url: "/api/v1/validate?n=secret-value-1" });
    expect(zod.statusCode).toBe(400);
    const error = expectErrorBody(zod.body, "validation_failed");
    expect(error.details).toEqual({
      issues: [{ path: ["n"], code: "invalid_type" }],
    });
    expect(zod.body).not.toContain("secret-value-1");

    const schema = await app.inject({ url: "/api/v1/schema" });
    expect(schema.statusCode).toBe(400);
    expectErrorBody(schema.body, "validation_failed");
  });

  it("AppError: its status, code, message and details", async () => {
    const { app } = await setup();
    const response = await app.inject({ url: "/api/v1/app-error" });
    expect(response.statusCode).toBe(409);
    expect(expectErrorBody(response.body, "conflict_test")).toEqual({
      code: "conflict_test",
      message: "A test conflict.",
      details: { field: "x" },
    });
  });

  it("Fastify 4xx: malformed JSON, oversized body, unsupported media type", async () => {
    const { app } = await setup();
    const json = { "content-type": "application/json" };
    const malformed = await app.inject({
      method: "POST",
      url: "/api/v1/echo",
      headers: json,
      payload: "{bad",
    });
    expect(malformed.statusCode).toBe(400);
    expectErrorBody(malformed.body, "bad_request");

    const large = await app.inject({
      method: "POST",
      url: "/api/v1/echo",
      headers: json,
      payload: JSON.stringify({ a: "x".repeat(1_200_000) }),
    });
    expect(large.statusCode).toBe(413);
    expectErrorBody(large.body, "payload_too_large");

    const media = await app.inject({
      method: "POST",
      url: "/api/v1/echo",
      headers: { "content-type": "application/xml" },
      payload: "<a/>",
    });
    expect(media.statusCode).toBe(415);
    expectErrorBody(media.body, "unsupported_media_type");
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "too_many_requests"],
    [418, "bad_request"],
  ])(
    "a %i raised by a plugin keeps its status and gets %s (concern 19)",
    async (status, code) => {
      const { app } = await setup();
      const response = await app.inject({ url: `/api/v1/status/${status}` });
      expect(response.statusCode).toBe(status);
      expectErrorBody(response.body, code);
      expect(response.body).not.toContain("raised by a plugin");
    },
  );

  it("malformed URL: 400 bad_request in the one format", async () => {
    const { app } = await setup();
    const response = await app.inject({ url: "/api/v1/%zz" });
    expect(response.statusCode).toBe(400);
    expectErrorBody(response.body, "bad_request");
  });

  it("unexpected error: 500 internal_error with only the request id", async () => {
    const { app, log } = await setup();
    const response = await app.inject({ url: "/api/v1/boom" });
    expect(response.statusCode).toBe(500);
    const error = expectErrorBody(response.body, "internal_error");
    expect(response.body).not.toContain("boom-internal-detail");
    expect(response.body).not.toMatch(/\bat\s.+\(.+:\d+:\d+\)/);
    const requestId = (error.details as { requestId: string }).requestId;
    expect(Object.keys(error.details as object)).toEqual(["requestId"]);
    // The error, its stack and the request id are in the log.
    expect(log.text()).toContain("boom-internal-detail");
    expect(log.text()).toContain(requestId);
  });

  it("does not translate the message (R12)", async () => {
    const { app } = await setup();
    const vi = await app.inject({
      url: "/api/v1/nope",
      headers: { "accept-language": "vi" },
    });
    const en = await app.inject({
      url: "/api/v1/nope",
      headers: { "accept-language": "en" },
    });
    expect(vi.json()).toEqual(en.json());
  });
});

describe("logs (R6, R7)", () => {
  it("writes JSON lines, one completion line per request with only the allowed fields", async () => {
    const { app, log } = await setup();
    await app.inject({ url: "/api/v1/ok?token=query-secret-1" });
    const completion = log.lines().filter((l) => l.msg === "request completed");
    expect(completion).toHaveLength(1);
    const line = completion[0]!;
    expect(line).toMatchObject({
      method: "GET",
      path: "/api/v1/ok",
      status: 200,
    });
    expect(typeof line.durationMs).toBe("number");
    expect(typeof line.reqId).toBe("string");
    expect(Object.keys(line).sort()).toEqual(
      [
        "durationMs",
        "hostname",
        "level",
        "method",
        "msg",
        "path",
        "pid",
        "reqId",
        "status",
        "time",
      ].sort(),
    );
  });

  it("never logs headers, the query string or the body", async () => {
    const { app, log } = await setup();
    await app.inject({
      method: "POST",
      url: "/api/v1/echo?code=query-secret-2",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer header-secret-1",
        cookie: "sid=cookie-secret-1",
      },
      payload: JSON.stringify({ email: "body-secret@example.test" }),
    });
    await app.inject({
      url: "/api/v1/boom?code=query-secret-3",
      headers: { authorization: "header-secret-2" },
    });
    const text = log.text();
    for (const secret of [
      "query-secret-2",
      "query-secret-3",
      "header-secret-1",
      "header-secret-2",
      "cookie-secret-1",
      "body-secret@example.test",
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("writes the /healthz line at debug, hidden at the default level", async () => {
    const info = await setup("info");
    await info.app.inject({ url: "/healthz" });
    expect(info.log.text()).not.toContain("request completed");

    const debug = await setup("debug");
    await debug.app.inject({ url: "/healthz" });
    expect(
      debug.log
        .lines()
        .some((l) => l.msg === "request completed" && l.level === 20),
    ).toBe(true);
  });
});
