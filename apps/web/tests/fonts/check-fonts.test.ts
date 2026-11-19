import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  checkCss,
  checkDist,
  checkFileSet,
  checkFonts,
  checkNoFontService,
  checkPreload,
  checkSources,
  formatProblem,
  importsFontsCss,
  isAllowed,
  main,
  parseCss,
  parseLinks,
  readFont,
  REQUIRED,
  TABLE_A,
  TABLE_D,
  type FontFacts,
  type Problem,
  type SourceEntry,
} from "../../scripts/check-fonts.mjs";

// Tests of scripts/check-fonts.mjs (TOKI-010 R1 to R11, R14 to R16). Tables A
// to D are typed into the script from the spec; the cases here start from a
// correct set and break one thing at a time. Node environment.

const BODY_LIST =
  '"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const SHA = "a".repeat(64);
const LICENCE: Record<string, string> = {
  "Be Vietnam Pro": "licenses/be-vietnam-pro-OFL.txt",
  "Bricolage Grotesque": "licenses/bricolage-grotesque-OFL.txt",
  "JetBrains Mono": "licenses/jetbrains-mono-OFL.txt",
};
const LICENCE_FILES = Object.values(LICENCE);

function faceRule(row: { family: string; weight: number; file: string }) {
  return `@font-face{font-family:"${row.family}";font-style:normal;font-weight:${row.weight};font-display:swap;src:url("./${row.file}") format("woff2")}`;
}

function goodCss(): string {
  return `${TABLE_A.map(faceRule).join("\n")}\nbody{font-family:${BODY_LIST}}`;
}

function goodFonts(): FontFacts[] {
  return TABLE_A.map((row) => ({
    file: row.file,
    bytes: 30_000,
    isWoff2: true,
    axes: [],
    italic: false,
    weight: row.weight,
    codePoints: new Set(REQUIRED),
    sha256: SHA,
  }));
}

function goodSources(): { fonts: SourceEntry[] } {
  return {
    fonts: TABLE_A.map((row) => ({
      file: row.file,
      family: row.family,
      weight: row.weight,
      upstream: "https://github.com/example/font",
      version: "1.000",
      licence: "SIL Open Font License 1.1",
      licenceFile: LICENCE[row.family]!,
      sha256: SHA,
      cut: {
        tool: "fonttools pyftsubset",
        toolVersion: "4.0.0",
        command: "pyftsubset in.ttf --flavor=woff2",
        unicodes: "U+0020-007E",
        missing: [],
      },
    })),
  };
}

const PRELOAD =
  '<link rel="preload" as="font" type="font/woff2" crossorigin href="/src/fonts/be-vietnam-pro-400.woff2" />';

function page(head: string): string {
  return `<!doctype html><html><head><meta charset="UTF-8" />${head}</head><body><div id="root"></div></body></html>`;
}

// A build output: seven hashed files, one CSS file that names them, and a page.
function goodDist() {
  const hashed = TABLE_A.map((row) =>
    row.file.replace(/\.woff2$/, "-Ab12Cd34.woff2"),
  );
  const css = `${TABLE_A.map(
    (row, i) =>
      `@font-face{font-family:"${row.family}";font-style:normal;font-weight:${row.weight};font-display:swap;src:url(/assets/${hashed[i]})format("woff2")}`,
  ).join(
    "",
  )}body{font-family:${BODY_LIST}}@media (max-width:719px){body{font-size:15px}}`;
  const html = page(
    `<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/${hashed[0]}">`,
  );
  return {
    html,
    cssFiles: [{ name: "assets/index-Zz99.css", text: css }],
    fileNames: [
      "index.html",
      "assets/index-Zz99.css",
      "assets/index-Qq11.js",
      ...hashed.map((name) => `assets/${name}`),
    ],
    textFiles: [
      { name: "index.html", text: html },
      { name: "assets/index-Zz99.css", text: css },
    ],
  };
}

function has(problems: Problem[], file: string, requirement: string): boolean {
  return problems.some(
    (p) => p.file.endsWith(file) && p.requirement === requirement,
  );
}

function at<T>(list: T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`no item ${index}`);
  return item;
}

