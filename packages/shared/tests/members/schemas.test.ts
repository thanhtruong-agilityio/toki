import { describe, expect, it } from "vitest";
import {
  AccountResponseSchema,
  ChangeRoleBodySchema,
  IdParamSchema,
  IdempotencyKeySchema,
  InviteBodySchema,
  InviteResponseSchema,
  MemberListQuerySchema,
  MemberListResponseSchema,
  ResendResponseSchema,
  RevokeResponseSchema,
} from "../../src/index.js";

const invitation = {
  id: "0193f0a0-0000-7000-8000-000000000001",
  state: "pending",
  role: "member",
  mailStatus: "sent",
  invitedBy: { id: "0193f0a0-0000-7000-8000-000000000002", displayName: "Lan" },
  createdAt: "2026-01-01T00:00:00.000Z",
  sentAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-01-08T00:00:00.000Z",
};

describe("invite body (R4)", () => {
  it("defaults the role to member", () => {
    expect(InviteBodySchema.parse({ emails: ["a@example.com"] })).toEqual({
      emails: ["a@example.com"],
      role: "member",
    });
  });
  it("accepts the role admin and refuses any other", () => {
    expect(
      InviteBodySchema.parse({ emails: ["a@example.com"], role: "admin" }).role,
    ).toBe("admin");
    expect(
      InviteBodySchema.safeParse({ emails: ["a@example.com"], role: "owner" })
        .success,
    ).toBe(false);
  });
  it("refuses no entry and an entry that is not a string", () => {
    expect(InviteBodySchema.safeParse({ emails: [] }).success).toBe(false);
    expect(InviteBodySchema.safeParse({ emails: [1] }).success).toBe(false);
    expect(InviteBodySchema.safeParse({}).success).toBe(false);
  });
  it("leaves the upper limit to the route (batch_too_large)", () => {
    const emails = Array.from({ length: 51 }, (_, i) => `p${i}@example.com`);
    expect(InviteBodySchema.safeParse({ emails }).success).toBe(true);
  });
  it("accepts an empty string as an entry (reported as invalid_email)", () => {
    expect(InviteBodySchema.safeParse({ emails: [""] }).success).toBe(true);
  });
});

describe("header and path", () => {
  it("accepts a key of the pattern only (R13)", () => {
    expect(IdempotencyKeySchema.safeParse("press-1_A").success).toBe(true);
    expect(IdempotencyKeySchema.safeParse("").success).toBe(false);
    expect(IdempotencyKeySchema.safeParse("a".repeat(65)).success).toBe(false);
    expect(IdempotencyKeySchema.safeParse(undefined).success).toBe(false);
    expect(IdempotencyKeySchema.safeParse(["a", "b"]).success).toBe(false);
  });
  it("accepts a UUID as an id and nothing else (R2)", () => {
    expect(
      IdParamSchema.safeParse("0193f0a0-0000-7000-8000-000000000001").success,
    ).toBe(true);
    expect(IdParamSchema.safeParse("abc").success).toBe(false);
    expect(IdParamSchema.safeParse("").success).toBe(false);
  });
});

describe("list query (R21)", () => {
  it("defaults the limit to 50", () => {
    expect(MemberListQuerySchema.parse({})).toEqual({ limit: 50 });
  });
  it("reads a limit sent as text and holds it between 1 and 100", () => {
    expect(MemberListQuerySchema.parse({ limit: "100" }).limit).toBe(100);
    expect(MemberListQuerySchema.parse({ limit: "1" }).limit).toBe(1);
    for (const limit of ["0", "101", "1.5", "abc", ""]) {
      expect(MemberListQuerySchema.safeParse({ limit }).success).toBe(false);
    }
  });
  it("accepts the four statuses and refuses another", () => {
    for (const status of ["invited", "expired", "active", "deactivated"]) {
      expect(MemberListQuerySchema.parse({ status }).status).toBe(status);
    }
    expect(MemberListQuerySchema.safeParse({ status: "revoked" }).success).toBe(
      false,
    );
  });
  it("keeps search and cursor as text", () => {
    expect(
      MemberListQuerySchema.parse({ search: "ng", cursor: "abc" }),
    ).toEqual({ search: "ng", cursor: "abc", limit: 50 });
  });
});

describe("role body (R26)", () => {
  it("accepts member and admin only", () => {
    expect(ChangeRoleBodySchema.parse({ role: "admin" })).toEqual({
      role: "admin",
    });
    expect(ChangeRoleBodySchema.safeParse({ role: "owner" }).success).toBe(
      false,
    );
    expect(ChangeRoleBodySchema.safeParse({}).success).toBe(false);
  });
});

describe("responses", () => {
  it("reads a batch response with each kind of result (R5)", () => {
    const body = {
      results: [
        { email: "a@example.com", result: "invited", invitation },
        { email: "b@example.com", result: "mail_not_sent", invitation },
        { email: "c@example.com", result: "already_invited", invitation },
        { email: "d@example.com", result: "already_member" },
        { email: "", result: "invalid_email" },
      ],
    };
    expect(InviteResponseSchema.parse(body)).toEqual(body);
  });
  it("reads a resend and a revoke response (R14, R16)", () => {
    expect(
      ResendResponseSchema.safeParse({ result: "invited", invitation }).success,
    ).toBe(true);
    expect(
      ResendResponseSchema.safeParse({ result: "already_member", invitation })
        .success,
    ).toBe(false);
    expect(
      RevokeResponseSchema.safeParse({
        invitation: { ...invitation, state: "revoked" },
      }).success,
    ).toBe(true);
  });
  it("reads an account response (R26)", () => {
    expect(
      AccountResponseSchema.safeParse({
        member: {
          id: "0193f0a0-0000-7000-8000-000000000001",
          email: "a@example.com",
          displayName: "A",
          role: "admin",
          status: "deactivated",
        },
      }).success,
    ).toBe(true);
  });
  it("reads a list response with both kinds of row (R22)", () => {
    const body = {
      members: [
        {
          kind: "account",
          userId: "0193f0a0-0000-7000-8000-000000000001",
          email: "a@example.com",
          displayName: "A",
          role: "admin",
          status: "active",
          lastActiveAt: "2026-01-01T00:00:00.000Z",
          invitation: null,
        },
        {
          kind: "invitation",
          userId: null,
          email: "b@example.com",
          displayName: null,
          role: "member",
          status: "invited",
          lastActiveAt: null,
          invitation,
        },
      ],
      counts: { invited: 1, expired: 0, active: 1, deactivated: 0 },
      activeAdminCount: 1,
      nextCursor: null,
    };
    expect(MemberListResponseSchema.parse(body)).toEqual(body);
  });
});
