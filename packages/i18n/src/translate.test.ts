import { describe, expect, it } from "vitest";
import {
  createTranslator,
  translate,
  translateWith,
  type Catalog,
} from "./translate";

// A small catalog pair for the lookup; the real catalogs are compared by the check, not here.
const catalogs: Record<"en" | "vi", Catalog> = {
  en: {
    greeting: { hello: "Hello" },
    tries: "{count} tries left",
    pluralTries: { one: "{count} try left", other: "{count} tries left" },
    onlyEnglish: "Only English",
    mixed: { one: "{count} item", other: "{count} items" },
  },
  vi: {
    greeting: { hello: "Xin chào" },
    tries: "Còn {count} lần",
    pluralTries: { other: "Còn {count} lần thử" },
  },
};

const t = (
  language: "en" | "vi",
  key: string,
  params?: Record<string, string | number>,
) => translateWith(catalogs, language, key, params as never);

describe("translate (R4)", () => {
  it("returns the text of the real catalogs", () => {
    expect(translate("en", "nav.home")).toBe("Home");
    expect(translate("vi", "nav.home")).toBe("Trang chủ");
  });
});

describe("placeholders (R5)", () => {
  it("replaces a placeholder with a number as plain digits", () => {
    expect(t("en", "tries", { count: 2 })).toBe("2 tries left");
    expect(t("en", "tries", { count: 1204 })).toBe("1204 tries left");
  });

  it("replaces a placeholder with a string as it is", () => {
    expect(t("en", "tries", { count: "many" })).toBe("many tries left");
  });

  it("leaves a placeholder with no parameter as written", () => {
    expect(t("en", "tries")).toBe("{count} tries left");
    expect(t("en", "tries", {})).toBe("{count} tries left");
  });

  it("ignores a parameter with no placeholder", () => {
    expect(t("en", "greeting.hello", { name: "Linh" })).toBe("Hello");
  });
});

describe("plural forms (R6)", () => {
  it("English: one for exactly 1, other for the rest", () => {
    expect(t("en", "pluralTries", { count: 1 })).toBe("1 try left");
    for (const count of [0, 2, 1.5]) {
      expect(t("en", "pluralTries", { count })).toBe(`${count} tries left`);
    }
  });

  it("Vietnamese: always other", () => {
    for (const count of [0, 1, 2, 1.5]) {
      expect(t("vi", "pluralTries", { count })).toBe(`Còn ${count} lần thử`);
    }
  });

  it("uses other when count is missing or is a string", () => {
    expect(t("en", "pluralTries")).toBe("{count} tries left");
    expect(t("en", "pluralTries", { count: "1" })).toBe("1 tries left");
  });

  it("rejects a string count at compile time", () => {
    // @ts-expect-error count must be a number
    translate("en", "nav.home", { count: "1" });
  });
});

describe("missing texts (R7)", () => {
  it("falls back to English when the language has no text", () => {
    expect(t("vi", "onlyEnglish")).toBe("Only English");
  });

  it("uses the English plural rule for the English fallback", () => {
    expect(t("vi", "mixed", { count: 1 })).toBe("1 item");
  });

  it("returns the key when no language has it", () => {
    expect(t("vi", "nope.nothing")).toBe("nope.nothing");
  });

  it("finds only own properties", () => {
    for (const key of [
      "greeting.toString",
      "greeting.constructor",
      "toString",
      "valueOf",
    ]) {
      expect(t("en", key)).toBe(key);
    }
    expect(translate("en", "nav.toString" as never)).toBe("nav.toString");
    expect(translate("en", "nav.constructor" as never)).toBe("nav.constructor");
  });

  it("does not return a group as a text", () => {
    expect(t("en", "greeting")).toBe("greeting");
  });

  it("never throws", () => {
    expect(() => translateWith(catalogs, "en", "", undefined)).not.toThrow();
    expect(() =>
      translateWith(catalogs, "en", "a..b", undefined),
    ).not.toThrow();
  });
});

describe("createTranslator (R9)", () => {
  it("equals translate for the same keys and parameters", () => {
    for (const language of ["en", "vi"] as const) {
      const bound = createTranslator(language);
      expect(bound("nav.home")).toBe(translate(language, "nav.home"));
    }
  });

  it("returns the same function for the same language", () => {
    expect(createTranslator("en")).toBe(createTranslator("en"));
    expect(createTranslator("en")).not.toBe(createTranslator("vi"));
  });
});