describe("the tables of the spec", () => {
  test("Table A has the seven faces", () => {
    expect(TABLE_A.map((row) => `${row.family} ${row.weight}`)).toEqual([
      "Be Vietnam Pro 400",
      "Be Vietnam Pro 500",
      "Be Vietnam Pro 600",
      "Be Vietnam Pro 700",
      "Bricolage Grotesque 600",
      "Bricolage Grotesque 700",
      "JetBrains Mono 500",
    ]);
    expect(at(TABLE_A, 4).file).toBe("bricolage-grotesque-600.woff2");
  });

  test("Table B has 241 code points", () => {
    expect(new Set(REQUIRED).size).toBe(241);
    for (const cp of [0x20, 0x7e, 0xb7, 0xc0, 0x1b0, 0x1ea0, 0x1ef9, 0x31b]) {
      expect(REQUIRED, cp.toString(16)).toContain(cp);
    }
    expect(REQUIRED).not.toContain(0xa0);
    expect(REQUIRED).not.toContain(0x2191);
  });

  test("every required code point is allowed by Table C", () => {
    for (const cp of REQUIRED)
      expect(isAllowed(cp), cp.toString(16)).toBe(true);
  });

  test("Table C stops at its edges", () => {
    expect(isAllowed(0xff)).toBe(true);
    expect(isAllowed(0x100)).toBe(false);
    expect(isAllowed(0x329)).toBe(true);
    expect(isAllowed(0x32a)).toBe(false);
    expect(isAllowed(0x1ef9)).toBe(true);
    expect(isAllowed(0x1efa)).toBe(false);
    expect(isAllowed(0x2193)).toBe(true);
    expect(isAllowed(0x2194)).toBe(false);
    expect(isAllowed(0x400)).toBe(false);
  });

  test("Table D starts empty for the three families", () => {
    expect(TABLE_D).toEqual({
      "Be Vietnam Pro": [],
      "Bricolage Grotesque": [],
      "JetBrains Mono": [],
    });
  });
});

describe("parseCss and parseLinks", () => {
  test("reads formatted and minified rules alike", () => {
    const formatted = parseCss(
      '/* note */\n@font-face {\n  font-family: "A B";\n  src: url("./a.woff2")\n    format("woff2");\n}\n\nbody {\n  font-family: "A B", serif;\n}\n',
    );
    expect(formatted.fontFaces).toHaveLength(1);
    expect(at(formatted.fontFaces, 0)).toEqual([
      { property: "font-family", value: '"A B"' },
      { property: "src", value: 'url("./a.woff2") format("woff2")' },
    ]);
    expect(formatted.rules).toEqual([
      {
        selector: "body",
        declarations: [{ property: "font-family", value: '"A B", serif' }],
      },
    ]);
  });

  test("finds a font face inside the rest of a built style sheet", () => {
    const built = parseCss(
      "a{color:red}@media (min-width:1px){b{top:0}}@font-face{font-family:X;src:url(/assets/x-1.woff2)format('woff2')}",
    );
    expect(built.fontFaces).toHaveLength(1);
    expect(built.atRules).toEqual(["@media (min-width:1px)"]);
  });

  test("a semicolon inside url() does not end a declaration", () => {
    const parsed = parseCss("i{background:url(data:image/png;base64,AA==)}");
    expect(at(parsed.rules, 0).declarations).toEqual([
      { property: "background", value: "url(data:image/png;base64,AA==)" },
    ]);
  });

  test("reads link attributes with any quoting, and skips comments", () => {
    const links = parseLinks(
      `<!-- <link rel="preload" href="/no"> --><link rel=preload as='font' crossorigin href="/a.woff2"><LINK REL="icon" HREF="data:,">`,
    );
    expect(links).toEqual([
      { rel: "preload", as: "font", crossorigin: true, href: "/a.woff2" },
      { rel: "icon", href: "data:," },
    ]);
  });
});

