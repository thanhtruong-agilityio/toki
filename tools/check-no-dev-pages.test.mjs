import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check, DEV_PAGES } from "./check-no-dev-pages.mjs";

const script = join(
  dirname(fileURLToPath(import.meta.url)),
  "check-no-dev-pages.mjs",
);

// A repository folder with apps/web and the given files; returns apps/web.
function makeWeb(files) {
  const base = mkdtempSync(join(tmpdir(), "dev-pages-"));
  const web = join(base, "apps/web");
  mkdirSync(web, { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(web, path)), { recursive: true });
    writeFileSync(join(web, path), text);
  }
  return { base, web };
}

const clean = {
  "vite.config.ts": "export default { plugins: [] };\n",
  "dist/index.html": '<script type="module" src="/assets/main.js"></script>',
  "dist/assets/main.js": "console.log('app');",
};

test("a clean build passes", () => {
  const { base, web } = makeWeb(clean);
  assert.deepEqual(check(web, base), []);
});

test("a build with no dist folder yet passes the configuration check", () => {
  const { base, web } = makeWeb({ "vite.config.ts": clean["vite.config.ts"] });
  assert.deepEqual(check(web, base), []);
});

test("fails and names an HTML file other than index.html in the output", () => {
  const { base, web } = makeWeb({
    ...clean,
    "dist/shell-fixture.html": "<p>x</p>",
  });
  const problems = check(web, base);
  assert.ok(
    problems.some((p) => p.startsWith("apps/web/dist/shell-fixture.html:")),
    problems.join("\n"),
  );
});

test("fails and names a file whose content names a dev page", () => {
  const { base, web } = makeWeb({
    ...clean,
    "dist/assets/main.js": "fetch('/shell-fixture.html')",
  });
  const problems = check(web, base);
  assert.ok(
    problems.some(
      (p) =>
        p.startsWith("apps/web/dist/assets/main.js:") &&
        p.includes("shell-fixture.html"),
    ),
    problems.join("\n"),
  );
});

test("fails and names the configuration that adds the page to the build input", () => {
  const { base, web } = makeWeb({
    ...clean,
    "vite.config.ts": `export default { build: { rolldownOptions: { input: { main: "index.html", fixture: "shell-fixture.html" } } } };\n`,
  });
  const problems = check(web, base);
  assert.ok(
    problems.some(
      (p) =>
        p.startsWith("apps/web/vite.config.ts:") &&
        p.includes("shell-fixture.html"),
    ),
    problems.join("\n"),
  );
});

test("fails on any page other than index.html in the build input or build.lib", () => {
  const { base, web } = makeWeb({
    ...clean,
    "vite.config.ts": `export default { build: { lib: { entry: "src/other.html" } } };\n`,
  });
  const problems = check(web, base);
  assert.ok(
    problems.some(
      (p) =>
        p.startsWith("apps/web/vite.config.ts:") && p.includes("other.html"),
    ),
    problems.join("\n"),
  );
});

test("index.html in the configuration is fine", () => {
  const { base, web } = makeWeb({
    ...clean,
    "vite.config.ts": `export default { build: { rolldownOptions: { input: "index.html" } } };\n`,
  });
  assert.deepEqual(check(web, base), []);
});

test("the command exits 1 and prints the file, and 0 for a clean build", () => {
  const bad = makeWeb({ ...clean, "dist/shell-fixture.html": "<p>x</p>" });
  const failed = spawnSync("node", [script, bad.web], { encoding: "utf8" });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /apps\/web\/dist\/shell-fixture\.html/);

  const good = makeWeb(clean);
  const passed = spawnSync("node", [script, good.web], { encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
});

test("the shell fixture is one of the dev pages", () => {
  assert.ok(DEV_PAGES.includes("shell-fixture.html"));
});
