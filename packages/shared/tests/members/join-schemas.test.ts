import { describe, expect, it } from "vitest";
import {
  AcceptInvitationBodySchema,
  AcceptInvitationResponseSchema,
  InvitationLookupBodySchema,
  InvitationLookupResponseSchema,
  ResendInvitationCodeBodySchema,
  ResendInvitationCodeResponseSchema,
} from "../../src/members/join-schemas.js";

const user = {
  id: "u1",
  email: "sam@example.com",
  displayName: "sam",
  role: "member",
  language: "en",
};

describe("join request bodies (R2, R13, R24)", () => {
  it("takes a token that is any string, so the server can answer `unknown` for a wrong shape", () => {
    expect(InvitationLookupBodySchema.safeParse({ token: "x" }).success).toBe(
      true,
    );
    expect(
      ResendInvitationCodeBodySchema.safeParse({ token: "x" }).success,
    ).toBe(true);
  });

  it("refuses a missing or non-string token", () => {
    for (const body of [{}, { token: 1 }, { token: null }, null, "x"]) {
      expect(InvitationLookupBodySchema.safeParse(body).success).toBe(false);
      expect(ResendInvitationCodeBodySchema.safeParse(body).success).toBe(
        false,
      );
    }
    for (const token of [undefined, 1, null, {}]) {
      expect(
        AcceptInvitationBodySchema.safeParse({ token, code: "123456" }).success,
      ).toBe(false);
    }
  });

  it("takes exactly 6 digits as the code of an accept", () => {
    const ok = (code: unknown) =>
      AcceptInvitationBodySchema.safeParse({ token: "t", code }).success;
    expect(ok("123456")).toBe(true);
    for (const bad of ["12345", "1234567", "12345a", " 12345", 123456, null]) {
      expect(ok(bad)).toBe(false);
    }
    expect(
      AcceptInvitationBodySchema.safeParse({ code: "123456" }).success,
    ).toBe(false);
  });
});

describe("lookup answer (R1)", () => {
  it("has the fields of each state and no other", () => {
    const parse = (value: unknown) =>
      InvitationLookupResponseSchema.safeParse(value);
    expect(
      parse({
        state: "pending",
        email: "sam@example.com",
        workspaceName: "Acme",
        codeExpiresInSeconds: 600,
        resendAfterSeconds: 60,
      }).success,
    ).toBe(true);
    expect(parse({ state: "expired", workspaceName: "Acme" }).success).toBe(
      true,
    );
    expect(parse({ state: "revoked", workspaceName: "Acme" }).success).toBe(
      true,
    );
    expect(parse({ state: "used", email: "sam@example.com" }).success).toBe(
      true,
    );
    expect(parse({ state: "unknown" }).success).toBe(true);
  });

  it("refuses an unknown state and a pending answer with a missing field", () => {
    const parse = (value: unknown) =>
      InvitationLookupResponseSchema.safeParse(value);
    expect(parse({ state: "other" }).success).toBe(false);
    expect(parse({ state: "pending", email: "a@b.c" }).success).toBe(false);
    expect(parse({ state: "used" }).success).toBe(false);
  });

  it("is strict: a field that must never be returned (role, inviter) is refused", () => {
    const parse = (value: unknown) =>
      InvitationLookupResponseSchema.safeParse(value);
    expect(parse({ state: "unknown", role: "admin" }).success).toBe(false);
    expect(
      parse({ state: "used", email: "a@b.c", invitedBy: "u1" }).success,
    ).toBe(false);
    expect(
      parse({ state: "expired", workspaceName: "Acme", role: "admin" }).success,
    ).toBe(false);
  });
});

describe("codes and sessions answers", () => {
  it("resend answers with exactly the two waits", () => {
    expect(
      ResendInvitationCodeResponseSchema.safeParse({
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }).success,
    ).toBe(true);
    expect(
      ResendInvitationCodeResponseSchema.safeParse({ expiresInSeconds: 600 })
        .success,
    ).toBe(false);
  });

  it("accept answers with the user and the id of #general and holds no token", () => {
    expect(
      AcceptInvitationResponseSchema.safeParse({
        user,
        generalConversationId: "c1",
      }).success,
    ).toBe(true);
    expect(AcceptInvitationResponseSchema.safeParse({ user }).success).toBe(
      false,
    );
    expect(
      AcceptInvitationResponseSchema.safeParse({
        user,
        generalConversationId: "c1",
        token: "x",
      }).success,
    ).toBe(false);
  });
});
