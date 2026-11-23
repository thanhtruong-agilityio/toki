import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const FOLDER = join(
  import.meta.dirname,
  "../../../src/features/create-channel",
);

// The source files of the folder, test files excepted.
export function folderSources(): Array<{ name: string; text: string }> {
  return readdirSync(FOLDER)
    .filter((name) => /\.(ts|tsx|css)$/.test(name) && !/\.test\./.test(name))
    .map((name) => ({ name, text: readFileSync(join(FOLDER, name), "utf8") }));
}
