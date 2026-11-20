import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { newId } from "../src/ids";

// Files of apps/web/src that may touch a random source. A later ticket that needs `crypto` for
// something that is not an id adds its file here and says so in its own spec.
const ALLOWED_FILES = ["ids.ts"];

const PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

describe("newId (R2)", () => {
  test("returns a UUIDv7 and a different one each time", () => {
    const ids = Array.from({ length: 50 }, () => newId());
    for (const id of ids) expect(id).toMatch(PATTERN);
    expect(new Set(ids).size).toBe(50);
  });

  test("works when the page has no crypto.randomUUID", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(
        globalThis.crypto,
      ),
    });
    expect(newId()).toMatch(PATTERN);
  });

  test("only ids.ts touches a random source", () => {
    const root = join(__dirname, "../src");
    const offenders = sourceFiles(root)
      .map((file) => relative(root, file))
      .filter((file) => !ALLOWED_FILES.includes(file))
      .filter((file) =>
        /crypto\.|randomUUID|getRandomValues/.test(
          readFileSync(join(root, file), "utf8"),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
