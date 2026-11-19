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
  ErrorCodes,
  RequestCodeResponseSchema,
  SESSION_IDLE_DAYS,
  UserSchema,
} from "../index.js";

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
    ]) {
      expect(values).toContain(code);
    }
    expect(new Set(values).size).toBe(values.length);
  });
});
