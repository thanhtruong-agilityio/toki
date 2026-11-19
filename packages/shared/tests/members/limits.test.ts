import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  IDEMPOTENCY_KEY_PATTERN,
  INVITATION_BATCH_MAX,
  INVITATION_LIFETIME_DAYS,
  INVITATION_RESEND_SECONDS,
  INVITATION_TOKEN_PATTERN,
  MEMBER_LIST_LIMIT_DEFAULT,
  MEMBER_LIST_LIMIT_MAX,
} from "../../src/index.js";

describe("member limits (R35)", () => {
  it("holds the numbers of the spec", () => {
    expect([
      INVITATION_BATCH_MAX,
      INVITATION_LIFETIME_DAYS,
      INVITATION_RESEND_SECONDS,
      MEMBER_LIST_LIMIT_DEFAULT,
      MEMBER_LIST_LIMIT_MAX,
    ]).toEqual([50, 7, 60, 50, 100]);
  });

  it("accepts the 43-character tokens that 32 random bytes make", () => {
    for (let i = 0; i < 1000; i += 1) {
      const token = randomBytes(32).toString("base64url");
      expect(token).toHaveLength(43);
      expect(INVITATION_TOKEN_PATTERN.test(token)).toBe(true);
    }
  });

  it("refuses a token of another length or alphabet", () => {
    const token = "a".repeat(43);
    expect(INVITATION_TOKEN_PATTERN.test(token)).toBe(true);
    expect(INVITATION_TOKEN_PATTERN.test("a".repeat(42))).toBe(false);
    expect(INVITATION_TOKEN_PATTERN.test("a".repeat(44))).toBe(false);
    expect(INVITATION_TOKEN_PATTERN.test(`${"a".repeat(42)}+`)).toBe(false);
    expect(INVITATION_TOKEN_PATTERN.test(`${"a".repeat(42)}/`)).toBe(false);
    expect(INVITATION_TOKEN_PATTERN.test(`${token}\n`)).toBe(false);
  });

  it("accepts a key of 1 to 64 characters of A-Za-z0-9_-", () => {
    expect(IDEMPOTENCY_KEY_PATTERN.test("a")).toBe(true);
    expect(IDEMPOTENCY_KEY_PATTERN.test("A-z_0".repeat(12) + "abcd")).toBe(
      true,
    );
    expect(IDEMPOTENCY_KEY_PATTERN.test("")).toBe(false);
    expect(IDEMPOTENCY_KEY_PATTERN.test("a".repeat(65))).toBe(false);
    expect(IDEMPOTENCY_KEY_PATTERN.test("a b")).toBe(false);
    expect(IDEMPOTENCY_KEY_PATTERN.test("a\n")).toBe(false);
  });
});
