import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parseDeclarations, readCss } from "../test/css";

// R27 lives in apps/web; this file reads it from here because the CSS helper
// and the order test of TOKI-012 are in this package.
const web = resolve(import.meta.dirname, "../../../../apps/web");

describe("apps/web/src/app.css (R27, Table I)", () => {
  const rules = readCss(resolve(web, "src/app.css"));

  test("holds exactly the rules of Table I", () => {
    expect(rules).toHaveLength(2);
    expect(rules[0]!.media).toBeNull();
    expect(rules[0]!.selector).toBe("#root");
    expect(rules[0]!.declarations).toEqual(
      parseDeclarations("height:100%; background:var(--bg)"),
    );
    expect(rules[1]!.media).toBe("(max-width:719px)");
    expect(rules[1]!.selector).toBe("body");
    expect(rules[1]!.declarations).toEqual({ "font-size": "15px" });
  });

  test("index.html has the viewport meta with its three parts", () => {
    const html = readFileSync(resolve(web, "index.html"), "utf8");
    const tags = [...html.matchAll(/<meta\s+name="viewport"[^>]*>/g)];
    expect(tags).toHaveLength(1);
    const content = /content="([^"]*)"/.exec(tags[0]![0])![1]!;
    const parts = content.split(",").map((p) => p.trim());
    expect(parts).toContain("width=device-width");
    expect(parts).toContain("initial-scale=1");
    expect(parts).toContain("viewport-fit=cover");
  });
});
