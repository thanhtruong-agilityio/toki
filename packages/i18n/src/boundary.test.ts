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

function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
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
