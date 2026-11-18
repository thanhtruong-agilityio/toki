import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");

function sources(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

// Removes comments but leaves strings alone, so "a//b" does not hide the rest of the line.
export function withoutComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const char = text[i] ?? "";
    const next = text[i + 1];
    if (char === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (char === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (char === '"' || char === "'" || char === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== char) j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else {
      out += char;
      i++;
    }
  }
  return out;
}

const files = sources(src).map((path) => ({
  name: relative(src, path),
  code: withoutComments(readFileSync(path, "utf8")),
}));

describe("the boundary of the package (R12, R21, R22)", () => {
  it("finds the source files", () => {
    expect(files.map((file) => file.name)).toContain("format.ts");
  });

  it("R12: no file reads the language of the device or the browser", () => {
    for (const { name, code } of files) {
      expect(code, `${name} uses navigator`).not.toMatch(/\bnavigator\b/);
      expect(code, `${name} uses a toLocale*String`).not.toMatch(
        /\.toLocale(Date|Time)?String\b/,
      );
      if (name !== "format.ts")
        expect(code, `${name} uses Intl`).not.toMatch(/\bIntl\b/);
    }
  });

  it("R12: every use of Intl in format.ts gives a language code or a Language variable first", () => {
    const code = files.find((file) => file.name === "format.ts")?.code ?? "";
    const calls = [...code.matchAll(/\bIntl\.\w+\s*\(\s*([^),]*)/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const [, first] of calls) {
      const argument = (first ?? "").trim();
      expect(argument, "Intl call with no explicit language").not.toBe("");
      expect(argument).not.toMatch(/^(undefined|void\b|null)/);
      expect(argument).toMatch(/^("[^"]+"|'[^']+'|language)$/);
    }
  });

  it("R12: Intl is only ever called as Intl.<Name>(…), never aliased or reached through globalThis", () => {
    for (const { name, code } of files) {
      expect(code, `${name} uses globalThis`).not.toMatch(/\bglobalThis\b/);
    }
    const code = files.find((file) => file.name === "format.ts")?.code ?? "";
    const all = code.match(/\bIntl\b/g) ?? [];
    const calls = code.match(/\bIntl\.\w+\s*\(/g) ?? [];
    expect(all.length).toBe(calls.length);
  });

  it("the comment stripper keeps strings and drops comments", () => {
    expect(
      withoutComments('const a = "x//y"; // gone\nconst b = 1; /* gone */'),
    ).toBe('const a = "x//y"; \nconst b = 1; ');
  });

  it("R21: only react.ts imports react", () => {
    for (const { name, code } of files) {
      const importsReact = /from\s+["']react(\/[^"']*)?["']/.test(code);
      expect(importsReact, name).toBe(name === "react.ts");
    }
  });

  it("R21: exports, peerDependencies and no dependencies", () => {
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(pkg.exports).toEqual({
      ".": "./src/index.ts",
      "./react": "./src/react.ts",
    });
    expect(pkg.peerDependencies).toHaveProperty("react");
    expect(pkg).not.toHaveProperty("dependencies");
  });

  it("R22: no file under src uses a DOM global or a Node API", () => {
    for (const { name, code } of files) {
      expect(code, name).not.toMatch(
        /\b(window|document|localStorage|sessionStorage)\b/,
      );
      expect(code, name).not.toMatch(/from\s+["']node:/);
      expect(code, name).not.toMatch(/\bprocess\./);
    }
  });
});
