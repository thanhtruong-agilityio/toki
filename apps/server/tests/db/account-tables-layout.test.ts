import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_URL = new URL(
  "../../src/db/account-tables-layout.test.ts",
  `file://${import.meta.dirname}/`,
);

// File reads only: no database. R6 (no time default in the schema files),
// R21 (the four tables are not exported, no import leaves a module) and R26
// (the SQL helper is imported by tests only).
const src = join(dirname(fileURLToPath(SRC_URL)), "..");
const schemaFiles = ["members", "auth", "notifications"].map((m) =>
  join(src, "modules", m, "schema.ts"),
);
const indexFiles = ["members", "auth", "notifications"].map((m) =>
  join(src, "modules", m, "index.ts"),
);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("account table layout", () => {
  it("uses no time default in the three schema files (R6)", () => {
    for (const file of schemaFiles) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/defaultNow|now\(\)/);
    }
  });

  it("exports none of the four tables from an index.ts (R21)", () => {
    for (const file of indexFiles) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(
        /\b(users|login_codes|loginCodes|sessions|devices)\b/,
      );
    }
  });

  it("imports nothing outside drizzle-orm, uuidv7 and src/db from a schema file (R21)", () => {
    for (const file of schemaFiles) {
      const text = readFileSync(file, "utf8");
      const targets = [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
      for (const target of targets) {
        const ok =
          target.startsWith("drizzle-orm") ||
          target === "uuidv7" ||
          /^\.\.\/\.\.\/db\//.test(target);
        expect(ok, `${file} imports ${target}`).toBe(true);
      }
    }
  });

  it("imports test-rows only from test files (R26)", () => {
    for (const file of walk(src)) {
      if (!/\.ts$/.test(file) || file.endsWith("test-rows.ts")) continue;
      if (/\.test\.ts$/.test(file)) continue;
      expect(readFileSync(file, "utf8"), file).not.toMatch(/test-rows/);
    }
  });
});
