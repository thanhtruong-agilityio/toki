import { describe, expect, it, vi } from "vitest";
import { createEmergencyCalls } from "./emergency";
import type { ApiRequest, ApiResult } from "./sign-in";

const TOKEN = "A".repeat(43);
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
const ok = (data: unknown): ApiResult => ({ ok: true, status: 200, data });

function calls(result: ApiResult) {
  const api = vi.fn<ApiRequest>().mockResolvedValue(result);
  return { api, calls: createEmergencyCalls(api) };
}

describe("signInWithLink: POST /auth/emergency-sessions (TOKI-026 R26, R45)", () => {
  it("posts the token in the body only and returns the user of a 200", async () => {
    const { api, calls: c } = calls(ok({ user }));
    expect(await c.signInWithLink(TOKEN)).toEqual({ kind: "ok", user });
    expect(api).toHaveBeenCalledTimes(1);
    const [path, init] = api.mock.calls[0]!;
    expect(path).toBe("/auth/emergency-sessions");
    expect(path).not.toContain(TOKEN);
    expect(init).toEqual({
      method: "POST",
      body: { token: TOKEN, transport: "cookie" },
    });
  });

  it("sends the transport it is given", async () => {
    const { api, calls: c } = calls(ok({ user, token: "t" }));
    await c.signInWithLink(TOKEN, "token");
    expect(api.mock.calls[0]![1].body).toEqual({
      token: TOKEN,
      transport: "token",
    });
  });

  it("reads a 200 that does not fit the shared schema as failed", async () => {
    expect(await calls(ok({ nope: 1 })).calls.signInWithLink(TOKEN)).toEqual({
      kind: "failed",
    });
  });

  it("reads emergency_link_invalid and validation_failed as invalid", async () => {
    for (const code of ["emergency_link_invalid", "validation_failed"]) {
      expect(await calls(http(400, code)).calls.signInWithLink(TOKEN)).toEqual({
        kind: "invalid",
      });
    }
  });

  it("reads account_deactivated as deactivated", async () => {
    expect(
      await calls(http(400, "account_deactivated")).calls.signInWithLink(TOKEN),
    ).toEqual({ kind: "deactivated" });
  });

  it("reads rate_limited with the wait", async () => {
    expect(
      await calls(
        http(429, "rate_limited", { retryAfterSeconds: 61 }),
      ).calls.signInWithLink(TOKEN),
    ).toEqual({ kind: "rateLimited", retryAfterSeconds: 61 });
  });

  it("reads rate_limited with no usable wait as a failure the person can retry", async () => {
    expect(
      await calls(http(429, "rate_limited")).calls.signInWithLink(TOKEN),
    ).toEqual({ kind: "failed" });
  });

  it("reads network and timeout as network, and any other answer as failed", async () => {
    for (const kind of ["network", "timeout"] as const) {
      expect(
        await calls({ ok: false, kind }).calls.signInWithLink(TOKEN),
      ).toEqual({ kind: "network" });
    }
    expect(await calls(http(500, null)).calls.signInWithLink(TOKEN)).toEqual({
      kind: "failed",
    });
    expect(
      await calls({ ok: false, kind: "invalid_response" }).calls.signInWithLink(
        TOKEN,
      ),
    ).toEqual({ kind: "failed" });
  });

  it("answers failed when the api rejects", async () => {
    const api = vi.fn<ApiRequest>().mockRejectedValue(new Error("boom"));
    expect(await createEmergencyCalls(api).signInWithLink(TOKEN)).toEqual({
      kind: "failed",
    });
  });
});
