import { describe, expect, it } from "vitest";
import { EMAIL_LOCAL_MAX_LENGTH, EMAIL_MAX_LENGTH, parseEmail } from "../src/index.js";

describe("parseEmail", () => {
  it("trims and lower-cases a well-formed address", () => {
    expect(parseEmail(" Minh@Example.com ")).toBe("minh@example.com");
    expect(parseEmail("A@B.co")).toBe("a@b.co");
    expect(parseEmail("a.b+c_d@sub.example.com")).toBe("a.b+c_d@sub.example.com");
  });

  it("exports the two limits", () => {
    expect(EMAIL_MAX_LENGTH).toBe(254);
    expect(EMAIL_LOCAL_MAX_LENGTH).toBe(64);
  });

  it.each([
    ["no at sign", "not-an-address"],
    ["whitespace inside", "a b@example.com"],
    ["two @", "a@b@example.com"],
    ["empty local part", "@example.com"],
    ["dot at the start of the local part", ".a@example.com"],
    ["dot at the end of the local part", "a.@example.com"],
    ["two dots in a row", "a..b@example.com"],
    ["domain of one label", "a@example"],
    ["trailing dot in the domain", "a@example.com."],
    ["label starting with a hyphen", "a@-example.com"],
    ["label ending with a hyphen", "a@example-.com"],
    ["non-ASCII letter", "á@example.com"],
    ["empty string", "   "],
    ["local part of 65 characters", `${"a".repeat(65)}@example.com`],
    ["label of 64 characters", `a@${"b".repeat(64)}.com`],
    ["address of 255 characters", `a@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.${"e".repeat(61)}`],
  ])("refuses %s", (_name, value) => {
    expect(parseEmail(value)).toBeNull();
  });

  it("accepts a local part of 64 and a label of 63 characters", () => {
    expect(parseEmail(`${"a".repeat(64)}@example.com`)).not.toBeNull();
    expect(parseEmail(`a@${"b".repeat(63)}.com`)).not.toBeNull();
  });

  it("accepts an address of exactly 254 characters and refuses 255", () => {
    const address = (last: number) =>
      `a@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.${"e".repeat(last)}`;
    expect(address(60).length).toBe(254);
    expect(parseEmail(address(60))).not.toBeNull();
    expect(address(61).length).toBe(255);
    expect(parseEmail(address(61))).toBeNull();
  });
});
