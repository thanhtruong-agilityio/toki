import { describe, expect, test } from "vitest";
import { folderSources } from "./support";

// R3: only deps.ts imports these targets.
const FORBIDDEN = [
  /from\s+["']@toki\/client-core["']/,
  /from\s+["'](\.\.\/)+client["']/,
  /from\s+["'](\.\.\/)+ids["']/,
  // a file of features/ outside this folder: ../<other>
  /from\s+["']\.\.\/(?!\.\.)[^"']*["']/,
  /from\s+["']\.\.\/\.\.\/features\//,
];

// R22: no relative path into packages/*, no platform APIs.
const PLATFORM =
  /\b(Notification|localStorage|sessionStorage|indexedDB|serviceWorker|AudioContext|new Audio)\b/;
const PACKAGES = /from\s+["'](\.\.\/)+packages\//;

export function offenders(sources: Array<{ name: string; text: string }>) {
  return sources
    .filter((file) => file.name !== "deps.ts" && /\.tsx?$/.test(file.name))
    .filter((file) => FORBIDDEN.some((pattern) => pattern.test(file.text)))
    .map((file) => file.name);
}

describe("deps.ts is the one seam (R3)", () => {
  test("the scan sees an import of each target (negative control)", () => {
    for (const line of [
      'import { x } from "@toki/client-core";',
      'import { x } from "../../client";',
      'import { x } from "../../ids";',
      'import { x } from "../people/PeoplePicker";',
    ]) {
      expect(offenders([{ name: "A.tsx", text: line }])).toEqual(["A.tsx"]);
    }
    expect(offenders([{ name: "deps.ts", text: 'from "../../ids"' }])).toEqual(
      [],
    );
  });

  test("no file but deps.ts imports the client, the store, the ids, client-core or another feature", () => {
    expect(offenders(folderSources())).toEqual([]);
  });

  test("deps.ts exists and holds the stand-ins marked with their tickets", () => {
    const deps = folderSources().find((file) => file.name === "deps.ts")!;
    expect(deps.text).toMatch(/TODO\(TOKI-033\)/);
    expect(deps.text).toMatch(/TODO\(TOKI-034\)/);
  });
});

describe("boundaries (R22)", () => {
  test("no relative path into packages and no platform API", () => {
    for (const file of folderSources().filter((f) => /\.tsx?$/.test(f.name))) {
      expect(file.text, file.name).not.toMatch(PACKAGES);
      expect(file.text, file.name).not.toMatch(PLATFORM);
    }
  });
});