describe("R1: the set of font files", () => {
  const present = TABLE_A.map((row) => row.file);
  const tracked = present.map((file) => `src/fonts/${file}`);

  test("the seven files and nothing else pass", () => {
    expect(
      checkFileSet({
        present: [...present, "fonts.css", "sources.json"],
        tracked: [...tracked, "src/fonts/fonts.css", "index.html"],
      }),
    ).toEqual([]);
  });

  test("a missing file is named", () => {
    const problems = checkFileSet({ present: present.slice(1), tracked });
    expect(has(problems, "be-vietnam-pro-400.woff2", "R1")).toBe(true);
  });

  test("an extra font file in the folder is named", () => {
    const problems = checkFileSet({
      present: [...present, "be-vietnam-pro-400-italic.woff2"],
      tracked,
    });
    expect(has(problems, "be-vietnam-pro-400-italic.woff2", "R1")).toBe(true);
  });

  test("a font file tracked elsewhere under apps/web is named", () => {
    const problems = checkFileSet({
      present,
      tracked: [...tracked, "public/Old.TTF"],
    });
    expect(has(problems, "public/Old.TTF", "R1")).toBe(true);
  });
});

describe("R3 to R6: what the font files hold", () => {
  test("seven correct fonts pass", () => {
    expect(checkFonts({ fonts: goodFonts(), sources: goodSources() })).toEqual(
      [],
    );
  });

  test("R3: a file that is not WOFF2", () => {
    const fonts = goodFonts();
    at(fonts, 0).isWoff2 = false;
    const problems = checkFonts({ fonts, sources: goodSources() });
    expect(has(problems, "be-vietnam-pro-400.woff2", "R3")).toBe(true);
  });

  test("R3: a variable font", () => {
    const fonts = goodFonts();
    at(fonts, 4).axes = ["wght"];
    const problems = checkFonts({ fonts, sources: goodSources() });
    expect(has(problems, "bricolage-grotesque-600.woff2", "R3")).toBe(true);
  });

  test("R3: an italic font", () => {
    const fonts = goodFonts();
    at(fonts, 1).italic = true;
    const problems = checkFonts({ fonts, sources: goodSources() });
    expect(has(problems, "be-vietnam-pro-500.woff2", "R3")).toBe(true);
  });

  test("R3: the stored weight differs from the row", () => {
    const fonts = goodFonts();
    at(fonts, 2).weight = 500;
    const problems = checkFonts({ fonts, sources: goodSources() });
    expect(has(problems, "be-vietnam-pro-600.woff2", "R3")).toBe(true);
  });

  test("R4: a missing Vietnamese letter that Table D does not list", () => {
    const fonts = goodFonts();
    at(fonts, 6).codePoints.delete(0x1ea0);
    const sources = goodSources();
    at(sources.fonts, 6).cut.missing = ["U+1EA0"];
    const problems = checkFonts({ fonts, sources });
    expect(has(problems, "jetbrains-mono-500.woff2", "R4")).toBe(true);
    expect(problems.map((p) => p.message).join(" ")).toContain("U+1EA0");
  });

  test("R4: a missing combining mark that is not recorded", () => {
    const fonts = goodFonts();
    at(fonts, 5).codePoints.delete(0x31b);
    const problems = checkFonts({ fonts, sources: goodSources() });
    expect(has(problems, "bricolage-grotesque-700.woff2", "R4")).toBe(true);
  });

  test("R4: a missing sign or mark that is recorded passes", () => {
    const fonts = goodFonts();
    at(fonts, 5).codePoints.delete(0x31b);
    at(fonts, 5).codePoints.delete(0x203a);
    const sources = goodSources();
    at(sources.fonts, 5).cut.missing = ["U+031B", "U+203A"];
    expect(checkFonts({ fonts, sources })).toEqual([]);
  });

  test("R4: a recorded code point that the file does hold", () => {
    const sources = goodSources();
    at(sources.fonts, 0).cut.missing = ["U+0301"];
    const problems = checkFonts({ fonts: goodFonts(), sources });
    expect(has(problems, "be-vietnam-pro-400.woff2", "R4")).toBe(true);
  });

  test("R5: a code point outside Table C", () => {
    const fonts = goodFonts();
    at(fonts, 3).codePoints.add(0x400);
    const problems = checkFonts({ fonts, sources: goodSources() });
    expect(has(problems, "be-vietnam-pro-700.woff2", "R5")).toBe(true);
    expect(problems.map((p) => p.message).join(" ")).toContain("U+0400");
  });

  test("R6: a file one byte over 51,200", () => {
    const fonts = goodFonts();
    at(fonts, 6).bytes = 51_201;
    const problems = checkFonts({ fonts, sources: goodSources() });
    expect(has(problems, "jetbrains-mono-500.woff2", "R6")).toBe(true);
  });

  test("R6: a total one byte over 307,200", () => {
    const fonts = goodFonts();
    for (const font of fonts) font.bytes = 43_886;
    at(fonts, 0).bytes = 43_884;
    expect(checkFonts({ fonts, sources: goodSources() })).toEqual([]);
    at(fonts, 0).bytes = 43_885;
    const problems = checkFonts({ fonts, sources: goodSources() });
    expect(has(problems, "src/fonts", "R6")).toBe(true);
  });
});

