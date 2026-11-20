import { describe, expect, it } from "vitest";
import {
  CODE_IP_REQUESTS_MAX,
  CODE_LENGTH,
  CODE_MAX_WRONG_TRIES,
  CODE_REQUESTS_MAX,
  CODE_REQUESTS_WINDOW_SECONDS,
  CODE_RESEND_SECONDS,
  CODE_TTL_SECONDS,
  CreateSessionBodySchema,
  CreateSessionResponseSchema,
  BROWSERS,
  DEVICE_KINDS,
  EMERGENCY_LINK_TTL_SECONDS,
  EmergencyBodySchema,
  EmergencyResponseSchema,
  ErrorCodes,
  RequestCodeResponseSchema,
  SESSION_IDLE_DAYS,
  SessionItemSchema,
  SessionsResponseSchema,
  UserSchema,
} from "../../src/index.js";

describe("limits (R38)", () => {
  it("holds the numbers of the spec", () => {
    expect([
      CODE_LENGTH,
      CODE_TTL_SECONDS,
      CODE_MAX_WRONG_TRIES,
      CODE_REQUESTS_MAX,
      CODE_REQUESTS_WINDOW_SECONDS,
      CODE_RESEND_SECONDS,
      CODE_IP_REQUESTS_MAX,
      SESSION_IDLE_DAYS,
    ]).toEqual([6, 600, 5, 5, 900, 60, 20, 30]);
  });
});

describe("schemas (R38)", () => {
  const user = {
    id: "1",
    email: "sam@example.com",
    displayName: "Sam",
    role: "member",
    language: "en",
  };
  it("parses the shapes of the API table", () => {
    expect(
      RequestCodeResponseSchema.parse({
        requestId: "x",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }).expiresInSeconds,
    ).toBe(600);
    expect(CreateSessionResponseSchema.parse({ user, token: "t" }).token).toBe(
      "t",
    );
    expect(
      CreateSessionBodySchema.parse({ requestId: "r", code: "012345" }).code,
    ).toBe("012345");
  });
  it("refuses a code that is not 6 digits and a missing requestId", () => {
    for (const code of ["12345", "1234567", "12345a", ""]) {
      expect(
        CreateSessionBodySchema.safeParse({ requestId: "r", code }).success,
      ).toBe(false);
    }
    expect(CreateSessionBodySchema.safeParse({ code: "123456" }).success).toBe(
      false,
    );
  });
  it("does not reject a field added to User", () => {
    expect(UserSchema.safeParse({ ...user, extra: 1 }).success).toBe(true);
  });
});

describe("error registry (R54)", () => {
  it("holds the codes of the sign-in API", () => {
    const values = Object.values(ErrorCodes);
    for (const code of [
      "code_request_limit",
      "code_resend_too_soon",
      "code_incorrect",
      "code_locked",
      "code_expired",
      "account_deactivated",
      "unauthenticated",
      "session_ended",
      "origin_not_allowed",
      "unsupported_media_type",
      "rate_limited",
      "current_session",
      "emergency_link_invalid",
    ]) {
      expect(values).toContain(code);
    }
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("emergency link and session list contracts (TOKI-026 R24, R37)", () => {
  const token = "A".repeat(43);
  const user = {
    id: "1",
    email: "sam@example.com",
    displayName: "Sam",
    role: "member",
    language: "en",
  };

  it("holds the 10 minutes of a link", () => {
    expect(EMERGENCY_LINK_TTL_SECONDS).toBe(600);
  });

  it("holds the closed value lists of a row", () => {
    expect([...DEVICE_KINDS]).toEqual([
      "desktop",
      "phone",
      "tablet",
      "unknown",
    ]);
    expect([...BROWSERS]).toEqual([
      "chrome",
      "edge",
      "safari",
      "firefox",
      "other",
      "unknown",
    ]);
  });

  it("parses a list of sessions with the five fields", () => {
    const item = {
      id: "0190f6a0-0000-7000-8000-000000000000",
      current: true,
      deviceKind: "desktop",
      browser: "chrome",
      lastUsedAt: "2026-11-19T07:00:00.000Z",
    };
    expect(SessionItemSchema.parse(item)).toEqual(item);
    expect(
      SessionsResponseSchema.parse({ sessions: [item] }).sessions,
    ).toHaveLength(1);
  });

  it("accepts a 43-character base64url token and nothing else", () => {
    expect(EmergencyBodySchema.safeParse({ token }).success).toBe(true);
    expect(
      EmergencyBodySchema.safeParse({ token: "a-_Z09".repeat(7) + "a" })
        .success,
    ).toBe(true);
    for (const bad of [
      "A".repeat(42),
      "A".repeat(44),
      "A".repeat(42) + "+",
      "A".repeat(42) + "=",
      "A".repeat(42) + "/",
      "",
    ]) {
      expect(EmergencyBodySchema.safeParse({ token: bad }).success).toBe(false);
    }
  });

  it("takes an optional transport of the sign-in API", () => {
    expect(
      EmergencyBodySchema.parse({ token, transport: "token" }).transport,
    ).toBe("token");
    expect(
      EmergencyBodySchema.safeParse({ token, transport: "x" }).success,
    ).toBe(false);
  });

  it("parses the answer with and without a token", () => {
    expect(EmergencyResponseSchema.parse({ user }).token).toBeUndefined();
    expect(EmergencyResponseSchema.parse({ user, token: "t" }).token).toBe("t");
  });
});
