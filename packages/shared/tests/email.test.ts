import { describe, expect, it } from "vitest";
import {
  EMAIL_LOCAL_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  parseEmail,
} from "../src/index.js";

describe("parseEmail", () => {
  it("trims and lower-cases a well-formed address", () => {
    expect(parseEmail("  Sam@Example.COM ")).toBe("sam@example.com");
  });
  it("refuses what is not well-formed", () => {
    for (const bad of [
      "",
      "sam",
      "sam@",
      "@example.com",
      "sam@example",
      "sam@@example.com",
      "sa m@example.com",
      ".sam@example.com",
      "sam.@example.com",
      "sa..m@example.com",
      "sam@-example.com",
      "sam@example-.com",
      "sam@exa_mple.com",
      "sam@example..com",
      "sam@example.com.",
    ]) {
      expect(parseEmail(bad), bad).toBeNull();
    }
  });
  it("accepts the allowed local-part characters", () => {
    expect(parseEmail("a+b.c_d@example.co")).toBe("a+b.c_d@example.co");
  });
  it("limits the length", () => {
    expect(EMAIL_MAX_LENGTH).toBe(254);
    expect(EMAIL_LOCAL_MAX_LENGTH).toBe(64);
    const domain = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(57)}.com`;
    const ok = `${"x".repeat(EMAIL_LOCAL_MAX_LENGTH)}@${domain}`;
    expect(ok.length).toBeLessThanOrEqual(254);
    expect(parseEmail(ok)).toBe(ok);
    expect(parseEmail(`${"x".repeat(65)}@example.com`)).toBeNull();
    const long = `x@${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}.com`;
    expect(long.length).toBeGreaterThan(254);
    expect(parseEmail(long)).toBeNull();
  });
  it("accepts 254 characters and refuses 255", () => {
    const at = (total: number) => {
      const tail = total - 65; // 64 + "@"
      const c = tail - 63 - 1 - 63 - 1 - 4; // two full labels, then c, then ".com"
      return `${"x".repeat(64)}@${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(c)}.com`;
    };
    expect(at(254)).toHaveLength(254);
    expect(parseEmail(at(254))).toBe(at(254));
    expect(at(255)).toHaveLength(255);
    expect(parseEmail(at(255))).toBeNull();
  });
  it("refuses a label of 64 characters and a non-ASCII letter, and lower-cases", () => {
    expect(parseEmail(`a@${"b".repeat(64)}.com`)).toBeNull();
    expect(parseEmail("á@example.com")).toBeNull();
    expect(parseEmail("A@B.co")).toBe("a@b.co");
  });
});