describe("R2 and R7: fonts.css", () => {
  const importers = ["main.tsx"];

  test("the seven rules and the body rule pass", () => {
    expect(checkCss({ css: goodCss(), importers })).toEqual([]);
  });

  test("white space and line breaks do not matter", () => {
    const formatted = goodCss()
      .replaceAll("{", " {\n  ")
      .replaceAll(";", ";\n  ")
      .replaceAll("}", ";\n}\n")
      .replaceAll(",", ", ")
      .replaceAll(":", ": ");
    expect(checkCss({ css: formatted, importers })).toEqual([]);
  });

  test("R2: a wrong font-weight", () => {
    const css = goodCss().replace("font-weight:500", "font-weight:550");
    expect(has(checkCss({ css, importers }), "fonts.css", "R2")).toBe(true);
  });

  test("R2: an eighth rule", () => {
    const css = `${goodCss()}\n${faceRule({ family: "JetBrains Mono", weight: 600, file: "x.woff2" })}`;
    expect(has(checkCss({ css, importers }), "fonts.css", "R2")).toBe(true);
  });

  test("R2: local() in src", () => {
    const css = goodCss().replace(
      'src:url("./be-vietnam-pro-400.woff2")',
      'src:local("Be Vietnam Pro"),url("./be-vietnam-pro-400.woff2")',
    );
    expect(has(checkCss({ css, importers }), "fonts.css", "R2")).toBe(true);
  });

  test("R2: unicode-range", () => {
    const css = goodCss().replace(
      "font-display:swap;",
      "font-display:swap;unicode-range:U+0000-00FF;",
    );
    expect(has(checkCss({ css, importers }), "fonts.css", "R2")).toBe(true);
  });

  test('R2: no format("woff2")', () => {
    const css = goodCss().replace(' format("woff2")', "");
    expect(has(checkCss({ css, importers }), "fonts.css", "R2")).toBe(true);
  });

  test("R2: a url that is not relative", () => {
    const css = goodCss().replace(
      'url("./jetbrains-mono-500.woff2")',
      'url("https://fonts.example/jetbrains-mono-500.woff2")',
    );
    expect(has(checkCss({ css, importers }), "fonts.css", "R2")).toBe(true);
  });

  test("R2: font-display other than swap", () => {
    const css = goodCss().replace("font-display:swap", "font-display:block");
    expect(has(checkCss({ css, importers }), "fonts.css", "R2")).toBe(true);
  });

  test("R7: a second rule besides body", () => {
    const css = `${goodCss()}\ncode{font-family:"JetBrains Mono",monospace}`;
    expect(has(checkCss({ css, importers }), "fonts.css", "R7")).toBe(true);
  });

  test("R7: a second declaration in body", () => {
    const css = goodCss().replace(
      "body{font-family:",
      "body{font-size:14px;font-family:",
    );
    expect(has(checkCss({ css, importers }), "fonts.css", "R7")).toBe(true);
  });

  test("R7: another family list", () => {
    const css = goodCss().replace(",Roboto,sans-serif}", ",sans-serif}");
    expect(has(checkCss({ css, importers }), "fonts.css", "R7")).toBe(true);
  });

  test("R7: no body rule", () => {
    const css = TABLE_A.map(faceRule).join("\n");
    expect(has(checkCss({ css, importers }), "fonts.css", "R7")).toBe(true);
  });

  test("R7: a second file under src imports fonts.css", () => {
    const problems = checkCss({
      css: goodCss(),
      importers: ["main.tsx", "preview/main.tsx"],
    });
    expect(has(problems, "preview/main.tsx", "R7")).toBe(true);
  });

  test("R7: main.tsx does not import fonts.css", () => {
    const problems = checkCss({ css: goodCss(), importers: [] });
    expect(has(problems, "main.tsx", "R7")).toBe(true);
  });
});

