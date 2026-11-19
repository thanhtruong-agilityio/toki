// Proves the self-hosted fonts of the web app (TOKI-010 R1 to R11, R14, R15).
// Run by the `check:fonts` script, last in `build`, because R9 to R11 read
// `dist`. Exits 1 and names the file and the requirement of each problem.
// Tables A to D are typed in from docs/specs/2026-11-16-self-hosted-fonts-design.md.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, posix, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Table A: the seven faces.
export const TABLE_A = [
  { family: "Be Vietnam Pro", weight: 400, file: "be-vietnam-pro-400.woff2" },
  { family: "Be Vietnam Pro", weight: 500, file: "be-vietnam-pro-500.woff2" },
  { family: "Be Vietnam Pro", weight: 600, file: "be-vietnam-pro-600.woff2" },
  { family: "Be Vietnam Pro", weight: 700, file: "be-vietnam-pro-700.woff2" },
  {
    family: "Bricolage Grotesque",
    weight: 600,
    file: "bricolage-grotesque-600.woff2",
  },
  {
    family: "Bricolage Grotesque",
    weight: 700,
    file: "bricolage-grotesque-700.woff2",
  },
  { family: "JetBrains Mono", weight: 500, file: "jetbrains-mono-500.woff2" },
];

function range(from, to) {
  const list = [];
  for (let cp = from; cp <= to; cp += 1) list.push(cp);
  return list;
}

// The four signs and the combining marks of Table B: the only required code
// points a file may lack without a line in Table D (R4 (a)).
const SIGNS = [0x00b7, 0x2013, 0x2026, 0x203a];

// Table B: the 241 required code points.
export const REQUIRED = [
  ...range(0x0020, 0x007e),
  0x00b7,
  ...range(0x00c0, 0x00c3),
  ...range(0x00c8, 0x00ca),
  0x00cc,
  0x00cd,
  ...range(0x00d2, 0x00d5),
  0x00d9,
  0x00da,
  0x00dd,
  ...range(0x00e0, 0x00e3),
  ...range(0x00e8, 0x00ea),
  0x00ec,
  0x00ed,
  ...range(0x00f2, 0x00f5),
  0x00f9,
  0x00fa,
  0x00fd,
  0x0102,
  0x0103,
  0x0110,
  0x0111,
  0x0128,
  0x0129,
  0x0168,
  0x0169,
  0x01a0,
  0x01a1,
  0x01af,
  0x01b0,
  ...range(0x1ea0, 0x1ef9),
  0x0300,
  0x0301,
  0x0302,
  0x0303,
  0x0306,
  0x0309,
  0x031b,
  0x0323,
  0x2013,
  0x2026,
  0x203a,
];

