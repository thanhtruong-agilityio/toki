import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { measure, verdict } from "./check.mjs";

const gz = (text) => gzipSync(text, { level: 9 }).length;

function makeDist(files, indexHtml) {
  const dir = mkdtempSync(join(tmpdir(), "size-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), indexHtml);
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(dir, "assets", name), text);
  }
  return dir;
}

const html = `<html><head>
<script type="module" src="/assets/main.js"></script>
<link rel="modulepreload" href="/assets/vendor.js">
<link rel="stylesheet" href="/assets/main.css">
</head></html>`;

test("counts scripts and modulepreload links, not stylesheets", () => {
  const main = "console.log('main'.repeat(50));";
  const vendor = "export const v = 'vendor'.repeat(50);";
  const dir = makeDist(
    { "main.js": main, "vendor.js": vendor, "main.css": "a{}" },
    html,
  );
  assert.equal(measure(dir), gz(main) + gz(vendor));
});

test("counts a chunk imported statically, once", () => {
  const main = 'import{a}from"./shared.js";import"./shared.js";export{a};';
  const shared = "export const a = 'shared'.repeat(50);";
  const dir = makeDist(
    { "main.js": main, "vendor.js": "", "shared.js": shared },
    html,
  );
  assert.equal(measure(dir), gz(main) + gz("") + gz(shared));
});

test("does not count a chunk reached only by a dynamic import()", () => {
  const main = 'const m = () => import("./lazy.js");export{m};';
  const dir = makeDist(
    { "main.js": main, "vendor.js": "", "lazy.js": "x".repeat(5000) },
    html,
  );
  assert.equal(measure(dir), gz(main) + gz(""));
});

test("verdict fails below, at and passes above the limit", () => {
  assert.equal(verdict(200001, 200000).ok, false);
  assert.equal(verdict(200000, 200000).ok, false);
  assert.equal(verdict(199999, 200000).ok, true);
});

test("verdict message prints size, limit and difference", () => {
  const v = verdict(200500, 200000);
  assert.match(v.message, /200500/);
  assert.match(v.message, /200000/);
  assert.match(v.message, /500/);
});