describe("R7: which text imports fonts.css", () => {
  test.each([
    'import "./fonts/fonts.css";',
    "import './fonts/fonts.css'",
    'import styles from "../fonts/fonts.css?inline";',
    'const css = await import("./fonts/fonts.css");',
    '@import "./fonts/fonts.css";',
    '@import url("../fonts/fonts.css");',
    'require("./fonts/fonts.css");',
  ])("%s", (text) => {
    expect(importsFontsCss(text)).toBe(true);
  });

  test.each([
    "// fonts.css is linked by the page, not imported here",
    'const note = "see fonts.css";',
    'import "./app.css";\n// fonts.css comes from main.tsx',
    'import "./other-fonts.css.ts";',
  ])("not an import: %s", (text) => {
    expect(importsFontsCss(text)).toBe(false);
  });
});

describe("R8: the preload link of index.html", () => {
  test("the one link passes", () => {
    expect(checkPreload({ html: page(PRELOAD) })).toEqual([]);
  });

  test("other links are ignored", () => {
    const html = page(
      `<link rel="icon" href="data:," /><link rel="modulepreload" href="/x.js">${PRELOAD}`,
    );
    expect(checkPreload({ html })).toEqual([]);
  });

  test("no link", () => {
    expect(has(checkPreload({ html: page("") }), "index.html", "R8")).toBe(
      true,
    );
  });

  test("two links", () => {
    const second = PRELOAD.replace("-400", "-600");
    const problems = checkPreload({ html: page(PRELOAD + second) });
    expect(has(problems, "index.html", "R8")).toBe(true);
  });

  test("a second link written in capitals is counted", () => {
    const second = '<LINK REL="PRELOAD" AS="FONT" HREF="/src/fonts/x.woff2">';
    const problems = checkPreload({ html: page(PRELOAD + second) });
    expect(has(problems, "index.html", "R8")).toBe(true);
  });

  test("another file", () => {
    const html = page(PRELOAD.replace("-400", "-600"));
    expect(has(checkPreload({ html }), "index.html", "R8")).toBe(true);
  });

  test("no crossorigin", () => {
    const html = page(PRELOAD.replace(" crossorigin", ""));
    expect(has(checkPreload({ html }), "index.html", "R8")).toBe(true);
  });

  test("a wrong type", () => {
    const html = page(PRELOAD.replace("font/woff2", "font/woff"));
    expect(has(checkPreload({ html }), "index.html", "R8")).toBe(true);
  });
});

