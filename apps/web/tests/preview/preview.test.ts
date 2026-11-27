import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  applyControls,
  readControls,
  writeAddress,
} from "../../src/preview/controls";
import { referenceFor, references } from "../../src/preview/references";

const SRC_URL = new URL(
  "../../src/preview/preview.test.ts",
  `file://${import.meta.dirname}/`,
);

// Checks of the pure functions of the preview page and of its files read as
// text (TOKI-016 R3, R4, R18, R19). Node environment.

// Deferred until TOKI-010 (fonts) is on main: its fonts.css does not exist yet.
const PENDING_TOKI_010 = "waits for TOKI-010 (fonts.css is not on main)";

const webDir = fileURLToPath(new URL("../..", SRC_URL));
const srcDir = join(webDir, "src");
const previewDir = join(srcDir, "preview");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else found.push(path);
  }
  return found;
}

const isTest = (path: string) => /\.test\.[cm]?[jt]sx?$/.test(path);
const isCode = (path: string) => /\.[cm]?[jt]sx?$/.test(path);

// Every import and re-export of a source text: the specifier and, for a named
// list, its names. A side-effect import has no names.
type Import = { source: string; names: string[]; sideEffect: boolean };
function importsOf(code: string): Import[] {
  const found: Import[] = [];
  const pattern =
    /^\s*(?:import|export)\s+(?:type\s+)?(?:([^"';]*?)\s+from\s+)?["']([^"']+)["']/gm;
  for (const m of code.matchAll(pattern)) {
    const clause = m[1];
    const names: string[] = [];
    if (clause) {
      const braces = clause.match(/\{([^}]*)\}/);
      if (braces) {
        for (const part of braces[1].split(",")) {
          const name = part
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0]
            .trim();
          if (name) names.push(name);
        }
      }
      const rest = clause
        .replace(/\{[^}]*\}/, "")
        .replace(/,/g, " ")
        .trim();
      if (rest) names.push(rest); // a default or namespace import
    }
    found.push({ source: m[2], names, sideEffect: clause === undefined });
  }
  return found;
}

describe("readControls (R4, TOKI-143 R10)", () => {
  test("a valid address gives the four values", () => {
    expect(
      readControls("?look=focus&scheme=dark&accent=clay&density=compact"),
    ).toEqual({
      look: "focus",
      scheme: "dark",
      accent: "clay",
      density: "compact",
    });
    expect(readControls("?look=classic").look).toBe("classic");
  });

  test("a missing value gives calm, light, teal and the look's own density", () => {
    expect(readControls("")).toEqual({
      look: "calm",
      scheme: "light",
      accent: "teal",
      density: "own",
    });
    // ?look=focus alone is Focus in light: the look no longer brings a scheme
    expect(readControls("?look=focus")).toEqual({
      look: "focus",
      scheme: "light",
      accent: "teal",
      density: "own",
    });
  });

  test("an unknown value gives the default of that control only", () => {
    expect(
      readControls("?look=sepia&scheme=device&accent=indigo&density=huge"),
    ).toEqual({
      look: "calm",
      scheme: "light",
      accent: "indigo",
      density: "own",
    });
    expect(readControls("?look=&scheme=&accent=&density=")).toEqual({
      look: "calm",
      scheme: "light",
      accent: "teal",
      density: "own",
    });
  });

  test("a repeated value uses the first one, and a wrong case is unknown", () => {
    expect(readControls("?look=focus&look=calm").look).toBe("focus");
    expect(readControls("?look=calm&look=focus").look).toBe("calm");
    expect(readControls("?scheme=dark&scheme=light").scheme).toBe("dark");
    expect(readControls("?accent=Indigo").accent).toBe("teal");
  });

  test("the look's own density can be written out", () => {
    expect(readControls("?density=own").density).toBe("own");
    expect(readControls("?density=comfortable").density).toBe("comfortable");
  });
});

// A stand-in for the root element: the attributes it holds.
function fakeRoot() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (name: string, value: string) => void attrs.set(name, value),
    removeAttribute: (name: string) => void attrs.delete(name),
  };
}