// Table C: the ranges a file may hold a glyph for.
const ALLOWED = [
  [0x0000, 0x00ff],
  [0x0102, 0x0103],
  [0x0110, 0x0111],
  [0x0128, 0x0129],
  [0x0131, 0x0131],
  [0x0152, 0x0153],
  [0x0168, 0x0169],
  [0x01a0, 0x01a1],
  [0x01af, 0x01b0],
  [0x02c6, 0x02dc],
  [0x0300, 0x0329],
  [0x1ea0, 0x1ef9],
  [0x2000, 0x206f],
  [0x20ab, 0x20ac],
  [0x2122, 0x2122],
  [0x2190, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
];

export function isAllowed(codePoint) {
  return ALLOWED.some(([from, to]) => codePoint >= from && codePoint <= to);
}

// Table D: the Vietnamese letters a family's file may lack. A letter is added
// only with the product owner's yes in the pull request that adds it.
export const TABLE_D = {
  "Be Vietnam Pro": [],
  "Bricolage Grotesque": [],
  "JetBrains Mono": [],
};

const MAX_FILE_BYTES = 51_200;
const MAX_TOTAL_BYTES = 307_200;
const BODY_FAMILIES = [
  "Be Vietnam Pro",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Roboto",
  "sans-serif",
];
const FONT_FILE = /\.(woff2?|ttf|otf|eot|ttc)$/i;
const FONT_SERVICES = ["fonts.googleapis.com", "fonts.gstatic.com"];
const FONTS_DIR = "src/fonts";
const BUILD_COMMAND = "pnpm --filter ./apps/web build";

function problem(file, requirement, message) {
  return { file, requirement, message };
}

function hex(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function isSignOrMark(codePoint) {
  return (
    SIGNS.includes(codePoint) || (codePoint >= 0x0300 && codePoint <= 0x03ff)
  );
}

// "U+031B" to 0x31b; anything else to null.
function parseCodePoint(text) {
  if (typeof text !== "string" || !/^U\+[0-9A-Fa-f]{4,6}$/.test(text)) {
    return null;
  }
  return Number.parseInt(text.slice(2), 16);
}

// "U+0020-007E,U+00B7" to the code points it names; null when a part is not
// a code point or a range of code points.
function parseUnicodes(text) {
  const found = new Set();
  for (const part of text.split(",")) {
    const m = /^\s*U\+([0-9A-Fa-f]{4,6})(?:-([0-9A-Fa-f]{4,6}))?\s*$/.exec(
      part,
    );
    if (!m) return null;
    const from = Number.parseInt(m[1], 16);
    const to = m[2] === undefined ? from : Number.parseInt(m[2], 16);
    for (let cp = from; cp <= to; cp += 1) found.add(cp);
  }
  return found;
}

// ---------------------------------------------------------------- parsing

// The index of the character that closes the block opened just before `from`.
function blockEnd(text, from) {
  let depth = 1;
  let quote = "";
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

// Splits at `separator` outside strings and parentheses, so the `;` of a
// data: address inside url() does not end a declaration.
function splitOutside(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function collapse(text) {
  return text.replace(/\s+/g, " ").trim();
}

function parseDeclarations(body) {
  const declarations = [];
  for (const part of splitOutside(body, ";")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const property = part.slice(0, colon).trim().toLowerCase();
    if (property === "") continue;
    declarations.push({ property, value: collapse(part.slice(colon + 1)) });
  }
  return declarations;
}

// Rules, declarations and at-rules of a style sheet, formatted or minified.
// The blocks of an at-rule such as @media are read too, so a font face is
// found wherever a built style sheet puts it.
export function parseCss(text) {
  const found = { fontFaces: [], rules: [], atRules: [] };
  readBlocks(text.replace(/\/\*[\s\S]*?\*\//g, ""), found);
  return found;
}

function readBlocks(text, found) {
  let at = 0;
  while (at < text.length) {
    const open = text.indexOf("{", at);
    const semicolon = text.indexOf(";", at);
    // A statement with no block, such as @import or @charset.
    if (semicolon >= 0 && (open < 0 || semicolon < open)) {
      const statement = collapse(text.slice(at, semicolon));
      if (statement.startsWith("@")) found.atRules.push(statement);
      at = semicolon + 1;
      continue;
    }
    if (open < 0) break;
    const prelude = collapse(text.slice(at, open));
    const close = blockEnd(text, open + 1);
    const body = text.slice(open + 1, close);
    if (/^@font-face$/i.test(prelude)) {
      found.fontFaces.push(parseDeclarations(body));
    } else if (prelude.startsWith("@")) {
      found.atRules.push(prelude);
      readBlocks(body, found);
    } else {
      found.rules.push({
        selector: prelude,
        declarations: parseDeclarations(body),
      });
    }
    at = close + 1;
  }
}

// The attributes of every <link> tag of a page; a bare attribute reads true.
export function parseLinks(html) {
  const links = [];
  const text = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of text.matchAll(/<link\b([^>]*)>/gi)) {
    const attributes = {};
    const pattern =
      /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    for (const m of tag[1].matchAll(pattern)) {
      attributes[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? true;
    }
    links.push(attributes);
  }
  return links;
}

function unquote(text) {
  const trimmed = text.trim();
  const quoted = /^(["'])(.*)\1$/.exec(trimmed);
  return quoted ? quoted[2] : trimmed;
}

function valueOf(declarations, property) {
  const found = declarations.filter((d) => d.property === property);
  return found.length === 1 ? found[0].value : null;
}

// The addresses of every url() of a `src` value, and its format() names.
function readSrc(value) {
  const urls = [...value.matchAll(/url\(\s*([^)]*?)\s*\)/gi)].map((m) =>
    unquote(m[1]),
  );
  const formats = [...value.matchAll(/format\(\s*([^)]*?)\s*\)/gi)].map((m) =>
    unquote(m[1]),
  );
  return { urls, formats, parts: splitOutside(value, ",").length };
}

function hasHost(address) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(address);
}

function rowOf(declarations) {
  const family = valueOf(declarations, "font-family");
  const weight = valueOf(declarations, "font-weight");
  if (family === null || weight === null) return null;
  return (
    TABLE_A.find(
      (row) => row.family === unquote(family) && String(row.weight) === weight,
    ) ?? null
  );
}

function isFontPreload(link) {
  const rel = typeof link.rel === "string" ? link.rel.toLowerCase() : "";
  const as = typeof link.as === "string" ? link.as.toLowerCase() : "";
  return rel.split(/\s+/).includes("preload") && as === "font";
}

// True when the text of a source file imports a file named fonts.css: an
// import, a require or a CSS @import. A comment that names the file does not.
export function importsFontsCss(text) {
  return /(?:\bimport\b|\bfrom\b|\brequire\b|@import)\s*(?:url\s*)?\(?\s*["'](?:[^"'\n]*\/)?fonts\.css(?:\?[^"'\n]*)?["']/.test(
    text,
  );
}

// ----------------------------------------------------------------- checks

// R1. `present`: the names in src/fonts. `tracked`: every path git tracks
// under apps/web, relative to it.
export function checkFileSet({ present, tracked }) {
  const problems = [];
  const wanted = TABLE_A.map((row) => row.file);
  for (const file of wanted) {
    if (!present.includes(file)) {
      problems.push(
        problem(`${FONTS_DIR}/${file}`, "R1", "the font file is missing"),
      );
    }
  }
  for (const file of present) {
    if (FONT_FILE.test(file) && !wanted.includes(file)) {
      problems.push(
        problem(
          `${FONTS_DIR}/${file}`,
          "R1",
          "a font file that Table A does not list",
        ),
      );
    }
  }
  const allowed = wanted.map((file) => `${FONTS_DIR}/${file}`);
  for (const path of tracked) {
    if (FONT_FILE.test(path) && !allowed.includes(path)) {
      problems.push(
        problem(
          path,
          "R1",
          "a committed font file outside the seven of Table A",
        ),
      );
    }
  }
  return problems;
}

// The code points a sources.json entry records as missing, as numbers.
function recordedMissing(sources, file) {
  const entry = Array.isArray(sources?.fonts)
    ? sources.fonts.find((e) => e?.file === file)
    : undefined;
  const list = Array.isArray(entry?.cut?.missing) ? entry.cut.missing : [];
  return list.map(parseCodePoint).filter((cp) => cp !== null);
}

// R3 to R6, from the facts read out of each file.
export function checkFonts({ fonts, sources }) {
  const problems = [];
  let total = 0;
  for (const row of TABLE_A) {
    const font = fonts.find((f) => f.file === row.file);
    if (!font) continue; // R1 names a missing file.
    const file = `${FONTS_DIR}/${row.file}`;
    total += font.bytes;

    if (!font.isWoff2) {
      problems.push(problem(file, "R3", "the file is not in WOFF2 format"));
    }
    if (font.axes.length > 0) {
      problems.push(
        problem(
          file,
          "R3",
          `the font is variable (axes: ${font.axes.join(", ")})`,
        ),
      );
    }
    if (font.italic) problems.push(problem(file, "R3", "the font is italic"));
    if (font.weight !== row.weight) {
      problems.push(
        problem(
          file,
          "R3",
          `the stored weight is ${font.weight}, Table A says ${row.weight}`,
        ),
      );
    }

    const recorded = recordedMissing(sources, row.file);
    const accepted = TABLE_D[row.family] ?? [];
    for (const cp of REQUIRED) {
      if (font.codePoints.has(cp)) continue;
      const waived =
        recorded.includes(cp) && (isSignOrMark(cp) || accepted.includes(cp));
      if (waived) continue;
      const why = recorded.includes(cp)
        ? `is a Vietnamese letter that Table D does not list for ${row.family}`
        : "is not recorded as missing in sources.json";
      problems.push(
        problem(file, "R4", `no glyph for ${hex(cp)}, which ${why}`),
      );
      break; // The first one is enough to name.
    }
    const held = recorded.find((cp) => font.codePoints.has(cp));
    if (held !== undefined) {
      problems.push(
        problem(
          file,
          "R4",
          `sources.json records ${hex(held)} as missing, but the file holds it`,
        ),
      );
    }

    const outside = [...font.codePoints]
      .sort((a, b) => a - b)
      .find((cp) => !isAllowed(cp));
    if (outside !== undefined) {
      problems.push(
        problem(
          file,
          "R5",
          `a glyph for ${hex(outside)}, outside the ranges of Table C`,
        ),
      );
    }

    if (font.bytes > MAX_FILE_BYTES) {
      problems.push(
        problem(
          file,
          "R6",
          `${font.bytes} bytes, over the ${MAX_FILE_BYTES} of one file`,
        ),
      );
    }
  }
  if (total > MAX_TOTAL_BYTES) {
    problems.push(
      problem(
        FONTS_DIR,
        "R6",
        `the font files are ${total} bytes together, over ${MAX_TOTAL_BYTES}`,
      ),
    );
  }
  return problems;
}

// R2 and R7. `importers`: the files under src, relative to it, whose text
// names fonts.css.
export function checkCss({ css, importers }) {
  const problems = [];
  const file = `${FONTS_DIR}/fonts.css`;
  const { fontFaces, rules, atRules } = parseCss(css);

  if (fontFaces.length !== TABLE_A.length) {
    problems.push(
      problem(
        file,
        "R2",
        `${fontFaces.length} @font-face rules, not ${TABLE_A.length}`,
      ),
    );
  }
  const seen = new Set();
  for (const declarations of fontFaces) {
    const row = rowOf(declarations);
    if (!row) {
      problems.push(
        problem(
          file,
          "R2",
          `an @font-face rule (${valueOf(declarations, "font-family")}, ${valueOf(declarations, "font-weight")}) that is no row of Table A`,
        ),
      );
      continue;
    }
    const name = `${row.family} ${row.weight}`;
    if (seen.has(row.file)) {
      problems.push(problem(file, "R2", `two @font-face rules for ${name}`));
    }
    seen.add(row.file);

    const wrong = (what) =>
      problems.push(problem(file, "R2", `${name}: ${what}`));
    if (valueOf(declarations, "font-style") !== "normal") {
      wrong("font-style is not normal");
    }
    if (valueOf(declarations, "font-display") !== "swap") {
      wrong("font-display is not swap");
    }
    if (declarations.some((d) => d.property === "unicode-range")) {
      wrong("unicode-range is set");
    }
    const src = valueOf(declarations, "src") ?? "";
    const { urls, formats, parts } = readSrc(src);
    if (/local\(/i.test(src)) wrong("src uses local()");
    if (parts !== 1 || urls.length !== 1) {
      wrong("src must be one url()");
    } else {
      const address = urls[0];
      const relativeName = address.replace(/^\.\//, "");
      if (hasHost(address) || address.startsWith("/")) {
        wrong(`the url ${address} is not relative`);
      } else if (relativeName !== row.file) {
        wrong(`the url ${address} is not ${row.file}`);
      }
    }
    if (formats.length !== 1 || formats[0] !== "woff2") {
      wrong('src has no format("woff2")');
    }
    const known = [
      "font-family",
      "font-style",
      "font-weight",
      "font-display",
      "src",
      "unicode-range",
    ];
    const extra = declarations.find((d) => !known.includes(d.property));
    if (extra) wrong(`an unexpected declaration, ${extra.property}`);
  }
  for (const row of TABLE_A) {
    if (!seen.has(row.file)) {
      problems.push(
        problem(
          file,
          "R2",
          `no @font-face rule for ${row.family} ${row.weight}`,
        ),
      );
    }
  }

  const body = rules.length === 1 && atRules.length === 0 ? rules[0] : null;
  if (!body || body.selector !== "body") {
    problems.push(
      problem(
        file,
        "R7",
        "besides the @font-face rules there must be exactly one rule, body",
      ),
    );
  } else if (
    body.declarations.length !== 1 ||
    body.declarations[0].property !== "font-family"
  ) {
    problems.push(
      problem(file, "R7", "the body rule must hold font-family only"),
    );
  } else {
    const families = splitOutside(body.declarations[0].value, ",").map(unquote);
    if (families.join("|") !== BODY_FAMILIES.join("|")) {
      problems.push(
        problem(
          file,
          "R7",
          `the font-family of body is ${body.declarations[0].value}`,
        ),
      );
    }
  }

  if (!importers.includes("main.tsx")) {
    problems.push(
      problem("src/main.tsx", "R7", "main.tsx does not import fonts.css"),
    );
  }
  for (const importer of importers) {
    if (importer !== "main.tsx") {
      problems.push(
        problem(
          `src/${importer}`,
          "R7",
          "only src/main.tsx may import fonts.css",
        ),
      );
    }
  }
  return problems;
}

// R8, on the index.html of the source.
export function checkPreload({ html }) {
  const file = "index.html";
  const preloads = parseLinks(html).filter(isFontPreload);
  if (preloads.length !== 1) {
    return [
      problem(
        file,
        "R8",
        `${preloads.length} font preload links, there must be exactly one`,
      ),
    ];
  }
  const problems = [];
  const link = preloads[0];
  const wanted = TABLE_A[0].file;
  const href = typeof link.href === "string" ? link.href : "";
  if (basename(href) !== wanted) {
    problems.push(
      problem(file, "R8", `the preload names ${href}, not ${wanted}`),
    );
  }
  if (link.type !== "font/woff2") {
    problems.push(problem(file, "R8", 'the preload has no type="font/woff2"'));
  }
  if (link.crossorigin === undefined) {
    problems.push(problem(file, "R8", "the preload has no crossorigin"));
  }
  return problems;
}

// The file of dist that an address of a built file names, or null.
function distPath(address, fromFile) {
  if (hasHost(address)) return null;
  const clean = address.split(/[?#]/)[0];
  if (clean.startsWith("/")) return clean.slice(1);
  return posix.normalize(posix.join(posix.dirname(fromFile), clean));
}

// R9 and R10. `fileNames`: every file of dist, relative to it. `cssFiles`
// and `textFiles`: name and content.
export function checkDist({ html, cssFiles, fileNames, textFiles }) {
  const problems = [];

  const fontFiles = fileNames.filter((name) => /\.woff2$/i.test(name));
  if (fontFiles.length !== TABLE_A.length) {
    problems.push(
      problem(
        "dist",
        "R9",
        `${fontFiles.length} .woff2 files in the build, not ${TABLE_A.length}`,
      ),
    );
  }
  for (const name of fontFiles) {
    const stem = TABLE_A.map((row) => row.file.replace(/\.woff2$/, "")).find(
      (s) =>
        basename(name).startsWith(`${s}-`) || basename(name) === `${s}.woff2`,
    );
    const hashed =
      stem !== undefined &&
      new RegExp(`^${stem}-[A-Za-z0-9_-]{6,}\\.woff2$`).test(basename(name));
    if (!hashed) {
      problems.push(
        problem(
          `dist/${name}`,
          "R9",
          "the name is not a font of Table A with a content hash",
        ),
      );
    }
  }

  // The address the built CSS gives for each face, as a file of dist.
  const built = new Map();
  for (const sheet of cssFiles) {
    for (const declarations of parseCss(sheet.text).fontFaces) {
      const row = rowOf(declarations);
      if (!row) continue;
      const file = `dist/${sheet.name}`;
      const { urls } = readSrc(valueOf(declarations, "src") ?? "");
      const address = urls[0] ?? "";
      const path = distPath(address, sheet.name);
      const stem = row.file.replace(/\.woff2$/, "");
      if (urls.length !== 1 || path === null) {
        problems.push(
          problem(
            file,
            "R9",
            `${row.family} ${row.weight}: the url ${address} is not a path on the app's own address`,
          ),
        );
      } else if (!fileNames.includes(path)) {
        problems.push(
          problem(
            file,
            "R9",
            `${row.family} ${row.weight}: the url ${address} names no file of the build`,
          ),
        );
      } else if (!basename(path).startsWith(`${stem}-`)) {
        problems.push(
          problem(
            file,
            "R9",
            `${row.family} ${row.weight}: the url ${address} is not its file`,
          ),
        );
      } else {
        built.set(row.file, path);
      }
    }
  }
  for (const row of TABLE_A) {
    if (!built.has(row.file)) {
      problems.push(
        problem(
          "dist",
          "R9",
          `the built CSS has no usable @font-face url for ${row.family} ${row.weight}`,
        ),
      );
    }
  }

  for (const file of textFiles) {
    if (file.text.includes("data:font")) {
      problems.push(
        problem(`dist/${file.name}`, "R9", "a font is inlined (data:font)"),
      );
    }
  }

  const page = "dist/index.html";
  const preloads = parseLinks(html).filter(isFontPreload);
  const main = built.get(TABLE_A[0].file);
  if (preloads.length !== 1) {
    problems.push(
      problem(
        page,
        "R10",
        `${preloads.length} font preload links in the built page, there must be exactly one`,
      ),
    );
  } else {
    const href = typeof preloads[0].href === "string" ? preloads[0].href : "";
    const path = distPath(href, "index.html");
    if (path === null || !fileNames.includes(path)) {
      problems.push(
        problem(
          page,
          "R10",
          `the preload href ${href} names no file of the build`,
        ),
      );
    } else if (path !== main) {
      problems.push(
        problem(
          page,
          "R10",
          `the preload href ${href} is not the url the built CSS gives for ${TABLE_A[0].family} ${TABLE_A[0].weight}`,
        ),
      );
    }
  }
  return problems;
}

// R11. `text` is a string or a Buffer.
export function checkNoFontService({ files }) {
  const problems = [];
  for (const file of files) {
    for (const host of FONT_SERVICES) {
      if (file.text.includes(host)) {
        problems.push(problem(file.name, "R11", `the file names ${host}`));
      }
    }
  }
  return problems;
}

// R14 and R15. `licenceFiles`: the files under src/fonts/licenses, written
// as `licenses/<name>`.
export function checkSources({ sources, fonts, licenceFiles }) {
  const problems = [];
  const record = `${FONTS_DIR}/sources.json`;
  if (!Array.isArray(sources?.fonts)) {
    return [problem(record, "R14", "sources.json has no `fonts` list")];
  }
  const licenceOf = new Map();
  for (const row of TABLE_A) {
    const file = `${FONTS_DIR}/${row.file}`;
    const entries = sources.fonts.filter((e) => e?.file === row.file);
    if (entries.length !== 1) {
      problems.push(
        problem(
          file,
          "R14",
          `${entries.length} entries in sources.json, there must be one`,
        ),
      );
      continue;
    }
    const entry = entries[0];
    const cut = entry.cut ?? {};
    const filled = (value) => typeof value === "string" && value.trim() !== "";
    for (const field of ["upstream", "version", "licence", "sha256"]) {
      if (!filled(entry[field])) {
        problems.push(problem(file, "R14", `sources.json has no ${field}`));
      }
    }
    for (const field of ["tool", "toolVersion", "command", "unicodes"]) {
      if (!filled(cut[field])) {
        problems.push(problem(file, "R14", `sources.json has no cut.${field}`));
      }
    }
    if (filled(cut.unicodes)) {
      const given = parseUnicodes(cut.unicodes);
      const left = given && REQUIRED.find((cp) => !given.has(cp));
      if (given === null) {
        problems.push(
          problem(
            file,
            "R14",
            "cut.unicodes is not a list of code points such as U+0020-007E,U+00B7",
          ),
        );
      } else if (left !== undefined) {
        problems.push(
          problem(
            file,
            "R14",
            `cut.unicodes leaves out ${hex(left)}, a code point of Table B`,
          ),
        );
      }
    }
    if (entry.family !== row.family || entry.weight !== row.weight) {
      problems.push(
        problem(
          file,
          "R14",
          `sources.json says ${entry.family} ${entry.weight}, Table A says ${row.family} ${row.weight}`,
        ),
      );
    }
    const font = fonts.find((f) => f.file === row.file);
    if (font && filled(entry.sha256) && entry.sha256 !== font.sha256) {
      problems.push(
        problem(
          file,
          "R14",
          `the SHA-256 of the file is ${font.sha256}, sources.json records ${entry.sha256}`,
        ),
      );
    }
    if (!Array.isArray(cut.missing)) {
      problems.push(
        problem(file, "R14", "sources.json has no cut.missing list"),
      );
    } else {
      const accepted = TABLE_D[row.family] ?? [];
      for (const text of cut.missing) {
        const cp = parseCodePoint(text);
        const ok =
          cp !== null &&
          REQUIRED.includes(cp) &&
          (isSignOrMark(cp) || accepted.includes(cp));
        if (!ok) {
          problems.push(
            problem(
              file,
              "R14",
              `sources.json records ${String(text)} as missing: it is neither a sign or combining mark of Table B nor a letter Table D lists for ${row.family}`,
            ),
          );
        }
      }
    }

    if (!filled(entry.licenceFile)) {
      problems.push(problem(file, "R15", "sources.json names no licence file"));
    } else {
      if (!licenceFiles.includes(entry.licenceFile)) {
        problems.push(
          problem(
            `${FONTS_DIR}/${entry.licenceFile}`,
            "R15",
            "the licence file does not exist",
          ),
        );
      }
      const first = licenceOf.get(row.family);
      const other = [...licenceOf].find(
        ([family, name]) => family !== row.family && name === entry.licenceFile,
      );
      if (other) {
        problems.push(
          problem(
            file,
            "R15",
            `the licence file ${entry.licenceFile} is the one of ${other[0]}; each family has its own`,
          ),
        );
      } else if (first === undefined) {
        licenceOf.set(row.family, entry.licenceFile);
      } else if (first !== entry.licenceFile) {
        problems.push(
          problem(
            file,
            "R15",
            `the licence file differs from the other files of ${row.family} (${first})`,
          ),
        );
      }
    }
  }
  const named = sources.fonts.map((entry) => entry?.licenceFile);
  for (const name of licenceFiles) {
    if (!named.includes(name)) {
      problems.push(
        problem(
          `${FONTS_DIR}/${name}`,
          "R15",
          "a licence file that no entry of sources.json names",
        ),
      );
    }
  }
  for (const entry of sources.fonts) {
    if (!TABLE_A.some((row) => row.file === entry?.file)) {
      problems.push(
        problem(
          `${FONTS_DIR}/${String(entry?.file)}`,
          "R14",
          "an entry of sources.json for a file that Table A does not list",
        ),
      );
    }
  }
  return problems;
}

// ------------------------------------------------------------ the command

// The facts of one font file. The only place that needs the font library.
export async function readFont(path) {
  const fontkit = await import("fontkit");
  const bytes = readFileSync(path);
  const font = fontkit.create(bytes);
  const os2 = font["OS/2"];
  const head = font.head;
  return {
    file: basename(path),
    bytes: bytes.length,
    isWoff2: bytes.subarray(0, 4).toString("latin1") === "wOF2",
    axes: Object.keys(font.variationAxes ?? {}),
    italic:
      Boolean(os2?.fsSelection?.italic) ||
      Boolean(head?.macStyle?.italic) ||
      font.italicAngle !== 0,
    weight: os2?.usWeightClass ?? 0,
    // The cmap table ends with an entry for U+FFFF that names glyph 0, "no
    // glyph"; only code points with a glyph of their own count.
    codePoints: new Set(
      font.characterSet.filter((cp) => font.glyphForCodePoint(cp).id !== 0),
    ),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function filesUnder(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else found.push(path);
  }
  return found;
}

function slashes(path) {
  return path.split("\\").join("/");
}

export function formatProblem({ file, requirement, message }) {
  return `check:fonts: ${file}: ${requirement}: ${message}`;
}

// Reads the web app at `webDir` and returns every problem found.
export async function findProblems(webDir) {
  const problems = [];
  const fontsDir = join(webDir, FONTS_DIR);
  const srcDir = join(webDir, "src");
  const distDir = join(webDir, "dist");

  // R1: the folder, and what git tracks under apps/web.
  const present = existsSync(fontsDir) ? readdirSync(fontsDir) : [];
  const listed = spawnSync("git", ["ls-files", "-z", "--", "."], {
    cwd: webDir,
    encoding: "utf8",
  });
  if (listed.status !== 0) {
    problems.push(
      problem(
        ".",
        "R1",
        "git ls-files failed; the committed files are unknown",
      ),
    );
  }
  const tracked = (listed.stdout ?? "").split("\0").filter(Boolean);
  problems.push(...checkFileSet({ present, tracked }));

  // R3 to R6, R14, R15.
  const fonts = [];
  for (const row of TABLE_A) {
    const path = join(fontsDir, row.file);
    if (!existsSync(path)) continue;
    try {
      fonts.push(await readFont(path));
    } catch (error) {
      problems.push(
        problem(
          `${FONTS_DIR}/${row.file}`,
          "R3",
          `the file cannot be read as a font (${error.message})`,
        ),
      );
    }
  }
  const sourcesPath = join(fontsDir, "sources.json");
  let sources = null;
  if (!existsSync(sourcesPath)) {
    problems.push(
      problem(`${FONTS_DIR}/sources.json`, "R14", "the file is missing"),
    );
  } else {
    try {
      sources = JSON.parse(readFileSync(sourcesPath, "utf8"));
    } catch (error) {
      problems.push(
        problem(
          `${FONTS_DIR}/sources.json`,
          "R14",
          `not valid JSON (${error.message})`,
        ),
      );
    }
  }
  problems.push(...checkFonts({ fonts, sources }));
  if (sources !== null) {
    const licencesDir = join(fontsDir, "licenses");
    const licenceFiles = existsSync(licencesDir)
      ? readdirSync(licencesDir).map((name) => `licenses/${name}`)
      : [];
    problems.push(...checkSources({ sources, fonts, licenceFiles }));
  }

  // R2, R7. Each file under src is read once, for this and for R11.
  const cssPath = join(fontsDir, "fonts.css");
  const srcFiles = (existsSync(srcDir) ? filesUnder(srcDir) : []).map(
    (path) => ({ path, bytes: readFileSync(path) }),
  );
  if (!existsSync(cssPath)) {
    problems.push(
      problem(`${FONTS_DIR}/fonts.css`, "R2", "the file is missing"),
    );
  } else {
    const importers = srcFiles
      .filter((file) => /\.(?:[cm]?[jt]sx?|css|html)$/.test(file.path))
      .filter((file) => file.path !== cssPath)
      .filter((file) => importsFontsCss(file.bytes.toString("utf8")))
      .map((file) => slashes(relative(srcDir, file.path)));
    problems.push(
      ...checkCss({ css: readFileSync(cssPath, "utf8"), importers }),
    );
  }

  // R8.
  const pagePath = join(webDir, "index.html");
  problems.push(...checkPreload({ html: readFileSync(pagePath, "utf8") }));

  // R9, R10.
  const distFiles = filesUnder(distDir);
  const fileNames = distFiles.map((path) => slashes(relative(distDir, path)));
  const isText = (name) => !FONT_FILE.test(name);
  const textFiles = distFiles
    .map((path, i) => ({ name: fileNames[i], path }))
    .filter((file) => isText(file.name))
    .map((file) => ({ name: file.name, text: readFileSync(file.path) }));
  problems.push(
    ...checkDist({
      html: readFileSync(join(distDir, "index.html"), "utf8"),
      cssFiles: textFiles
        .filter((file) => file.name.endsWith(".css"))
        .map((file) => ({ name: file.name, text: file.text.toString("utf8") })),
      fileNames,
      textFiles,
    }),
  );

  // R11: index.html, src and dist.
  problems.push(
    ...checkNoFontService({
      files: [
        { name: "index.html", text: readFileSync(pagePath) },
        ...srcFiles.map((file) => ({
          name: slashes(relative(webDir, file.path)),
          text: file.bytes,
        })),
        ...distFiles.map((path) => ({
          name: slashes(relative(webDir, path)),
          text: readFileSync(path),
        })),
      ],
    }),
  );
  return problems;
}

// Prints the problems of the web app at `webDir`; returns the exit code.
export async function main(webDir, { print = console.error } = {}) {
  if (!existsSync(join(webDir, "dist", "index.html"))) {
    print(
      formatProblem(
        problem(
          "dist/index.html",
          "R16",
          `not found; run \`${BUILD_COMMAND}\` first`,
        ),
      ),
    );
    return 1;
  }
  const problems = await findProblems(webDir);
  for (const found of problems) print(formatProblem(found));
  return problems.length > 0 ? 1 : 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const code = await main(webDir);
  if (code === 0) {
    console.log(
      "check:fonts: OK, the seven fonts, the CSS and the build hold.",
    );
  }
  process.exit(code);
}
