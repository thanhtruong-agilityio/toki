import { describe, expect, it, vi } from "vitest";
import { createSignInCalls, type ApiRequest, type ApiResult } from "./sign-in";

const user = {
  id: "u1",
  email: "ada@example.com",
  displayName: "Ada",
  role: "member",
  language: "en",
};

const http = (
  status: number,
  code: string | null,
  details?: Record<string, unknown>,
): ApiResult => ({ ok: false, kind: "http", status, code, details });
const ok = (data: unknown, status = 200): ApiResult => ({
  ok: true,
  status,
  data,
});

function calls(result: ApiResult) {
  const api = vi.fn<ApiRequest>().mockResolvedValue(result);
  return { api, calls: createSignInCalls(api) };
}

describe("requestCode: POST /auth/codes (R7, R12, R13, R19, R21, R22, R37)", () => {
  it("sends the address and returns the three values of a 200", async () => {
    const { api, calls: c } = calls(
      ok({ requestId: "r1", expiresInSeconds: 600, resendAfterSeconds: 60 }),
    );
    expect(await c.requestCode("ada@example.com")).toEqual({
      kind: "ok",
      requestId: "r1",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/auth/codes", {
      method: "POST",
      body: { email: "ada@example.com" },
    });
  });

  it("a 200 body that does not fit is the general failure", async () => {
    for (const data of [
      undefined,
      null,
      {},
      { requestId: "r", expiresInSeconds: 600 },
      { requestId: 1, expiresInSeconds: 600, resendAfterSeconds: 60 },
    ]) {
      expect(await calls(ok(data)).calls.requestCode("a@example.com")).toEqual({
        kind: "failed",
      });
    }
  });

  it("400 validation_failed is invalid", async () => {
    expect(
      await calls(http(400, "validation_failed")).calls.requestCode("x"),
    ).toEqual({ kind: "invalid" });
  });

  it("429 code_request_limit carries retryAfterSeconds", async () => {
    expect(
      await calls(
        http(429, "code_request_limit", { retryAfterSeconds: 720 }),
      ).calls.requestCode("a@example.com"),
    ).toEqual({ kind: "limit", retryAfterSeconds: 720 });
  });

  it("429 code_resend_too_soon carries retryAfterSeconds", async () => {
    expect(
      await calls(
        http(429, "code_resend_too_soon", { retryAfterSeconds: 12 }),
      ).calls.requestCode("a@example.com"),
    ).toEqual({ kind: "tooSoon", retryAfterSeconds: 12 });
  });

  it("429 rate_limited reads as the limit of the API spec", async () => {
    expect(
      await calls(
        http(429, "rate_limited", { retryAfterSeconds: 90 }),
      ).calls.requestCode("a@example.com"),
    ).toEqual({ kind: "limit", retryAfterSeconds: 90 });
  });

  it("a limit with no number is the general failure", async () => {
    expect(
      await calls(http(429, "code_request_limit")).calls.requestCode("a@b.co"),
    ).toEqual({ kind: "failed" });
  });

  it.each([
    [http(500, "internal_error")],
    [http(403, "origin_not_allowed")],
    [http(415, "unsupported_media_type")],
    [http(418, "something_new")],
    [http(502, null)],
    [{ ok: false, kind: "invalid_response" } as ApiResult],
  ])("%j is the general failure (R22)", async (result) => {
    expect(await calls(result).calls.requestCode("a@example.com")).toEqual({
      kind: "failed",
    });
  });

  it.each(["network", "timeout"] as const)(
    "%s is network (R21)",
    async (kind) => {
      expect(
        await calls({ ok: false, kind }).calls.requestCode("a@example.com"),
      ).toEqual({ kind: "network" });
    },
  );

  it("a rejected api is the general failure, not a throw", async () => {
    const c = createSignInCalls(
      vi.fn<ApiRequest>().mockRejectedValue(new Error("x")),
    );
    expect(await c.requestCode("a@example.com")).toEqual({ kind: "failed" });
  });
});

