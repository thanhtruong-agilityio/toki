import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ARCHIVE = join(import.meta.dirname, "../../src/channel-archive");

// The sources of the folder, test files excepted (there are none inside it: the tests mirror src).
export function ownSources(): Array<{ name: string; text: string }> {
  if (!existsSync(ARCHIVE)) return [];
  return readdirSync(ARCHIVE)
    .filter((name) => /\.(ts|tsx|css)$/.test(name))
    .map((name) => ({ name, text: readFileSync(join(ARCHIVE, name), "utf8") }));
}
