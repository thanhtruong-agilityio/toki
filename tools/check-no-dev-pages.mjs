// Dev pages stay out of the production build (TOKI-015 R32). A dev page is an
// HTML page that Vite serves in development and the build must not contain:
// the shell fixture now, the preview page of TOKI-016 later (it adds its name to
// DEV_PAGES). The check fails, and names the file, when
//   - apps/web/dist holds an HTML file other than index.html,
//   - any file of apps/web/dist names a dev page, or
//   - the Vite configuration lists an HTML page other than index.html (as the
//     build input or in `build.lib`), or names a dev page.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// The file names of the dev pages. TOKI-016 adds its page here.
export const DEV_PAGES = ["shell-fixture.html"];

function filesUnder(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else found.push(path);
  }
  return found;
}

// Returns one line per problem, each naming a file relative to `webDir`'s
// repository (`root` by default). An empty list means the build is clean.
export function check(webDir, base = root) {
  const problems = [];
  const name = (path) => relative(base, path).split("\\").join("/");

  for (const file of readdirSync(webDir).filter((f) =>
    /^vite\.config\.[cm]?[jt]s$/.test(f),
  )) {
    const path = join(webDir, file);
    const text = readFileSync(path, "utf8");
    for (const page of DEV_PAGES) {
      if (text.includes(page)) {
        problems.push(`${name(path)}: the build configuration names ${page}`);
      }
    }
    // Any other page than index.html as an input or a library entry.
    const pages = new Set(text.match(/[\w./@-]+\.html\b/g) ?? []);
    for (const page of pages) {
      if (DEV_PAGES.includes(page.split("/").pop())) continue;
      if (page.split("/").pop() !== "index.html") {
        problems.push(
          `${name(path)}: the build configuration lists ${page}, a page other than index.html`,
        );
      }
    }
  }

  const dist = join(webDir, "dist");
  if (existsSync(dist)) {
    for (const path of filesUnder(dist)) {
      if (path.endsWith(".html") && path !== join(dist, "index.html")) {
        problems.push(`${name(path)}: an HTML file other than index.html`);
      }
      const content = readFileSync(path);
      for (const page of DEV_PAGES) {
        if (content.includes(page)) {
          problems.push(`${name(path)}: names the dev page ${page}`);
        }
      }
    }
  }
  return problems;
}

function main() {
  const webDir = process.argv[2]
    ? resolve(process.argv[2])
    : join(root, "apps/web");
  const base = process.argv[2] ? resolve(webDir, "../..") : root;
  const problems = check(webDir, base);
  if (problems.length > 0) {
    for (const line of problems) console.error(`check:no-dev-pages: ${line}`);
    console.error(
      "check:no-dev-pages: a dev page is in the production build; remove it from the build input and output.",
    );
    return 1;
  }
  console.log("check:no-dev-pages: no dev page in the build.");
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exit(main());
}
