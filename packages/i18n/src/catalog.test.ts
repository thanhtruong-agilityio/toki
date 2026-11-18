import { describe, expect, it } from "vitest";
import { PLURAL_FORM_NAMES, isPluralText } from "./catalog";

describe("isPluralText", () => {
  it("is true for an object whose properties are plural form names with text values", () => {
    expect(isPluralText({ other: "x" })).toBe(true);
    expect(isPluralText({ one: "x", other: "y" })).toBe(true);
    expect(isPluralText({ one: "x" })).toBe(true);
  });

  it("is false for a string, an empty object, a group and a non-text value", () => {
    expect(isPluralText("x")).toBe(false);
    expect(isPluralText({})).toBe(false);
    expect(isPluralText({ other: { label: "x" } })).toBe(false);
    expect(isPluralText({ one: "x", label: "y" })).toBe(false);
    expect(isPluralText(null)).toBe(false);
  });

  it("names the six forms", () => {
    expect(PLURAL_FORM_NAMES).toEqual([
      "zero",
      "one",
      "two",
      "few",
      "many",
      "other",
    ]);
  });
});
