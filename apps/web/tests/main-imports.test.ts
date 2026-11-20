import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// TOKI-097 R26: the token of a Join link is taken from the address before the router is loaded, because the
// router reads the address when its module loads. ES modules run in the order of the imports, so the file
// that takes the token must come before every import that can load the router.
describe("the imports of main.tsx (TOKI-097 R26)", () => {
  const source = readFileSync(
    join(import.meta.dirname, "../src/main.tsx"),
    "utf8",
  );
  const imports = [
    ...source.matchAll(/^import\s+(?:[^"']*from\s+)?["']([^"']+)["'];?$/gm),
  ].map((m) => m[1]!);

  it("takes the token before the router, the providers and any other script of the app", () => {
    const capture = imports.indexOf("./join/capture-on-load");
    expect(capture).toBeGreaterThanOrEqual(0);
    for (const name of ["./router", "./app-providers"]) {
      const at = imports.indexOf(name);
      expect(at, name).toBeGreaterThan(capture);
    }
    // only style sheets come before it (the rule of the style order test)
    expect(imports.slice(0, capture).every((i) => i.endsWith(".css"))).toBe(
      true,
    );
  });
});
