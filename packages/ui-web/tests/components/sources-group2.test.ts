import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { readCss } from "../support/css";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../../src/components`;

const componentsDir = resolve(SRC_DIR);
const tokensCss = resolve(SRC_DIR, "../../../tokens/src/tokens.css");
const folders = ["Avatar", "PresenceDot", "EmptyState", "Toast"];

const files = folders.flatMap((name) =>
  readdirSync(join(componentsDir, name)).map((f) =>
    join(componentsDir, name, f),
  ),
);
const cssFiles = files.filter((f) => f.endsWith(".css"));
const sources = files.filter(
  (f) =>
    /\.tsx?$/.test(f) &&
    !/\.test\.tsx?$/.test(f) &&
    !/\.examples\.tsx$/.test(f),
);

const tokenNames = new Set(
  [...readFileSync(tokensCss, "utf8").matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map(
    (m) => m[1],
  ),
);
// The two names that the Avatar defines itself (R3).
const own = new Set(["--h", "--s"]);

describe("group 2 sources (R1, R3)", () => {
  test("each folder holds one CSS file", () => {
    expect(
      cssFiles.map((f) => f.split("/").slice(-2).join("/")).sort(),
    ).toEqual([
      "Avatar/Avatar.css",
      "EmptyState/EmptyState.css",
      "PresenceDot/PresenceDot.css",
      "Toast/Toast.css",
    ]);
  });

  test("each folder holds only the files that R1 names", () => {
    const allowed: Record<string, string[]> = {
      Avatar: ["Avatar", "getInitials"],
      PresenceDot: ["PresenceDot"],
      EmptyState: ["EmptyState"],
      Toast: ["Toast", "ToastProvider", "ToastRegion", "toastPlace"],
    };
    const standard = ["Avatar", "PresenceDot", "EmptyState", "Toast"];
    for (const name of folders) {
      const expected = new Set<string>([
        `${name}.tsx`,
        `${name}.css`,
        `${name}.examples.tsx`,
        "index.ts",
        ...allowed[name]!.filter((n) => n !== name).map((n) =>
          n === "getInitials" || n === "toastPlace" ? `${n}.ts` : `${n}.tsx`,
        ),
      ]);
      const actual = readdirSync(join(componentsDir, name));
      expect(actual.sort(), name).toEqual([...expected].sort());
      expect(standard).toContain(name);
    }
  });

  test("no colour literal, and every var() is a token or --h or --s (R3)", () => {
    const literal = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(\s*\d/i;
    for (const file of cssFiles) {
      for (const rule of readCss(file)) {
        for (const [prop, value] of Object.entries(rule.declarations)) {
          expect(value, `${file} ${rule.selector} ${prop}`).not.toMatch(
            literal,
          );
          for (const m of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
            const name = m[1]!;
            expect(
              tokenNames.has(name) || own.has(name),
              `${rule.selector} uses ${name}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  test("the only look selector is the Toast button's (R20)", () => {
    const withLook = cssFiles.flatMap((file) =>
      readCss(file)
        .filter((r) => /data-(eff|look|accent|density)/.test(r.selector))
        .map((r) => r.selector),
    );
    expect(withLook).toEqual(['[data-eff="focus"] .toast button']);
  });

  test("no source imports i18n, tokens or platform, or uses a storage, notification or audio API (R3)", () => {
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(
        /@toki\/(i18n|tokens|platform)|localStorage|sessionStorage|indexedDB|\bNotification\b|serviceWorker|\bAudio\b|AudioContext/,
      );
    }
  });
});
