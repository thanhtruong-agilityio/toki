// Tests of check-no-dev-pages.mjs (TOKI-016 R2). Run by `pnpm test` at the
// repository root.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { findProblems } from "./check-no-dev-pages.mjs";

function makeDist(files) {
  const dir = mkdtempSync(join(tmpdir(), "no-dev-pages-"));
  for (const [name, text] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
  }
  return dir;
}

const cleanConfig = { build: {} };

test("a build with index.html only passes", () => {
  const dist = makeDist({
    "index.html": "<div id=root></div>",
    "assets/app.js": "console.log(1)",
  });
  try {
    assert.deepEqual(findProblems({ dist, config: cleanConfig }), []);
  } finally {
    rmSync(dist, { recursive: true });
  }
});

test("a second html file in dist is named", () => {
  const dist = makeDist({ "index.html": "", "preview.html": "" });
  try {
    const problems = findProblems({ dist, config: cleanConfig });
    assert.ok(problems.some((p) => p.includes("preview.html")));
  } finally {
    rmSync(dist, { recursive: true });
  }
});

test("the marker or the page name inside any file is named", () => {
  const dist = makeDist({
    "index.html": "",
    "assets/app.js": 'x("preview-root")',
    "assets/other.js": 'y("/preview.html")',
  });
  try {
    const problems = findProblems({ dist, config: cleanConfig });
    assert.ok(
      problems.some(
        (p) => p.includes("assets/app.js") && p.includes("preview-root"),
      ),
    );
    assert.ok(
      problems.some(
        (p) => p.includes("assets/other.js") && p.includes("preview.html"),
      ),
    );
  } finally {
    rmSync(dist, { recursive: true });
  }
});

test("a page in the build input is named, for either bundler option", () => {
  const dist = makeDist({ "index.html": "" });
  try {
    for (const key of ["rollupOptions", "rolldownOptions"]) {
      const problems = findProblems({
        dist,
        config: { build: { [key]: { input: { preview: "preview.html" } } } },
      });
      assert.ok(
        problems.some((p) => p.includes(key) && p.includes("preview.html")),
      );
    }
    const listed = findProblems({
      dist,
      config: {
        build: { rollupOptions: { input: ["index.html", "x/preview.html"] } },
      },
    });
    assert.ok(listed.some((p) => p.includes("preview.html")));
  } finally {
    rmSync(dist, { recursive: true });
  }
});

test("index.html alone in the input passes, and build.lib is refused", () => {
  const dist = makeDist({ "index.html": "" });
  try {
    assert.deepEqual(
      findProblems({
        dist,
        config: { build: { rollupOptions: { input: "index.html" } } },
      }),
      [],
    );
    const problems = findProblems({
      dist,
      config: { build: { lib: { entry: "src/x.ts" } } },
    });
    assert.ok(problems.some((p) => p.includes("build.lib")));
  } finally {
    rmSync(dist, { recursive: true });
  }
});

test("a missing dist is a problem, not a pass", () => {
  const problems = findProblems({
    dist: join(tmpdir(), "no-such-dist-folder-xyz"),
    config: cleanConfig,
  });
  assert.ok(problems.length > 0);
});
