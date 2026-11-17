// Bundle size check (TOKI-007, R7): the gzip size of the JavaScript that
// apps/web loads on first page load, compared with the limit in limit.json.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const webDir = join(root, "apps/web");

// Every script and every modulepreload link of index.html.
function entriesOf(html) {
  const found = [];
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const isScript = /^<script/i.test(tag);
    const isPreload = /\brel\s*=\s*["']?modulepreload\b/i.test(tag);
    if (!isScript && !isPreload) continue;
    const ref = tag.match(/\b(?:src|href)\s*=\s*["']([^"']+)["']/i);
    if (ref) found.push(ref[1]);
  }
  return found;
}

// Static imports and re-exports only; import("...") has a parenthesis and never matches.
function staticImportsOf(code) {
  const found = [];
  const pattern =
    /\b(?:import|export)\b\s*(?:[^"'()]*?\bfrom\s*)?["']([^"']+)["']/g;
  for (const m of code.matchAll(pattern)) found.push(m[1]);
  return found;
}

function isLocal(ref) {
  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref);
}

export function measure(distDir) {
  const html = readFileSync(join(distDir, "index.html"), "utf8");
  const seen = new Set();
  const queue = [];
  for (const ref of entriesOf(html)) {
    if (isLocal(ref)) queue.push(join(distDir, ref.split(/[?#]/)[0]));
  }
  let total = 0;
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const code = readFileSync(file);
    total += gzipSync(code, { level: 9 }).length;
    for (const ref of staticImportsOf(code.toString("utf8"))) {
      if (!isLocal(ref)) continue;
      const clean = ref.split(/[?#]/)[0];
      if (!/^(?:\.\.?\/|\/)/.test(clean)) continue; // a bare package name is not a file here
      queue.push(
        clean.startsWith("/")
          ? join(distDir, clean)
          : resolve(dirname(file), clean),
      );
    }
  }
  return total;
}

export function verdict(size, limit) {
  const diff = size - limit;
  const text = `size ${size} bytes, limit ${limit} bytes, difference ${diff >= 0 ? "+" : ""}${diff} bytes`;
  return size >= limit
    ? { ok: false, message: `FAIL: bundle size at or over the limit: ${text}` }
    : { ok: true, message: `OK: ${text}` };
}

function main() {
  const pkg = JSON.parse(readFileSync(join(webDir, "package.json"), "utf8"));
  if (!pkg.scripts?.build) {
    console.log(
      "bundle size: apps/web has no build script yet, no bundle to measure.",
    );
    return 0;
  }
  const build = spawnSync("pnpm", ["--filter", "@toki/web", "run", "build"], {
    cwd: root,
    stdio: "inherit",
  });
  if (build.status !== 0) return build.status ?? 1;
  const dist = join(webDir, "dist");
  if (!existsSync(join(dist, "index.html"))) {
    console.error(
      "bundle size: apps/web/dist/index.html is missing after the build.",
    );
    return 1;
  }
  const { bytes } = JSON.parse(readFileSync(join(here, "limit.json"), "utf8"));
  const result = verdict(measure(dist), bytes);
  (result.ok ? console.log : console.error)(result.message);
  return result.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exit(main());
}
