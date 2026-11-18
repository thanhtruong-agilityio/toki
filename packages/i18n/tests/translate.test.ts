import { describe, expect, it } from "vitest";
import {
  createTranslator,
  createTranslatorWith,
  translate,
  translateWith,
  type Catalog,
  type MessageKey,
} from "../src/translate";
import type { Language } from "../src/languages";

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

  it("keeps the placeholder when the parameter is undefined", () => {
    expect(t("en", "tries", { count: undefined as never })).toBe(
      "{count} tries left",
    );
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
  type Case = [Language, string, Record<string, string | number> | undefined];
  // The cases of R4 to R7 run again through a bound translator.
  const cases: Case[] = [
    ["en", "tries", { count: 2 }],
    ["en", "tries", { count: "many" }],
    ["en", "tries", undefined],
    ["en", "greeting.hello", { name: "Linh" }],
    ["en", "pluralTries", { count: 1 }],
    ["en", "pluralTries", { count: 0 }],
    ["en", "pluralTries", { count: 1.5 }],
    ["vi", "pluralTries", { count: 1 }],
    ["vi", "pluralTries", { count: 2 }],
    ["en", "pluralTries", undefined],
    ["en", "pluralTries", { count: "1" }],
    ["vi", "onlyEnglish", undefined],
    ["vi", "mixed", { count: 1 }],
    ["vi", "nope.nothing", undefined],
    ["en", "greeting.toString", undefined],
    ["en", "greeting", undefined],
  ];

  it.each(cases)(
    "%s %s %j: the bound translator equals the lookup",
    (language, key, params) => {
      const bound = createTranslatorWith(catalogs, language);
      expect(bound(key as MessageKey, params as never)).toBe(
        translateWith(catalogs, language, key, params as never),
      );
    },
  );

  it("equals translate on the real catalogs", () => {
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

// A copy of the table "First texts" of the spec (R4, R15). A later ticket that adds a key to nav
// adds it here in the same change (TOKI-015 adds nav.mainLabel).
const NAV: ReadonlyArray<readonly [MessageKey, string, string]> = [
  ["nav.home", "Home", "Trang chủ"],
  ["nav.activity", "Activity", "Hoạt động"],
  ["nav.later", "Later", "Để sau"],
  ["nav.files", "Files", "Tệp"],
  ["nav.people", "People", "Mọi người"],
  ["nav.preferences", "Preferences", "Tùy chọn"],
  ["nav.more", "More", "Thêm"],
  ["nav.directMessages", "Direct messages", "Tin nhắn riêng"],
  ["nav.channels", "Channels", "Kênh"],
  ["nav.starred", "Starred", "Đã gắn sao"],
  ["nav.conversations", "Conversations", "Hội thoại"],
  ["nav.search", "Search", "Tìm kiếm"],
  ["nav.admin", "Admin", "Quản trị"],
  ["nav.mainLabel", "Main", "Điều hướng chính"],
];

describe("nav namespace (R4, R15)", () => {
  it("holds exactly the 14 keys of the table", () => {
    expect(NAV).toHaveLength(14);
  });

  it.each(NAV)(
    "%s reads as the table says in both languages",
    (key, english, vietnamese) => {
      expect({ en: translate("en", key), vi: translate("vi", key) }).toEqual({
        en: english,
        vi: vietnamese,
      });
    },
  );
});
