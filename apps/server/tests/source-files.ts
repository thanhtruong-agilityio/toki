import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The .ts files under a folder, without node_modules. Source-scan tests use it;
// `withTests` also lists the *.test.ts files.
export function sourceFiles(dir: string, withTests: boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "node_modules" ? [] : sourceFiles(path, withTests);
    if (!name.endsWith(".ts")) return [];
    return withTests || !name.endsWith(".test.ts") ? [path] : [];
  });
}
