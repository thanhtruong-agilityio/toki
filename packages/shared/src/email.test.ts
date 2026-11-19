import { describe, expect, it } from "vitest";
import {
  EMAIL_LOCAL_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  parseEmail,
} from "./index.js";

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
});
