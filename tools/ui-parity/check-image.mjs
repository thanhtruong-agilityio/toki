import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { playwrightVersion } from "./container.mjs";

// R8: the image and the lockfile must name the same Playwright. Inside the container the installed
// Playwright always has the version of the lockfile (the install is frozen), so the check that
// means something is whether the image holds the Chromium that this Playwright needs.

// The Chromium revision that the installed Playwright needs, from its browsers.json.
export function requiredRevision(browsersJson) {
  const chromium = browsersJson.browsers.find((b) => b.name === "chromium");
  if (!chromium) throw new Error("browsers.json has no chromium entry");
  return String(chromium.revision);
}

// The Chromium revisions in the image's browsers folder, from the names `chromium-<revision>`.
export function installedRevisions(entries) {
  return entries
    .map((entry) => /^chromium-(\d+)$/.exec(entry))
    .filter(Boolean)
    .map((match) => match[1]);
}

// Null when the image holds the revision, else the message that names both.
export function imageMismatch({
  playwrightVersion: version,
  required,
  installed,
}) {
  if (installed.includes(required)) return null;
  return `parity: the image has chromium ${installed.join(", ") || "none"} but Playwright ${version} needs ${required}; use the image of the Playwright version in pnpm-lock.yaml`;
}

// The command line, run in the copy of the repository inside the container.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const require = createRequire(`${process.cwd()}/package.json`);
  // playwright-core is a dependency of @playwright/test, so it is found from there. Its
  // browsers.json is not exported, but its package.json is, and the file is read by path.
  const fromTest = createRequire(require.resolve("@playwright/test"));
  const core = dirname(fromTest.resolve("playwright-core/package.json"));
  const browsers = JSON.parse(readFileSync(`${core}/browsers.json`, "utf8"));
  const folder = process.env.PLAYWRIGHT_BROWSERS_PATH || "/ms-playwright";
  const message = imageMismatch({
    playwrightVersion: playwrightVersion(
      readFileSync("pnpm-lock.yaml", "utf8"),
    ),
    required: requiredRevision(browsers),
    installed: installedRevisions(readdirSync(folder)),
  });
  if (message) {
    console.error(message);
    process.exit(1);
  }
}
