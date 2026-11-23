import { describe, expect, it, vi } from "vitest";
import {
  createInvitationCalls,
  type ApiRequest,
  type ApiResult,
} from "./invitation";

const TOKEN = "T".repeat(43);
const user = {
  id: "u1",
  email: "sam@example.com",
  displayName: "sam",
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
  return { api, calls: createInvitationCalls(api) };
}

describe("lookupInvitation: POST /invitations/lookup (R1, R2, R49)", () => {
  it("sends the token in the body only, never in the path or a query", async () => {
    const { api, calls: c } = calls(ok({ state: "unknown" }));
    await c.lookupInvitation(TOKEN);
    expect(api).toHaveBeenCalledTimes(1);
    const [path, init] = api.mock.calls[0]!;
    expect(path).toBe("/invitations/lookup");
    expect(path).not.toContain(TOKEN);
    expect(init).toEqual({ method: "POST", body: { token: TOKEN } });
  });

  it("returns each of the five states with its fields", async () => {
    const answers = [
      {
        state: "pending",
        email: "sam@example.com",
        workspaceName: "Acme",
        codeExpiresInSeconds: 600,
        resendAfterSeconds: 60,
      },
      { state: "expired", workspaceName: "Acme" },
      { state: "revoked", workspaceName: "Acme" },
      { state: "used", email: "sam@example.com" },
      { state: "unknown" },
    ];
    for (const lookup of answers) {
      expect(await calls(ok(lookup)).calls.lookupInvitation(TOKEN)).toEqual({
        kind: "ok",
        lookup,
      });
    }
  });

  it("ignores a field added later, and drops it", async () => {
    const out = await calls(
      ok({ state: "expired", workspaceName: "Acme", later: 1 }),
    ).calls.lookupInvitation(TOKEN);
    expect(out).toEqual({
      kind: "ok",
      lookup: { state: "expired", workspaceName: "Acme" },
    });
  });

  it("a 200 body that does not fit is the general failure", async () => {
    for (const data of [
      undefined,
      null,
      {},
      { state: "other" },
      { state: "pending", email: "a@b.c" },
      {
        state: "pending",
        email: 1,
        workspaceName: "A",
        codeExpiresInSeconds: 1,
        resendAfterSeconds: 1,
      },
      { state: "used" },
      { state: "expired" },
    ]) {
      expect(await calls(ok(data)).calls.lookupInvitation(TOKEN)).toEqual({
        kind: "failed",
      });
    }
  });

  it("400 validation_failed is invalid; other answers fail; no answer is network", async () => {
    expect(
      await calls(http(400, "validation_failed")).calls.lookupInvitation(TOKEN),
    ).toEqual({ kind: "invalid" });
    expect(
      await calls(http(500, "internal_error")).calls.lookupInvitation(TOKEN),
    ).toEqual({ kind: "failed" });
    expect(
      await calls({
        ok: false,
        kind: "invalid_response",
      }).calls.lookupInvitation(TOKEN),
    ).toEqual({ kind: "failed" });
    for (const kind of ["network", "timeout"] as const) {
      expect(
        await calls({ ok: false, kind }).calls.lookupInvitation(TOKEN),
      ).toEqual({ kind: "network" });
    }
  });

  it("an api that rejects is the general failure", async () => {
    const c = createInvitationCalls(() => Promise.reject(new Error("x")));
    expect(await c.lookupInvitation(TOKEN)).toEqual({ kind: "failed" });
  });
});

