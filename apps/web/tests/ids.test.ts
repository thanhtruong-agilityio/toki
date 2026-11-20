import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "../src/ids";

const PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// The files of apps/web/src that may touch a random source (R33).
const ALLOWED = ["ids.ts"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newId (R33)", () => {
  it("makes a uuid v7 of 36 characters", () => {
    expect(newId()).toMatch(PATTERN);
    expect(newId()).not.toBe(newId());
  });

  it("works when crypto.randomUUID does not exist", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    expect(newId()).toMatch(PATTERN);
  });

  it("is the only file of apps/web/src that touches a random source", () => {
    const root = join(__dirname, "..", "src");
    const offenders = sourceFiles(root)
      .filter((file) =>
        /crypto\.|randomUUID|getRandomValues/.test(readFileSync(file, "utf8")),
      )
      .map((file) => relative(root, file))
      .filter((file) => !ALLOWED.includes(file));
    expect(offenders).toEqual([]);
  });
});
