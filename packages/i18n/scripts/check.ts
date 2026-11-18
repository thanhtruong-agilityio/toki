// Runs the missing-translation check on the committed catalogs (R16, R17, D-064).
// `pnpm --filter @toki/i18n check`, or `pnpm i18n:check` at the root.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  checkCatalogs,
  checkNamespaceFiles,
  countKeys,
  formatProblem,
} from "../src/check";
import { LANGUAGES, type Language } from "../src/languages";
import { en } from "../src/messages/en";
import { vi } from "../src/messages/vi";

const catalogs = { en, vi };

function namespaceFiles(language: Language): string[] {
  const folder = fileURLToPath(
    new URL(`../src/messages/${language}/`, import.meta.url),
  );
  return readdirSync(folder)
    .filter(
      (name) =>
        name.endsWith(".ts") &&
        name !== "index.ts" &&
        !name.endsWith(".test.ts"),
    )
    .map((name) => name.slice(0, -3));
}

const files = { en: namespaceFiles("en"), vi: namespaceFiles("vi") };
const problems = [
  ...checkNamespaceFiles(files, catalogs),
  ...checkCatalogs(catalogs),
];

if (problems.length === 0) {
  console.log(
    `i18n check: ${countKeys(en)} keys, ${LANGUAGES.length} languages, no problem`,
  );
} else {
  for (const problem of problems) console.log(formatProblem(problem));
  console.log(
    `i18n check: ${problems.length} ${problems.length === 1 ? "problem" : "problems"}`,
  );
  process.exitCode = 1;
}