describe("submitCode: POST /auth/sessions (R11, R16 to R22)", () => {
  const input = { requestId: "r1", code: "123456" };

  it("sends the requestId and the digits and returns the user of a 200", async () => {
    const { api, calls: c } = calls(ok({ user }));
    expect(await c.submitCode(input)).toEqual({ kind: "ok", user });
    expect(api).toHaveBeenCalledWith("/auth/sessions", {
      method: "POST",
      body: { requestId: "r1", code: "123456" },
    });
  });

  it("drops a field of the user it does not know", async () => {
    const res = await calls(
      ok({ user: { ...user, extra: 1 } }),
    ).calls.submitCode(input);
    expect(res).toEqual({ kind: "ok", user });
  });

  it("a 200 with no readable user is the general failure", async () => {
    for (const data of [
      {},
      { user: { ...user, role: "boss" } },
      { user: null },
    ]) {
      expect(await calls(ok(data)).calls.submitCode(input)).toEqual({
        kind: "failed",
      });
    }
  });

  it("400 code_incorrect carries triesLeft", async () => {
    expect(
      await calls(
        http(400, "code_incorrect", { triesLeft: 4 }),
      ).calls.submitCode(input),
    ).toEqual({ kind: "incorrect", triesLeft: 4 });
  });

  it("400 code_incorrect with no number is the general failure", async () => {
    expect(
      await calls(http(400, "code_incorrect")).calls.submitCode(input),
    ).toEqual({
      kind: "failed",
    });
  });

  it.each([
    ["code_locked", { kind: "locked" }],
    ["code_expired", { kind: "expired" }],
    ["account_deactivated", { kind: "deactivated" }],
    ["validation_failed", { kind: "failed" }],
  ])("400 %s", async (code, expected) => {
    expect(await calls(http(400, code)).calls.submitCode(input)).toEqual(
      expected,
    );
  });

  it.each([
    [http(500, "internal_error")],
    [http(403, "origin_not_allowed")],
    [http(415, "unsupported_media_type")],
    [http(429, "rate_limited", { retryAfterSeconds: 5 })],
    [http(400, "never_heard_of_it")],
    [{ ok: false, kind: "invalid_response" } as ApiResult],
  ])("%j is the general failure", async (result) => {
    expect(await calls(result).calls.submitCode(input)).toEqual({
      kind: "failed",
    });
  });

  it.each(["network", "timeout"] as const)("%s is network", async (kind) => {
    expect(await calls({ ok: false, kind }).calls.submitCode(input)).toEqual({
      kind: "network",
    });
  });
});

describe("readSession: GET /auth/session (R1, R2, R26)", () => {
  it("200 gives the user", async () => {
    const { api, calls: c } = calls(ok({ user }));
    expect(await c.readSession()).toEqual({ kind: "ok", user });
    expect(api).toHaveBeenCalledWith("/auth/session", { method: "GET" });
  });

  it.each(["unauthenticated", "session_ended", "account_deactivated"])(
    "401 %s gives the code",
    async (code) => {
      expect(await calls(http(401, code)).calls.readSession()).toEqual({
        kind: "unauthenticated",
        code,
      });
    },
  );

  it("any other answer is failed, and no connection is network", async () => {
    expect(
      await calls(http(500, "internal_error")).calls.readSession(),
    ).toEqual({ kind: "failed" });
    expect(await calls(http(401, "other")).calls.readSession()).toEqual({
      kind: "failed",
    });
    expect(await calls(ok({})).calls.readSession()).toEqual({ kind: "failed" });
    expect(
      await calls({ ok: false, kind: "invalid_response" }).calls.readSession(),
    ).toEqual({ kind: "failed" });
    expect(
      await calls({ ok: false, kind: "timeout" }).calls.readSession(),
    ).toEqual({ kind: "network" });
  });
});

describe("readWorkspaceName: GET /auth/workspace (R38)", () => {
  it("200 gives the name", async () => {
    const { api, calls: c } = calls(ok({ name: "Acme" }));
    expect(await c.readWorkspaceName()).toBe("Acme");
    expect(api).toHaveBeenCalledWith("/auth/workspace", { method: "GET" });
  });

  it("any failure or a body that does not fit gives null, with no throw", async () => {
    for (const result of [
      http(500, "internal_error"),
      http(401, "unauthenticated"),
      { ok: false, kind: "network" } as ApiResult,
      { ok: false, kind: "timeout" } as ApiResult,
      { ok: false, kind: "invalid_response" } as ApiResult,
      ok({}),
      ok({ name: 5 }),
    ]) {
      expect(await calls(result).calls.readWorkspaceName()).toBeNull();
    }
    const c = createSignInCalls(
      vi.fn<ApiRequest>().mockRejectedValue(new Error("x")),
    );
    expect(await c.readWorkspaceName()).toBeNull();
  });
});

describe("the calls change no session state (R43)", () => {
  it("a 401 through the calls leaves the store untouched", async () => {
    const { getSessionState } = await import("./session-store");
    const before = getSessionState();
    await calls(http(401, "session_ended")).calls.readSession();
    expect(getSessionState()).toBe(before);
  });
});