describe("applyControls and writeAddress (R4, TOKI-143 R10)", () => {
  test("sets data-look, data-scheme, data-accent and data-density", () => {
    const root = fakeRoot();
    applyControls(root, {
      look: "focus",
      scheme: "dark",
      accent: "violet",
      density: "compact",
    });
    expect(Object.fromEntries(root.attrs)).toEqual({
      "data-look": "focus",
      "data-scheme": "dark",
      "data-accent": "violet",
      "data-density": "compact",
    });
  });

  test("the look's own density sets no data-density and removes an old one", () => {
    const root = fakeRoot();
    const base = { look: "calm", scheme: "light", accent: "teal" } as const;
    applyControls(root, { ...base, density: "compact" });
    applyControls(root, { ...base, density: "own" });
    expect(root.attrs.has("data-density")).toBe(false);
    expect(root.attrs.get("data-look")).toBe("calm");
  });

  test("data-look and data-scheme are always set together, so the device setting never decides", () => {
    const root = fakeRoot();
    applyControls(root, readControls(""));
    expect(root.attrs.get("data-look")).toBe("calm");
    expect(root.attrs.get("data-scheme")).toBe("light");
    expect(root.attrs.get("data-accent")).toBe("teal");
    for (const look of ["calm", "focus", "classic"] as const) {
      for (const scheme of ["light", "dark"] as const) {
        const r = fakeRoot();
        applyControls(r, { look, scheme, accent: "teal", density: "own" });
        expect(r.attrs.has("data-look")).toBe(r.attrs.has("data-scheme"));
        expect([r.attrs.get("data-look"), r.attrs.get("data-scheme")]).toEqual([
          look,
          scheme,
        ]);
      }
    }
  });

  test("the address carries look, scheme, accent and density", () => {
    const calls: string[] = [];
    const history = {
      replaceState: (_state: unknown, _title: string, url: string) =>
        void calls.push(url),
    };
    writeAddress(history, "/preview.html", {
      look: "focus",
      scheme: "dark",
      accent: "clay",
      density: "own",
    });
    expect(calls).toEqual([
      "/preview.html?look=focus&scheme=dark&accent=clay&density=own",
    ]);
    expect(readControls(calls[0].slice(calls[0].indexOf("?")))).toEqual({
      look: "focus",
      scheme: "dark",
      accent: "clay",
      density: "own",
    });
  });
});

describe("style order (R3)", () => {
  const main = read(join(previewDir, "main.tsx"));
  const imports = importsOf(main);

  test("main.tsx imports tokens.css, then base.css, before any other non-CSS import", () => {
    expect(imports[0]?.source).toBe("@toki/tokens/tokens.css");
    expect(imports[1]?.source).toBe("@toki/ui-web/base.css");
    const firstCode = imports.findIndex(
      (entry) => !/\.css$/.test(entry.source),
    );
    expect(firstCode).toBeGreaterThan(1);
  });

  test("preview.css is imported after the two style sheets", () => {
    const sources = imports.map((entry) => entry.source);
    const preview = sources.indexOf("./preview.css");
    expect(preview).toBeGreaterThan(1);
  });

  test("preview.html loads src/preview/main.tsx", () => {
    const html = read(join(webDir, "preview.html"));
    expect(html).toMatch(
      /<script\s+type="module"\s+src="\/src\/preview\/main\.tsx"\s*><\/script>/,
    );
  });

  test.todo(
    `preview.html links /src/fonts/fonts.css with rel="stylesheet" (${PENDING_TOKI_010})`,
  );

  test("only src/main.tsx may import fonts.css", () => {
    for (const path of filesUnder(srcDir)) {
      if (!isCode(path) || isTest(path)) continue;
      if (path === join(srcDir, "main.tsx")) continue;
      expect(read(path), relative(webDir, path)).not.toMatch(/fonts\.css/);
    }
  });
});