describe("resendInvitationCode: POST /invitations/codes (R6, R30, R49)", () => {
  it("sends the token in the body and returns the two waits of a 200", async () => {
    const { api, calls: c } = calls(
      ok({ expiresInSeconds: 600, resendAfterSeconds: 60 }),
    );
    expect(await c.resendInvitationCode(TOKEN)).toEqual({
      kind: "ok",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    expect(api).toHaveBeenCalledWith("/invitations/codes", {
      method: "POST",
      body: { token: TOKEN },
    });
  });

  it("429 code_resend_too_soon is tooSoon and code_request_limit is limit, with the wait", async () => {
    expect(
      await calls(
        http(429, "code_resend_too_soon", { retryAfterSeconds: 12 }),
      ).calls.resendInvitationCode(TOKEN),
    ).toEqual({ kind: "tooSoon", retryAfterSeconds: 12 });
    expect(
      await calls(
        http(429, "code_request_limit", { retryAfterSeconds: 600 }),
      ).calls.resendInvitationCode(TOKEN),
    ).toEqual({ kind: "limit", retryAfterSeconds: 600 });
    // a 429 without a wait cannot be shown
    expect(
      await calls(http(429, "code_request_limit")).calls.resendInvitationCode(
        TOKEN,
      ),
    ).toEqual({ kind: "failed" });
  });

  it("409 and 404 say which state the link is in", async () => {
    const cases: [number, string, string][] = [
      [409, "invitation_used", "used"],
      [409, "invitation_revoked", "revoked"],
      [409, "invitation_expired", "expired"],
      [404, "invitation_not_found", "unknown"],
    ];
    for (const [status, code, state] of cases) {
      expect(
        await calls(http(status, code)).calls.resendInvitationCode(TOKEN),
      ).toEqual({ kind: "closed", state });
    }
  });

  it("a bad 200, a 500 and no answer", async () => {
    expect(
      await calls(ok({ expiresInSeconds: 600 })).calls.resendInvitationCode(
        TOKEN,
      ),
    ).toEqual({ kind: "failed" });
    expect(
      await calls(http(500, null)).calls.resendInvitationCode(TOKEN),
    ).toEqual({ kind: "failed" });
    expect(
      await calls({ ok: false, kind: "network" }).calls.resendInvitationCode(
        TOKEN,
      ),
    ).toEqual({ kind: "network" });
  });
});

describe("acceptInvitation: POST /invitations/sessions (R10, R31, R49)", () => {
  it("sends the token and the digits in the body and returns the user and #general", async () => {
    const { api, calls: c } = calls(ok({ user, generalConversationId: "c1" }));
    expect(await c.acceptInvitation(TOKEN, "123456")).toEqual({
      kind: "ok",
      user,
      generalConversationId: "c1",
    });
    expect(api).toHaveBeenCalledWith("/invitations/sessions", {
      method: "POST",
      body: { token: TOKEN, code: "123456" },
    });
    expect(api.mock.calls[0]![0]).not.toContain(TOKEN);
  });

  it("maps the three code answers", async () => {
    expect(
      await calls(
        http(400, "code_incorrect", { triesLeft: 3 }),
      ).calls.acceptInvitation(TOKEN, "000000"),
    ).toEqual({ kind: "incorrect", triesLeft: 3 });
    expect(
      await calls(http(400, "code_incorrect")).calls.acceptInvitation(
        TOKEN,
        "0",
      ),
    ).toEqual({ kind: "failed" });
    expect(
      await calls(http(400, "code_locked")).calls.acceptInvitation(TOKEN, "0"),
    ).toEqual({ kind: "locked" });
    expect(
      await calls(http(400, "code_expired")).calls.acceptInvitation(TOKEN, "0"),
    ).toEqual({ kind: "expired" });
  });

  it("409 and 404 say which state the link is in (the code answers are not mixed up with them)", async () => {
    const cases: [number, string, string][] = [
      [409, "invitation_used", "used"],
      [409, "invitation_revoked", "revoked"],
      [409, "invitation_expired", "expired"],
      [404, "invitation_not_found", "unknown"],
    ];
    for (const [status, code, state] of cases) {
      expect(
        await calls(http(status, code)).calls.acceptInvitation(TOKEN, "123456"),
      ).toEqual({ kind: "closed", state });
    }
  });

  it("a 500 or a bad 200 is failed; no answer is network; a 401 is failed too (none is expected)", async () => {
    expect(
      await calls(http(500, "internal_error")).calls.acceptInvitation(
        TOKEN,
        "1",
      ),
    ).toEqual({ kind: "failed" });
    for (const data of [
      {},
      { user },
      { user: {}, generalConversationId: "c" },
      null,
    ]) {
      expect(await calls(ok(data)).calls.acceptInvitation(TOKEN, "1")).toEqual({
        kind: "failed",
      });
    }
    expect(
      await calls(http(401, "unauthenticated")).calls.acceptInvitation(
        TOKEN,
        "1",
      ),
    ).toEqual({ kind: "failed" });
    expect(
      await calls({ ok: false, kind: "timeout" }).calls.acceptInvitation(
        TOKEN,
        "1",
      ),
    ).toEqual({ kind: "network" });
  });
});