describe("R9 and R10: the build output", () => {
  test("a correct build passes", () => {
    expect(checkDist(goodDist())).toEqual([]);
  });

  test("quoted and relative urls in the built CSS pass too", () => {
    const dist = goodDist();
    const css = at(dist.cssFiles, 0);
    css.text = css.text
      .replace(
        "url(/assets/be-vietnam-pro-500",
        'url("/assets/be-vietnam-pro-500',
      )
      .replace("500-Ab12Cd34.woff2)", '500-Ab12Cd34.woff2")')
      .replace("url(/assets/be-vietnam-pro-600", "url('./be-vietnam-pro-600")
      .replace("600-Ab12Cd34.woff2)", "600-Ab12Cd34.woff2')");
    expect(checkDist(dist)).toEqual([]);
  });

  test("R9: six font files", () => {
    const dist = goodDist();
    dist.fileNames = dist.fileNames.filter(
      (name) => !name.includes("jetbrains-mono"),
    );
    expect(has(checkDist(dist), "dist", "R9")).toBe(true);
  });

  test("R9: a font file with no hash in its name", () => {
    const dist = goodDist();
    dist.fileNames = dist.fileNames.map((name) =>
      name.replace("jetbrains-mono-500-Ab12Cd34", "jetbrains-mono-500"),
    );
    expect(has(checkDist(dist), "jetbrains-mono-500.woff2", "R9")).toBe(true);
  });

  test("R9: a url with a host", () => {
    const dist = goodDist();
    const css = at(dist.cssFiles, 0);
    css.text = css.text.replace(
      "url(/assets/jetbrains",
      "url(https://cdn.example/assets/jetbrains",
    );
    expect(has(checkDist(dist), "index-Zz99.css", "R9")).toBe(true);
  });

  test("R9: a protocol-relative url", () => {
    const dist = goodDist();
    const css = at(dist.cssFiles, 0);
    css.text = css.text.replace(
      "url(/assets/jetbrains",
      "url(//cdn.example/assets/jetbrains",
    );
    expect(has(checkDist(dist), "index-Zz99.css", "R9")).toBe(true);
  });

  test("R9: a face missing from the built CSS", () => {
    const dist = goodDist();
    const css = at(dist.cssFiles, 0);
    css.text = css.text.replace(
      /@font-face\{font-family:"JetBrains Mono".*?\}/,
      "",
    );
    expect(has(checkDist(dist), "dist", "R9")).toBe(true);
  });

  test("R9: an inlined font", () => {
    const dist = goodDist();
    dist.textFiles.push({
      name: "assets/extra-1.css",
      text: "@font-face{src:url(data:font/woff2;base64,AAAA)}",
    });
    expect(has(checkDist(dist), "assets/extra-1.css", "R9")).toBe(true);
  });

  test("R10: the preload href was not rewritten", () => {
    const dist = goodDist();
    dist.html = page(PRELOAD);
    expect(has(checkDist(dist), "dist/index.html", "R10")).toBe(true);
  });

  test("R10: the preload names another weight", () => {
    const dist = goodDist();
    dist.html = dist.html.replace("be-vietnam-pro-400", "be-vietnam-pro-600");
    expect(has(checkDist(dist), "dist/index.html", "R10")).toBe(true);
  });

  test("R10: no preload link in the built page", () => {
    const dist = goodDist();
    dist.html = page("");
    expect(has(checkDist(dist), "dist/index.html", "R10")).toBe(true);
  });
});

describe("R11: no font service", () => {
  test("clean files pass", () => {
    expect(
      checkNoFontService({
        files: [{ name: "src/main.tsx", text: 'import "./fonts/fonts.css";' }],
      }),
    ).toEqual([]);
  });

  test("each of the two hosts is found, in text or in bytes", () => {
    const problems = checkNoFontService({
      files: [
        { name: "index.html", text: "https://fonts.googleapis.com/css2" },
        {
          name: "dist/assets/a.css",
          text: Buffer.from("url(https://fonts.gstatic.com/s/x.woff2)"),
        },
      ],
    });
    expect(has(problems, "index.html", "R11")).toBe(true);
    expect(has(problems, "dist/assets/a.css", "R11")).toBe(true);
  });
});

