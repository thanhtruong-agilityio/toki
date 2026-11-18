import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_NAMES,
  isLanguage,
  resolveLanguage,
} from "./languages";

describe("languages (R1 to R3)", () => {
  it("R1: the two codes, in order, and the default", () => {
    expect(LANGUAGES).toEqual(["en", "vi"]);
    expect(DEFAULT_LANGUAGE).toBe("en");
    // R1: the type is the literal "en", not the union.
    const literal: "en" = DEFAULT_LANGUAGE;
    expect(literal).toBe("en");
  });

  it("R2: isLanguage is true for en and vi only", () => {
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("vi")).toBe(true);
    for (const value of [undefined, null, "", "fr", "VI", "vi-VN", 1, {}]) {
      expect(isLanguage(value)).toBe(false);
    }
  });

  it("R2: resolveLanguage gives en for every other value", () => {
    expect(resolveLanguage("vi")).toBe("vi");
    expect(resolveLanguage("en")).toBe("en");
    for (const value of [undefined, null, "", "fr", "VI", "vi-VN"]) {
      expect(resolveLanguage(value)).toBe("en");
    }
  });

  it("R3: the names of the languages", () => {
    expect(LANGUAGE_NAMES).toEqual({ en: "English", vi: "Tiếng Việt" });
  });
});
