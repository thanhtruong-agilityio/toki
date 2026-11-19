// Keeps the dev-only pages out of the production build (TOKI-016 R2).
// Run by the `check:no-dev-pages` script, last in `build`. Exits 1 and names
// the file or the setting when a page leaks. The page list is shared: another
// dev-only page (the shell fixture of TOKI-015) adds its own entry to PAGES.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The page name and the text that only that page holds.
const PAGES = [
  { name: "preview.html", marker: "preview-root" },
  // The shell fixture of TOKI-015 (R32): `more-rows` is a test id that only it holds.
  { name: "shell-fixture.html", marker: "more-rows" },
];
const TEXT_FILE = /\.(html|js|mjs|css|map|json|txt|svg|webmanifest)$/i;

function filesUnder(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else found.push(path);
  }
  return found;
}

function inputNames(input) {
  if (input === undefined || input === null) return [];
  if (typeof input === "string") return [input];
  if (Array.isArray(input)) return input.map(String);
  return Object.values(input).map(String);
}

// Pure: the problems of a build folder and of the Vite config it came from.
export function findProblems({ dist, config }) {
  const problems = [];

  const build = config?.build ?? {};
  for (const key of ["rollupOptions", "rolldownOptions"]) {
    for (const name of inputNames(build[key]?.input)) {
      const base = name.split(/[\\/]/).pop();
      if (base !== "index.html") {
        problems.push(
          `build.${key}.input lists ${name}; only index.html may be built`,
        );
      }
    }
  }
  if (build.lib) problems.push("build.lib is set; the app builds no library");

  if (!existsSync(dist)) {
    problems.push(`${dist} does not exist; run the build first`);
    return problems;
  }
  for (const file of filesUnder(dist)) {
    const name = relative(dist, file).split("\\").join("/");
    if (name.endsWith(".html") && name !== "index.html") {
      problems.push(`${name} is in dist; only index.html may be built`);
    }
    // Only text files can hold the marker; fonts and images are skipped.
    if (!TEXT_FILE.test(name)) continue;
    const text = readFileSync(file, "utf8");
    for (const page of PAGES) {
      for (const needle of [page.marker, page.name]) {
        if (text.includes(needle)) {
          problems.push(`${name} contains "${needle}" (page ${page.name})`);
        }
      }
    }
  }
  return problems;
}

async function main() {
  const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const at = args.indexOf("--dist");
  const dist = at >= 0 ? resolve(args[at + 1]) : join(webDir, "dist");

  const { loadConfigFromFile } = await import("vite");
  const loaded = await loadConfigFromFile(
    { command: "build", mode: "production" },
    join(webDir, "vite.config.ts"),
  );
  const problems = findProblems({ dist, config: loaded?.config });
  if (problems.length > 0) {
    for (const problem of problems)
      console.error(`check:no-dev-pages: ${problem}`);
    return 1;
  }
  console.log("check:no-dev-pages: OK, no dev page in the build.");
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exit(await main());
}