describe("R14 and R15: sources.json and the licence files", () => {
  const args = () => ({
    sources: goodSources(),
    fonts: goodFonts(),
    licenceFiles: [...LICENCE_FILES],
  });

  test("seven complete entries and three licence files pass", () => {
    expect(checkSources(args())).toEqual([]);
  });

  test("R14: a missing entry", () => {
    const a = args();
    a.sources.fonts.pop();
    expect(has(checkSources(a), "jetbrains-mono-500.woff2", "R14")).toBe(true);
  });

  test("R14: an entry for a file that is not in Table A", () => {
    const a = args();
    a.sources.fonts.push({ ...at(a.sources.fonts, 0), file: "other.woff2" });
    expect(has(checkSources(a), "other.woff2", "R14")).toBe(true);
  });

  test.each(["upstream", "version", "licence", "sha256"] as const)(
    "R14: an empty %s",
    (field) => {
      const a = args();
      at(a.sources.fonts, 2)[field] = "";
      expect(has(checkSources(a), "be-vietnam-pro-600.woff2", "R14")).toBe(
        true,
      );
    },
  );

  test.each(["tool", "toolVersion", "command", "unicodes"] as const)(
    "R14: an empty cut.%s",
    (field) => {
      const a = args();
      at(a.sources.fonts, 2).cut[field] = "";
      expect(has(checkSources(a), "be-vietnam-pro-600.woff2", "R14")).toBe(
        true,
      );
    },
  );

  test("R14: a family or weight that differs from Table A", () => {
    const a = args();
    at(a.sources.fonts, 4).weight = 700;
    expect(has(checkSources(a), "bricolage-grotesque-600.woff2", "R14")).toBe(
      true,
    );
  });

  test("R14: a SHA-256 that differs from the file", () => {
    const a = args();
    at(a.sources.fonts, 0).sha256 = `b${SHA.slice(1)}`;
    expect(has(checkSources(a), "be-vietnam-pro-400.woff2", "R14")).toBe(true);
  });

  test("R14: a recorded code point that is neither a sign, a mark nor in Table D", () => {
    const a = args();
    at(a.sources.fonts, 6).cut.missing = ["U+0041"];
    expect(has(checkSources(a), "jetbrains-mono-500.woff2", "R14")).toBe(true);
  });

  test("R14: a missing list that is not a list", () => {
    const a = args();
    // A hand-edited file: the field is there with the wrong shape.
    (at(a.sources.fonts, 6).cut as { missing: unknown }).missing = "U+0301";
    expect(has(checkSources(a), "jetbrains-mono-500.woff2", "R14")).toBe(true);
  });

  test("R14: sources.json with no fonts list", () => {
    const problems = checkSources({
      sources: {},
      fonts: goodFonts(),
      licenceFiles: [...LICENCE_FILES],
    });
    expect(has(problems, "sources.json", "R14")).toBe(true);
  });

  test("R15: a licence file that does not exist", () => {
    const a = args();
    a.licenceFiles = a.licenceFiles.filter((f) => !f.includes("jetbrains"));
    expect(has(checkSources(a), "jetbrains-mono-OFL.txt", "R15")).toBe(true);
  });

  test("R15: an entry that names no licence file", () => {
    const a = args();
    at(a.sources.fonts, 1).licenceFile = "";
    expect(has(checkSources(a), "be-vietnam-pro-500.woff2", "R15")).toBe(true);
  });

  test("R15: two files of one family that name different licence files", () => {
    const a = args();
    at(a.sources.fonts, 1).licenceFile = "licenses/jetbrains-mono-OFL.txt";
    expect(has(checkSources(a), "be-vietnam-pro-500.woff2", "R15")).toBe(true);
  });
});

describe("R16: the command", () => {
  test("a problem line names the file and the requirement", () => {
    expect(
      formatProblem({
        file: "src/fonts/fonts.css",
        requirement: "R2",
        message: "eight rules",
      }),
    ).toBe("check:fonts: src/fonts/fonts.css: R2: eight rules");
  });

  test("without dist/index.html it fails and names the build command", async () => {
    const dir = mkdtempSync(join(tmpdir(), "check-fonts-"));
    const lines: string[] = [];
    try {
      const code = await main(dir, { print: (line) => lines.push(line) });
      expect(code).not.toBe(0);
      expect(lines.join("\n")).toContain("pnpm --filter ./apps/web build");
      expect(lines.join("\n")).toContain("dist/index.html");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

// The seven committed files, read with the font library, against the record.
describe("the real files (R3 to R6, R14, R15)", () => {
  const fontsDir = join(import.meta.dirname, "../../src/fonts");
  const readAll = () =>
    Promise.all(TABLE_A.map((row) => readFont(join(fontsDir, row.file))));

  test.each(TABLE_A)(
    "$file is WOFF2, static, upright, at weight $weight",
    async (row) => {
      const font = await readFont(join(fontsDir, row.file));
      expect(font.isWoff2).toBe(true);
      expect(font.axes).toEqual([]);
      expect(font.italic).toBe(false);
      expect(font.weight).toBe(row.weight);
      expect(font.sha256).toMatch(/^[0-9a-f]{64}$/);
    },
  );

  test("the files hold Table B, stay inside Table C and under the sizes", async () => {
    const sources: unknown = JSON.parse(
      readFileSync(join(fontsDir, "sources.json"), "utf8"),
    );
    expect(checkFonts({ fonts: await readAll(), sources })).toEqual([]);
  });

  test("sources.json and the licence files match the files", async () => {
    const sources: unknown = JSON.parse(
      readFileSync(join(fontsDir, "sources.json"), "utf8"),
    );
    const licenceFiles = readdirSync(join(fontsDir, "licenses")).map(
      (name) => `licenses/${name}`,
    );
    expect(licenceFiles).toHaveLength(3);
    expect(
      checkSources({ sources, fonts: await readAll(), licenceFiles }),
    ).toEqual([]);
  });
});
