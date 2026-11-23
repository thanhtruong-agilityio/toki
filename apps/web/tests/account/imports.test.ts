import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// R24: the files of `apps/web/src/account` reach `@toki/client-core` and `@toki/platform` only
// through their `index.ts`: no `@toki/platform/web`, no path into a package's `src`.
const dir = join(import.meta.dirname, "../../src/account");

describe("the imports of apps/web/src/account (R24)", () => {
  const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f));
  test("there are files to check", () =>
    expect(files.length).toBeGreaterThan(5));
  test.each(files)("%s", (file) => {
    const source = readFileSync(join(dir, file), "utf8");
    const specs = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
      (m) => m[1]!,
    );
    for (const spec of specs) {
      expect(spec, `${file}: ${spec}`).not.toMatch(
        /^@toki\/platform\/(?!react)/,
      );
      expect(spec, `${file}: ${spec}`).not.toMatch(/^@toki\/client-core\/.+/);
      expect(spec, `${file}: ${spec}`).not.toMatch(/@toki\/[^/]+\/src\//);
      expect(spec, `${file}: ${spec}`).not.toMatch(/\.\.\/\.\.\/.*packages\//);
    }
  });
});
