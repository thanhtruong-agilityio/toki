import { describe, expect, it } from "vitest";
import type { Catalog } from "./catalog";
import {
  checkCatalogs,
  checkNamespaceFiles,
  countKeys,
  formatProblem,
} from "./check";

const run = (en: Catalog, vi: Catalog) =>
  checkCatalogs({ en, vi }).map(formatProblem);

describe("checkCatalogs", () => {
  it("finds nothing in two catalogs that agree", () => {
    expect(
      run({ nav: { home: "Home" } }, { nav: { home: "Trang chủ" } }),
    ).toEqual([]);
  });

  it("(a) a key of English is missing in Vietnamese", () => {
    expect(
      run(
        { nav: { home: "Home", more: "More" } },
        { nav: { home: "Trang chủ" } },
      ),
    ).toEqual(["vi nav.more: missing"]);
  });

  it("(b) a key of Vietnamese is missing in English", () => {
    expect(
      run(
        { nav: { home: "Home" } },
        { nav: { home: "Trang chủ", more: "Thêm" } },
      ),
    ).toEqual(["en nav.more: missing"]);
  });

  it("(c) an empty or white-space text, and an empty plural form", () => {
    expect(run({ nav: { home: "Home" } }, { nav: { home: "  " } })).toEqual([
      "vi nav.home: empty text",
    ]);
    expect(
      run(
        { nav: { n: { one: "", other: "{count} n" } } },
        { nav: { n: { other: "{count} n" } } },
      ),
    ).toEqual(["en nav.n: empty text in form one"]);
  });

  it("(d) placeholder names differ between the languages", () => {
    const problems = run(
      { nav: { a: "{count} left" } },
      { nav: { a: "còn lại" } },
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^vi nav\.a: placeholders differ/);
  });

  it("(d) placeholders are the union over plural forms", () => {
    expect(
      run(
        { nav: { a: { one: "One try left", other: "{count} tries left" } } },
        { nav: { a: { other: "{count} lần thử còn lại" } } },
      ),
    ).toEqual([]);
    const problems = run(
      { nav: { a: { one: "One try left", other: "{count} tries left" } } },
      { nav: { a: { other: "còn lại" } } },
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^vi nav\.a: placeholders differ/);
  });

  it("(e) a key breaks the naming rule", () => {
    const bad = (key: Catalog) => run(key, key);
    expect(bad({ nav: { "Bad-name": "x" } })).toEqual([
      expect.stringMatching(/^en nav\.Bad-name: breaks the naming rule/),
    ]);
    // one part only: a text at the top level
    expect(bad({ lonely: "x" })).toEqual([
      expect.stringMatching(/^en lonely: breaks the naming rule/),
    ]);
    // five parts
    expect(bad({ a: { b: { c: { d: { e: "x" } } } } })).toEqual([
      expect.stringMatching(/^en a\.b\.c\.d\.e: breaks the naming rule/),
    ]);
    // a plural form name used as a part
    expect(bad({ nav: { other: { label: "x" } } })).toEqual([
      expect.stringMatching(/^en nav\.other\.label: breaks the naming rule/),
    ]);
  });

  it("(f) a plural text lacks other, lacks one in English, or has a form that is not allowed", () => {
    expect(
      run({ nav: { a: { one: "x" } } }, { nav: { a: { other: "y" } } }),
    ).toEqual(["en nav.a: plural forms lack other"]);
    expect(
      run({ nav: { a: { other: "x" } } }, { nav: { a: { other: "y" } } }),
    ).toEqual(["en nav.a: plural forms lack one in English"]);
    expect(
      run(
        { nav: { a: { one: "x", other: "x" } } },
        { nav: { a: { one: "y", other: "y" } } },
      ),
    ).toEqual(["vi nav.a: form one is not used in vi"]);
    expect(
      run(
        { nav: { a: { one: "x", two: "x", other: "x" } } },
        { nav: { a: { other: "y" } } },
      ),
    ).toEqual(["en nav.a: form two is not used in en"]);
  });

  it("reports every problem, not only the first", () => {
    const problems = run(
      { nav: { a: "A", b: "B", c: "C" } },
      { nav: { a: "", d: "D" } },
    );
    expect(problems).toEqual([
      "vi nav.a: empty text",
      "vi nav.b: missing",
      "vi nav.c: missing",
      "en nav.d: missing",
    ]);
  });

  it("does not compare wordings", () => {
    expect(
      run({ nav: { email: "Email" } }, { nav: { email: "Email" } }),
    ).toEqual([]);
  });

  it("reports every key of a namespace that exists in English only", () => {
    expect(
      run(
        { nav: { a: "A", b: "B" }, extra: { c: "C" } },
        { nav: { a: "A", b: "B" } },
      ),
    ).toEqual(["vi extra.c: missing"]);
  });

  it("a plain text in one language may be a plural text in the other", () => {
    expect(
      run(
        { nav: { a: { one: "{count} item", other: "{count} items" } } },
        { nav: { a: "{count} mục" } },
      ),
    ).toEqual([]);
  });
});

describe("countKeys", () => {
  it("counts texts and plural texts once", () => {
    expect(
      countKeys({
        nav: { a: "A", b: { one: "x", other: "y" } },
        other: { c: "C" },
      }),
    ).toBe(3);
  });
});

describe("checkNamespaceFiles (R13)", () => {
  it("names a file that no index.ts lists", () => {
    const problems = checkNamespaceFiles(
      { en: ["nav", "extra"], vi: ["nav"] },
      { en: { nav: {} }, vi: { nav: {} } },
    ).map(formatProblem);
    expect(problems).toEqual([
      "en messages/en/extra.ts: not listed in index.ts",
    ]);
  });

  it("finds nothing when every file is listed", () => {
    expect(
      checkNamespaceFiles(
        { en: ["nav"], vi: ["nav"] },
        { en: { nav: {} }, vi: { nav: {} } },
      ),
    ).toEqual([]);
  });
});