describe("words and styles of the page (R18)", () => {
  const sources = filesUnder(previewDir).filter(
    (path) => isCode(path) && !isTest(path),
  );

  test("the page imports nothing from @toki/i18n", () => {
    expect(sources.length).toBeGreaterThan(0);
    for (const path of sources) {
      expect(read(path), relative(webDir, path)).not.toMatch(/@toki\/i18n/);
    }
  });

  test("preview.css has only selectors that start with .pv-, body or :root", () => {
    const css = read(join(previewDir, "preview.css")).replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const selectors: string[] = [];
    let start = 0;
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === "{") {
        const prelude = css.slice(start, i).trim();
        if (prelude && !prelude.startsWith("@")) {
          for (const part of prelude.split(",")) selectors.push(part.trim());
        }
        start = i + 1;
      } else if (ch === "}" || ch === ";") {
        start = i + 1;
      }
    }
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector).toMatch(/^(?:\.pv-[\w-]+|body|:root)(?![\w-])/);
    }
  });
});

describe("imports of the page (R19)", () => {
  const sources = filesUnder(previewDir).filter(
    (path) => isCode(path) && !isTest(path),
  );
  const allowedUiWeb = new Set([
    "componentExamples",
    "Icon",
    "iconNames",
    "ToastProvider",
    "useToasts",
  ]);
  const allowedTokens = new Set(["looks", "schemes", "accents", "densities"]);

  test("from @toki/ui-web only five names, and the two style sheets", () => {
    for (const path of sources) {
      for (const entry of importsOf(read(path))) {
        const where = relative(webDir, path);
        if (entry.source === "@toki/ui-web") {
          for (const name of entry.names) {
            expect(allowedUiWeb.has(name), `${where}: ${name}`).toBe(true);
          }
        } else if (entry.source === "@toki/ui-web/examples") {
          expect(entry.names, where).toEqual(["componentExamples"]);
        } else if (entry.source === "@toki/ui-web/base.css") {
          expect(entry.sideEffect, where).toBe(true);
        } else {
          expect(entry.source, where).not.toMatch(/@toki\/ui-web/);
        }
      }
    }
  });

  test("from @toki/tokens only looks, schemes, accents, densities and tokens.css", () => {
    for (const path of sources) {
      for (const entry of importsOf(read(path))) {
        const where = relative(webDir, path);
        if (entry.source === "@toki/tokens") {
          for (const name of entry.names) {
            expect(allowedTokens.has(name), `${where}: ${name}`).toBe(true);
          }
        } else if (entry.source.startsWith("@toki/tokens")) {
          expect(entry.source, where).toBe("@toki/tokens/tokens.css");
        }
      }
    }
  });

  test("nothing outside src/preview imports the examples or the page", () => {
    for (const path of filesUnder(srcDir)) {
      if (!isCode(path) || path.startsWith(previewDir)) continue;
      for (const entry of importsOf(read(path))) {
        const where = relative(webDir, path);
        expect(entry.source, where).not.toMatch(/ui-web\/examples/);
        expect(entry.source, where).not.toMatch(/(^|\/)preview(\/|$)/);
      }
    }
  });
});

describe("overlays are drawn as given (R13)", () => {
  test("the page adds no router, shell or provider except the toast one", () => {
    const sources = filesUnder(previewDir).filter(
      (path) => isCode(path) && !isTest(path),
    );
    for (const path of sources) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toMatch(/Router|AppShell|createRouter/);
      const providers = [...text.matchAll(/<(\w*Provider)\b/g)].map(
        (match) => match[1],
      );
      expect(
        providers.filter((name) => name !== "ToastProvider"),
        path,
      ).toEqual([]);
    }
  });
});

describe("prototype references (R17)", () => {
  test("an entry with no key reads No prototype reference recorded", () => {
    expect(referenceFor("NoSuchComponent")).toBe(
      "No prototype reference recorded",
    );
    expect(referenceFor("Button", {})).toBe("No prototype reference recorded");
    // A name that Object.prototype holds is not a key either.
    expect(referenceFor("toString")).toBe("No prototype reference recorded");
  });

  test("a recorded entry gives its value, and none is a plain value", () => {
    expect(referenceFor("Button", { Button: "82-93" })).toBe("82-93");
    expect(referenceFor("PersonChip", { PersonChip: "none" })).toBe("none");
  });

  test("references is a plain object from names to strings, with the three overlays", () => {
    for (const value of Object.values(references)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
    for (const name of ["Menu", "Modal", "Sheet", "tokens", "icons"]) {
      expect(references).toHaveProperty(name);
    }
  });
});
