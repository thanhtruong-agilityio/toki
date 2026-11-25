#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-010.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile`; connections to 127.0.0.1 only (the built app on `vite preview`, the
# Chromium that Playwright has cached). It writes nothing to GitHub and opens no pull request.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-010.checks.sh [T1 T2 ...]
#   V=<commit> bash docs/qa/TOKI-010.checks.sh SAMPLE <dist-folder>   writes the sample page of the
#   by-eye rows T13D and T13E (the QA's recipe is in the Steps of those rows).
# It reads files of the commit V with `git show`. Rows that run code use ONE temporary worktree of V,
# its own `pnpm install --frozen-lockfile`, the production build of the web app, `vite preview` on a free
# loopback port and the cached Chromium; all of them are removed when the script ends, even when a row
# fails, and so are the processes it started. Rows that change a file of the worktree restore it with
# `git checkout` and are paired with an unchanged run or a control. The repository itself is not changed.
# The worktrees are judged by the absence of any entry under the temporary folder (other worktrees of the
# repository may come and go while the script runs). No `.env` file is read or created. Every temporary file lives under one folder made in the current
# shell (BASE, exported as TMPDIR and given to every process it starts), which the cleanup removes.
# It prints one line for each row: counts, exit codes and words; no tool output, no secret. A line that
# starts with two spaces is a detail of the row above it (where the delivered files are).
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }

BASE=$(mktemp -d); export TMPDIR="$BASE"
mkdir -p "$BASE/f" "$BASE/ff" "$BASE/t"
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; PIDS=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; }
cleanup() {
  local p
  for p in $PIDS; do kill_tree "$p"; done
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  rm -rf "$BASE"
  git worktree prune >/dev/null 2>&1
}
trap cleanup EXIT

N22=""; NEED22=0
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  N22=$(ls -d "$HOME"/.nvm/versions/node/v22*/bin 2>/dev/null | tail -1)
  [ -n "$N22" ] || NEED22=1
fi
NODEPATH="${N22:+$N22:}$PATH"
nodebin() { PATH="$NODEPATH" node "$@"; }
# pnenv <VAR=value ...> -- <pnpm args>: runs pnpm in the worktree with only those variables
pnenv() { local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift; ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" ${envs[@]+"${envs[@]}"} corepack pnpm "$@" ); }
freeport() { python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])'; }
portbusy() { python3 -c 'import socket,sys;s=socket.socket();s.settimeout(1);print("busy" if s.connect_ex(("127.0.0.1",int(sys.argv[1])))==0 else "free")' "$1"; }

# ---- the temporary worktree, its install, the build ----------------------------
WT_RC=""; INSTALL_RC=""; BUILD_DONE=""; BUILD_RC=""
ensure_wt() {
  [ "$NEED22" = 1 ] && return 1
  [ -n "$WT_RC" ] && return "$WT_RC"
  mkdir -p "$BASE/wt0"
  if git worktree add --detach "$BASE/wt0/wt" "$V" >/dev/null 2>&1; then WT="$BASE/wt0/wt"; WT_RC=0; else WT_RC=1; fi
  return "$WT_RC"
}
ensure() {
  ensure_wt || return 1
  if [ -z "$INSTALL_RC" ]; then pnenv -- install --frozen-lockfile >/dev/null 2>&1; INSTALL_RC=$?; fi
  [ "$INSTALL_RC" = 0 ]
}
need() { ensure && return 0; echo "$1 needs Node 22 and an installed worktree of $V (Blocked)"; return 1; }
need_wt() { ensure_wt && return 0; echo "$1 needs Node 22 and a worktree of $V (Blocked)"; return 1; }
build_once() {
  [ -n "$BUILD_DONE" ] && return 0
  pnenv -- --filter ./apps/web build > "$BASE/build.log" 2>&1; BUILD_RC=$?
  BUILD_DONE=1
}
need_build() { need "$1" || return 1; build_once; [ -f "$WT/apps/web/dist/index.html" ] && return 0; echo "$1 has no built app: the build exited $BUILD_RC (Blocked)"; return 1; }
reset_wt() { ( cd "$WT" && git checkout -q -- . ); }

# ---- the data of the spec (Tables A, B, C and the sample line) and the measuring tools ----------
SPEC_DIR="apps/web/src/fonts"
NAMES="be-vietnam-pro-400.woff2 be-vietnam-pro-500.woff2 be-vietnam-pro-600.woff2 be-vietnam-pro-700.woff2 bricolage-grotesque-600.woff2 bricolage-grotesque-700.woff2 jetbrains-mono-500.woff2"
FONTRE='\.(woff2?|ttf|otf|eot)$'
LINE='Tiếng Việt: à ả ã á ạ ă ằ ẳ ẵ ắ ặ â ầ ẩ ẫ ấ ậ đ è ẻ ẽ é ẹ ê ề ể ễ ế ệ ì ỉ ĩ í ị ò ỏ õ ó ọ ô ồ ổ ỗ ố ộ ơ ờ ở ỡ ớ ợ ù ủ ũ ú ụ ư ừ ử ữ ứ ự ỳ ỷ ỹ ý ỵ ĐƯỜNG NGUYỄN HUỆ'
mkdir -p "$BASE/tools"
cat > "$BASE/tools/m.mjs" <<'JS'
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";

const FACES = [
  ["Be Vietnam Pro", 400, "be-vietnam-pro-400.woff2"],
  ["Be Vietnam Pro", 500, "be-vietnam-pro-500.woff2"],
  ["Be Vietnam Pro", 600, "be-vietnam-pro-600.woff2"],
  ["Be Vietnam Pro", 700, "be-vietnam-pro-700.woff2"],
  ["Bricolage Grotesque", 600, "bricolage-grotesque-600.woff2"],
  ["Bricolage Grotesque", 700, "bricolage-grotesque-700.woff2"],
  ["JetBrains Mono", 500, "jetbrains-mono-500.woff2"],
];
const BODY = '"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const B = new Set([
  ...range(0x20, 0x7e), 0xb7,
  ...range(0xc0, 0xc3), ...range(0xc8, 0xca), 0xcc, 0xcd, ...range(0xd2, 0xd5), 0xd9, 0xda, 0xdd,
  ...range(0xe0, 0xe3), ...range(0xe8, 0xea), 0xec, 0xed, ...range(0xf2, 0xf5), 0xf9, 0xfa, 0xfd,
  0x102, 0x103, 0x110, 0x111, 0x128, 0x129, 0x168, 0x169, 0x1a0, 0x1a1, 0x1af, 0x1b0,
  ...range(0x1ea0, 0x1ef9),
  0x300, 0x301, 0x302, 0x303, 0x306, 0x309, 0x31b, 0x323,
  0x2013, 0x2026, 0x203a,
]);
const C = [[0, 0xff], [0x102, 0x103], [0x110, 0x111], [0x128, 0x129], [0x131, 0x131], [0x152, 0x153],
  [0x168, 0x169], [0x1a0, 0x1a1], [0x1af, 0x1b0], [0x2c6, 0x2dc], [0x300, 0x329], [0x1ea0, 0x1ef9],
  [0x2000, 0x206f], [0x20ab, 0x20ac], [0x2122, 0x2122], [0x2190, 0x2193], [0x2212, 0x2212],
  [0x2215, 0x2215], [0xfeff, 0xfeff], [0xfffd, 0xfffd]];
const inC = (cp, table = C) => table.some(([a, b]) => cp >= a && cp <= b);
const isSign = (cp) => [0xb7, 0x2013, 0x2026, 0x203a].includes(cp) || (cp >= 0x300 && cp <= 0x3ff);
const TABLE_D = {}; // Table D: no accepted missing Vietnamese letter for any family

const [, , cmd, ...args] = process.argv;
const out = (...a) => console.log(a.join(" "));
const read = (f) => (f && fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);

// ---- CSS and HTML
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
function blocks(css) {
  const res = []; css = strip(css); let i = 0;
  while (i < css.length) {
    const o = css.indexOf("{", i); if (o < 0) break;
    const head = css.slice(i, o).trim(); let d = 1, j = o + 1;
    while (j < css.length && d > 0) { if (css[j] === "{") d++; else if (css[j] === "}") d--; j++; }
    res.push({ head, body: css.slice(o + 1, j - 1) }); i = j;
  }
  return res;
}
function decls(body) {
  const list = []; let cur = "", p = 0, q = null;
  for (const ch of body) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === "(") p++; if (ch === ")") p--;
    if (ch === ";" && p === 0) { list.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) list.push(cur);
  return list.map((d) => { const k = d.indexOf(":"); return [d.slice(0, k).trim().toLowerCase(), d.slice(k + 1).trim()]; }).filter((x) => x[0]);
}
const get = (d, k) => d.filter((x) => x[0] === k).map((x) => x[1]);
const unq = (s) => s.replace(/^["']|["']$/g, "");
const norm = (v) => v.replace(/\s*,\s*/g, ",").replace(/'/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
const relUrl = (u) => !/^([a-z][a-z0-9+.-]*:|\/)/i.test(u);
function ruleOk(d, fam, w, file) {
  const f = get(d, "font-family"), st = get(d, "font-style"), wt = get(d, "font-weight"), dp = get(d, "font-display"), src = get(d, "src");
  if (f.length !== 1 || unq(f[0]) !== fam || st.length !== 1 || st[0] !== "normal") return false;
  if (wt.length !== 1 || wt[0] !== String(w) || dp.length !== 1 || dp[0] !== "swap" || src.length !== 1) return false;
  const m = src[0].match(/^url\(\s*(["']?)([^"')]+)\1\s*\)\s*format\(\s*(["']?)woff2\3\s*\)$/i);
  return !!m && relUrl(m[2]) && path.posix.basename(m[2]) === file;
}
const faces = (css) => blocks(css).filter((b) => b.head === "@font-face").map((b) => decls(b.body));
function tags(html, name) {
  const res = [];
  for (const m of html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))) {
    const attrs = {};
    for (const a of m[0].slice(name.length + 1).matchAll(/([a-zA-Z][\w:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? "";
    res.push(attrs);
  }
  return res;
}
const fontPreloads = (html) => tags(html, "link").filter((a) => /\bpreload\b/i.test(a.rel ?? "") && (a.as ?? "").toLowerCase() === "font");
const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])) : []);

// ---- fonts
let fk = null;
function fontkit() {
  if (!fk) fk = createRequire(path.join(process.env.FKROOT, "apps/web/package.json"))("fontkit");
  return fk;
}
function openAll(mapFile) {
  const res = [];
  for (const line of fs.readFileSync(mapFile, "utf8").split("\n").filter(Boolean)) {
    const [name, file] = line.split("\t");
    const [fam, w] = FACES.find((f) => f[2] === name).slice(0, 2);
    const font = fontkit().openSync(file);
    // the cmap of a font ends with a sentinel U+FFFF that has no glyph: a code point counts only when it has a glyph
    res.push({ name, fam, w, font, cps: font.characterSet.filter((cp) => font.glyphForCodePoint(cp).id !== 0) });
  }
  return res;
}
const isVariable = (f) => Object.keys(f.variationAxes ?? {}).length > 0 || !!f.directory?.tables?.fvar;
const isItalic = (f) => (f.italicAngle ?? 0) !== 0 || !!f["OS/2"]?.fsSelection?.italic || !!f.head?.macStyle?.italic;
const weightOf = (f) => f["OS/2"]?.usWeightClass;
const sourceEntries = (j) => (Array.isArray(j) ? j : j?.fonts ?? []);
const cps = (v) => (Array.isArray(v) ? v : []).map((x) => (typeof x === "number" ? x : parseInt(String(x).replace(/^U\+/i, ""), 16)));
const missingOf = (e) => cps(e?.cut?.missing ?? e?.missing);

switch (cmd) {
  case "css-faces": { // rules, Table A rows matched, rules with local() or unicode-range
    const css = read(args[0]); if (css === null) { out(0, 0, 0); break; }
    const fs_ = faces(css);
    out(fs_.length, FACES.filter(([fam, w, file]) => fs_.some((d) => ruleOk(d, fam, w, file))).length,
      fs_.filter((d) => d.some((x) => x[0] === "unicode-range" || /local\(/i.test(x[1]))).length);
    break;
  }
  case "css-body": { // other rules, selector body with one font-family, the list equals the spec's
    const css = read(args[0]); if (css === null) { out(0, 0, 0); break; }
    const others = blocks(css).filter((b) => b.head !== "@font-face");
    const o = others[0]; const d = o ? decls(o.body) : [];
    out(others.length, o && o.head === "body" && d.length === 1 && d[0][0] === "font-family" ? 1 : 0, o && d.length >= 1 && d[0][0] === "font-family" && norm(d[0][1]) === norm(BODY) ? 1 : 0);
    break;
  }
  case "preload": { // N preload-as-font links, type, crossorigin, href of the first
    const html = read(args[0]); if (html === null) { out(0, 0, 0, "-"); break; }
    const p = fontPreloads(html); const a = p[0] ?? {};
    out(p.length, a.type === "font/woff2" ? 1 : 0, "crossorigin" in a ? 1 : 0, a.href ?? "-");
    break;
  }
  case "src-fields": { // entries, entries with every field
    const t = read(args[0]); if (t === null) { out(0, 0); break; }
    const es = sourceEntries(JSON.parse(t));
    const ok = (e) => ["file", "family", "weight", "upstream", "version", "licence", "sha256"].every((k) => e?.[k] !== undefined && e[k] !== "") &&
      ["tool", "toolVersion", "command", "unicodes"].every((k) => typeof e?.cut?.[k] === "string" && e.cut[k] !== "") && Array.isArray(e?.cut?.missing) &&
      (!/^Bricolage/.test(e.family) || /wght|instancer|axis|axes/i.test(e.cut.command));
    out(es.length, es.filter(ok).length);
    break;
  }
  case "src-sha": { // entries, entries whose recorded SHA-256 equals the file of that name in the folder
    const t = read(args[0]); if (t === null) { out(0, 0); break; }
    const es = sourceEntries(JSON.parse(t));
    out(es.length, es.filter((e) => { const f = path.join(args[1], e.file ?? "?"); return fs.existsSync(f) && crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex") === e.sha256; }).length);
    break;
  }
  case "src-lic": { // entries, entries naming a licence file of its family that exists in the folder
    const t = read(args[0]); if (t === null) { out(0, 0, 0); break; }
    const es = sourceEntries(JSON.parse(t));
    const slug = (f) => String(f).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const named = es.filter((e) => typeof e.licenceFile === "string" && e.licenceFile.includes(slug(e.family).split("-").slice(0, 2).join("-")));
    out(es.length, named.length, named.filter((e) => fs.existsSync(path.join(args[1], e.licenceFile))).length);
    break;
  }
  case "lic-files": { // files in the folder, one per family, with the licence text
    const files = fs.existsSync(args[0]) ? fs.readdirSync(args[0]).filter((f) => fs.statSync(path.join(args[0], f)).isFile()) : [];
    const fam = ["be-vietnam-pro", "bricolage-grotesque", "jetbrains-mono"];
    out(files.length, fam.filter((f) => files.filter((x) => x.toLowerCase().includes(f)).length === 1).length,
      files.filter((f) => /SIL OPEN FONT LICENSE/i.test(fs.readFileSync(path.join(args[0], f), "utf8"))).length);
    break;
  }
  case "f-style": { // files, static, upright, weight equals the row, then the controls
    const fs_ = openAll(args[0]);
    out(fs_.length, fs_.filter((x) => !isVariable(x.font)).length, fs_.filter((x) => !isItalic(x.font)).length, fs_.filter((x) => weightOf(x.font) === x.w).length,
      isVariable({ variationAxes: { wght: {} } }) ? 1 : 0, isItalic({ italicAngle: -12 }) ? 1 : 0, weightOf({ "OS/2": { usWeightClass: 401 } }) !== 400 ? 1 : 0);
    break;
  }
  case "f-cover": { // files, code points, missing and not excused (record: args[1]), control with one extra code point
    const fs_ = openAll(args[0]); const es = sourceEntries(JSON.parse(read(args[1]) ?? "[]"));
    const miss = (extra) => {
      let n = 0;
      for (const x of fs_) {
        const have = new Set(x.cps); const rec = new Set(missingOf(es.find((e) => e.file === x.name)));
        for (const cp of [...B, ...extra]) if (!have.has(cp) && !(rec.has(cp) && (isSign(cp) || (TABLE_D[x.fam] ?? []).includes(cp)))) n++;
      }
      return n;
    };
    out(fs_.length, B.size, miss([]), miss([0x4e00]) > 0 ? 1 : 0);
    break;
  }
  case "f-record": { // entries, recorded code points that are not allowed or that the file holds, control
    const fs_ = openAll(args[0]); const es = sourceEntries(JSON.parse(read(args[1]) ?? "[]"));
    const bad = (list) => {
      let n = 0;
      for (const e of list) {
        const x = fs_.find((y) => y.name === e.file); const have = new Set(x?.cps ?? []);
        for (const cp of missingOf(e)) if (!(isSign(cp) || (TABLE_D[x?.fam] ?? []).includes(cp)) || have.has(cp)) n++;
      }
      return n;
    };
    const ctl = es.map((e, i) => (i === 0 ? { ...e, cut: { ...e.cut, missing: [...(e.cut?.missing ?? []), "U+0041"] } } : e));
    out(es.length, bad(es), bad(ctl) > 0 ? 1 : 0);
    break;
  }
  case "f-outside": { // files, code points outside Table C, control with Table C cut down
    const fs_ = openAll(args[0]);
    const n = (table) => fs_.reduce((s, x) => s + x.cps.filter((cp) => !inC(cp, table)).length, 0);
    out(fs_.length, n(C), n(C.filter(([a]) => a !== 0)) > 0 ? 1 : 0);
    break;
  }
  case "sha": { out(crypto.createHash("sha256").update(fs.readFileSync(args[0])).digest("hex")); break; }
  // ---- the built app
  case "dist-woff": { // woff2 files in dist, Table A stems with one hashed file
    const w = walk(args[0]).filter((f) => f.endsWith(".woff2")).map((f) => path.basename(f));
    const hashed = (stem, n) => new RegExp(`^${stem}-[A-Za-z0-9_-]{6,}\\.woff2$`).test(n);
    out(w.length, FACES.filter(([, , f]) => w.filter((n) => hashed(f.replace(/\.woff2$/, ""), n)).length === 1).length,
      hashed("be-vietnam-pro-400", "be-vietnam-pro-400.woff2") ? 0 : 1);
    break;
  }
  case "built-urls": { // urls of the font-face rules of the built CSS, urls that resolve to a woff2 of dist, urls with a scheme or host, control
    const dist = args[0]; const woff = new Set(walk(dist).filter((f) => f.endsWith(".woff2")));
    const urls = [];
    for (const f of walk(dist).filter((x) => x.endsWith(".css"))) {
      for (const d of faces(fs.readFileSync(f, "utf8"))) for (const s of get(d, "src")) for (const m of s.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) urls.push([f, m[1]]);
    }
    const scheme = (u) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(u);
    const res = (f, u) => (u.startsWith("/") ? path.join(dist, u.split(/[?#]/)[0]) : path.resolve(path.dirname(f), u.split(/[?#]/)[0]));
    out(urls.length, new Set(urls.filter(([f, u]) => !scheme(u) && woff.has(res(f, u))).map(([f, u]) => res(f, u))).size, urls.filter(([, u]) => scheme(u)).length, scheme("https://x.example/a.woff2") ? 1 : 0);
    break;
  }
  case "built-url": { // the url the built CSS gives for the face (family, weight)
    const dist = args[0]; const w = Number(args[2]); let found = "-";
    for (const f of walk(dist).filter((x) => x.endsWith(".css"))) {
      for (const d of faces(fs.readFileSync(f, "utf8"))) if (unq(get(d, "font-family")[0] ?? "") === args[1] && get(d, "font-weight")[0] === String(w)) {
        const m = (get(d, "src")[0] ?? "").match(/url\(\s*["']?([^"')]+)["']?\s*\)/); if (m) found = m[1];
      }
    }
    out(found);
    break;
  }
  case "scan": { // files scanned, files with the text
    const re = new RegExp(args[1]); const files = walk(args[0]);
    out(files.length, files.filter((f) => re.test(fs.readFileSync(f).toString("latin1"))).length);
    break;
  }
  case "noprocess": { // 1 when the file does not use the global process (it imports it from node:process, or does not use it)
    const t = read(args[0]); if (t === null) { out(0, 0); break; }
    const ok = (s) => !/(^|[^.\w])process\b/.test(s.replace(/^\s*import\b[^;]*;/gm, "").replace(/\/\/.*$/gm, "")) || /import\s+process\s+from\s+["']node:process["']/.test(s);
    out(ok(t) ? 1 : 0, ok(t.replace(/^\s*import\s+process\s+from\s+["']node:process["'];?\s*$/m, "")) ? 0 : 1);
    break;
  }
  default: out("unknown");
}
JS
cat > "$BASE/tools/browser.mjs" <<'JS'
// Drives the cached Chromium against the built app (BASE_URL) and the sample pages; prints one JSON line.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { FKROOT, BASE_URL, DISTDIR, PREHREF } = process.env;
const LINE = fs.readFileSync(process.env.LINEFILE, "utf8").replace(/\n$/, "");
const { chromium } = createRequire(path.join(FKROOT, "package.json"))("@playwright/test");
const res = {};
const browser = await chromium.launch();
try {
  const origin = new URL(BASE_URL).origin;
  const ctx = await browser.newContext();
  async function visit(url, settle) {
    const page = await ctx.newPage(); const reqs = []; const resp = [];
    page.on("request", (r) => reqs.push({ url: r.url(), type: r.resourceType() }));
    page.on("response", (r) => resp.push({ url: r.url(), status: r.status() }));
    await page.goto(url, { waitUntil: "load" });
    if (settle) await settle(page);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    return { page, reqs, resp };
  }
  async function fontsOf(page, selector) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) return null;
    const r = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    return r.fonts.map((f) => ({ family: f.familyName, custom: !!f.isCustomFont, glyphs: f.glyphCount }));
  }
  // 1. the built app at an unknown path
  const a = await visit(`${BASE_URL}/no-such-page`, async (p) => { await p.waitForSelector("text=Page not found", { timeout: 5000 }).catch(() => {}); });
  const marked = await a.page.evaluate(() => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) if (n.nodeValue.includes("Page not found")) { n.parentElement.setAttribute("data-qa-nf", "1"); return true; }
    return false;
  });
  res.notFoundShown = marked;
  res.notFoundFonts = marked ? await fontsOf(a.page, "[data-qa-nf]") : null;
  res.finalPath = new URL(a.page.url()).pathname;
  res.bodyChars = await a.page.evaluate(() => document.body.innerText.length);
  res.sessionStatus = a.resp.find((r) => r.url.includes("/api/v1/auth/session"))?.status ?? 0;
  const fontReqs = a.reqs.filter((r) => r.type === "font").map((r) => r.url);
  const pre = new URL(PREHREF, origin).href;
  res.fontFiles = new Set(fontReqs).size;
  res.preloadedRequested = fontReqs.filter((u) => u === pre).length;
  res.fontRequestsTotal = fontReqs.length;
  res.otherHost = a.reqs.filter((r) => !r.url.startsWith("data:") && !r.url.startsWith("blob:") && new URL(r.url).origin !== origin).length;
  // 2. the sample page: the sample line in each family, and a control line
  const s = await visit(`${BASE_URL}/sample.html`);
  const chars = [...new Set(Array.from(LINE).filter((ch) => ch.trim() !== ""))];
  res.chars = chars.length;
  res.sample = {}; res.perChar = {};
  const own = { l1: "Be Vietnam Pro", l2: "Bricolage Grotesque", l3: "JetBrains Mono", c1: "No Such Family" };
  const styles = { l1: "400 24px 'Be Vietnam Pro'", l2: "700 24px 'Bricolage Grotesque'", l3: "500 24px 'JetBrains Mono'", c1: "400 24px 'No Such Family',monospace" };
  for (const id of ["l1", "l2", "l3", "c1"]) {
    res.sample[id] = await fontsOf(s.page, `#${id}`);
    // each distinct character of the line alone: drawn by the family's own file and by no other font
    await s.page.evaluate(([st]) => { const d = document.createElement("div"); d.id = "one"; d.style.font = st; document.body.appendChild(d); }, [styles[id]]);
    let ok = 0;
    for (const ch of chars) {
      await s.page.evaluate((c) => new Promise((r) => { document.getElementById("one").textContent = c; requestAnimationFrame(() => requestAnimationFrame(() => r())); }), ch);
      const f = await fontsOf(s.page, "#one");
      if (f && f.length === 1 && f[0].family.startsWith(own[id]) && f[0].custom) ok++;;
    }
    res.perChar[id] = ok;
    await s.page.evaluate(() => document.getElementById("one").remove());
  }
  res.sampleFontFiles = new Set(s.reqs.filter((r) => r.type === "font").map((r) => r.url)).size;
  // 3. the control page: one font request to another host
  const c = await visit(`${BASE_URL}/ctl.html`);
  res.ctlOtherHost = c.reqs.filter((r) => !r.url.startsWith("data:") && new URL(r.url).origin !== origin).length;
} catch (e) {
  res.error = String(e.message ?? e).split("\n")[0].slice(0, 160);
}
await browser.close().catch(() => {});
console.log(JSON.stringify(res));
JS

fetch() { git show "$V:$1" > "$2" 2>/dev/null || { rm -f "$2"; return 1; }; }
mnode() { PATH="$NODEPATH" node "$BASE/tools/m.mjs" "$@"; }
# the folder where the delivered fonts.css lives (it may not be the folder of the spec)
DELDIR=$(git ls-tree -r --name-only "$V" -- apps/web 2>/dev/null | grep -E '/fonts\.css$' | head -1 | xargs -n1 dirname 2>/dev/null)
tracked_fonts() { git ls-tree -r --name-only "$V" -- apps/web | grep -Eiv '^apps/web/(node_modules|dist)/' | grep -Ei "$FONTRE"; }
loc() { # a detail line telling where the delivered file of a spec path is
  local want="$1" have="$2" shown="$3"
  if [ -z "$shown" ]; then echo "  $want is absent at $V and no file of that name is tracked under apps/web"; else echo "  $want is absent at $V; the delivered file is $have; same measure there: $shown"; fi
}
col() { local n="$1"; shift; printf '%s' "$*" | awk -v n="$n" '{print $n}'; }

# ---- R1 ---------------------------------------------------------------------------
t1() {
  local n=0 w=0 nm=0 f magic all
  all=$(tracked_fonts | grep -E "^$SPEC_DIR/[^/]+$")
  for f in $all; do
    n=$((n + 1))
    magic=$(git show "$V:$f" 2>/dev/null | head -c4 | tr -d '\0'); [ "$magic" = wOF2 ] && w=$((w + 1))
  done
  for f in $NAMES; do printf '%s\n' "$all" | grep -qx "$SPEC_DIR/$f" && nm=$((nm + 1)); done
  echo "T1 $n $w $nm"
  echo "  font files tracked under apps/web: $(tracked_fonts | wc -l | tr -d ' '), in folders: $(tracked_fonts | xargs -n1 dirname | sort -u | tr '\n' ' ' | sed 's/ $//')"
}
t1b() {
  local o=0 f f2 ok
  for f in $(tracked_fonts); do
    ok=0; for f2 in $NAMES; do [ "$f" = "$SPEC_DIR/$f2" ] && ok=1; done
    [ "$ok" = 0 ] && o=$((o + 1))
  done
  echo "T1B $o"
}
# ---- R2 ---------------------------------------------------------------------------
CSSF="$BASE/f/fonts.css"; CSSD="$BASE/f/fonts.delivered.css"
css_files() { fetch "$SPEC_DIR/fonts.css" "$CSSF"; [ -n "$DELDIR" ] && fetch "$DELDIR/fonts.css" "$CSSD"; return 0; }
css_ctl() { # <perl expression> <command> <field>: 1 when the same measure on a mutated copy differs from the measure of the unchanged file
  local base="$CSSF"; [ -f "$base" ] || base="$CSSD"
  [ -f "$base" ] || { echo 0; return; }
  cp "$base" "$BASE/f/mut.css"; perl -0pi -e "$1" "$BASE/f/mut.css"
  cmp -s "$base" "$BASE/f/mut.css" && { echo 0; return; }
  [ "$(col "$3" "$(mnode "$2" "$BASE/f/mut.css")")" != "$(col "$3" "$(mnode "$2" "$base")")" ] && echo 1 || echo 0
}
css_row() { # <id> <command> <field> <perl> [extra field]
  css_files; local m d
  m=$(mnode "$2" "$CSSF"); [ -f "$CSSF" ] || { [ -f "$CSSD" ] && d=$(mnode "$2" "$CSSD"); }
  echo "$1 $(col "$3" "$m") $([ -n "${5:-}" ] && echo "$(col "$5" "$m") ")$(css_ctl "$4" "$2" "${5:-$3}")"
  [ -f "$CSSF" ] || loc "$SPEC_DIR/fonts.css" "$DELDIR/fonts.css" "$(col "$3" "${d:-}")${5:+ $(col "$5" "${d:-}")}"
}
t2() { css_row T2 css-faces 1 's/\@font-face\s*\{[^}]*\}\s*//'; }
t2b() { css_row T2B css-faces 2 's/font-weight: 400;/font-weight: 401;/'; }
t2c() { css_row T2C css-faces 1 's/(font-display: swap;)/$1\n  unicode-range: U+0000-00FF;/' 3; }
# ---- the seven files wherever they are tracked (R3 to R6) ------------------------------
MAPF="$BASE/map.tsv"; MAP_DONE=""; MAP_N=0; SRCJ="$BASE/f/sources.any.json"
make_map() {
  [ -n "$MAP_DONE" ] && return 0
  : > "$MAPF"; local f p
  for f in $NAMES; do
    p=$(tracked_fonts | grep -E "/$f\$" | head -1)
    [ -n "$p" ] && fetch "$p" "$BASE/ff/$f" && printf '%s\t%s\n' "$f" "$BASE/ff/$f" >> "$MAPF"
  done
  MAP_N=$(grep -c . "$MAPF")
  local s; s=$(git ls-tree -r --name-only "$V" -- apps/web | grep -E '/sources\.json$' | head -1); [ -n "$s" ] && fetch "$s" "$SRCJ"
  MAP_DONE=1
}
fk_env() { FKROOT="$WT" mnode "$@"; }
t3() { need T3 || return; make_map; local m; m=$(FKROOT="$WT" mnode f-style "$MAPF"); echo "T3 $(col 1 "$m") $(col 2 "$m") $(col 5 "$m")"; }
t3b() { need T3B || return; make_map; local m; m=$(FKROOT="$WT" mnode f-style "$MAPF"); echo "T3B $(col 1 "$m") $(col 3 "$m") $(col 6 "$m")"; }
t3c() { need T3C || return; make_map; local m; m=$(FKROOT="$WT" mnode f-style "$MAPF"); echo "T3C $(col 1 "$m") $(col 4 "$m") $(col 7 "$m")"; }
t4() { need T4 || return; make_map; local m; m=$(FKROOT="$WT" mnode f-cover "$MAPF" "$SRCJ"); echo "T4 $(col 1 "$m") $(col 2 "$m") $(col 3 "$m") $(col 4 "$m")"; }
t4b() { need T4B || return; make_map; local m; m=$(FKROOT="$WT" mnode f-record "$MAPF" "$SRCJ"); echo "T4B $(col 1 "$m") $(col 2 "$m") $(col 3 "$m")"; }
t5() { need T5 || return; make_map; local m; m=$(FKROOT="$WT" mnode f-outside "$MAPF"); echo "T5 $(col 1 "$m") $(col 2 "$m") $(col 3 "$m")"; }
sizes() { make_map; local f s over=0 tot=0 n=0; for f in $NAMES; do s=$(wc -c < "$BASE/ff/$f" 2>/dev/null | tr -d ' '); [ -n "$s" ] || continue; n=$((n + 1)); tot=$((tot + s)); [ "$s" -gt 51200 ] && over=$((over + 1)); done; echo "$n $over $tot"; }
t6() { local m; m=$(sizes); echo "T6 $(col 1 "$m") $(col 2 "$m") $([ 51201 -gt 51200 ] && echo 1 || echo 0)"; }
t6b() { local m; m=$(sizes); echo "T6B $(col 1 "$m") $([ "$(col 3 "$m")" -le 307200 ] && echo 1 || echo 0) $([ 307201 -gt 307200 ] && echo 1 || echo 0)"; echo "  the seven files together: $(col 3 "$m") bytes (limit 307200); the largest file is within 51200: $(( $(col 2 "$m") == 0 ))"; }
# ---- R7 ---------------------------------------------------------------------------
t7() {
  css_files; local m d
  m=$(mnode css-body "$CSSF"); [ -f "$CSSF" ] || { [ -f "$CSSD" ] && d=$(mnode css-body "$CSSD"); }
  echo "T7 $(col 1 "$m") $(col 2 "$m") $(col 3 "$m") $(css_ctl 's/system-ui/ui-sans-serif/' css-body 3)"
  [ -f "$CSSF" ] || loc "$SPEC_DIR/fonts.css" "$DELDIR/fonts.css" "$(printf '%s %s %s' "$(col 1 "${d:-}")" "$(col 2 "${d:-}")" "$(col 3 "${d:-}")")"
}
t7b() {
  local imp=0 others=0 f body tgt
  fetch apps/web/src/main.tsx "$BASE/f/main.tsx"
  body=$(grep -E '^\s*import\s+["'"'"'][^"'"'"']*fonts\.css["'"'"']' "$BASE/f/main.tsx")
  for f in $(git ls-tree -r --name-only "$V" -- apps/web/src | grep -E '\.(tsx?|css|jsx?)$'); do
    [ "$f" = apps/web/src/main.tsx ] && continue
    git show "$V:$f" | grep -qE 'fonts\.css' && others=$((others + 1))
  done
  # the import resolves to the spec's file
  tgt=$(printf '%s' "$body" | sed -E 's/.*["'"'"']([^"'"'"']*fonts\.css)["'"'"'].*/\1/' | head -1)
  [ -n "$tgt" ] && [ "$(PATH="$NODEPATH" node -e 'console.log(require("path").posix.normalize("apps/web/src/"+process.argv[1]))' "$tgt")" = "$SPEC_DIR/fonts.css" ] && imp=1
  echo "T7B $imp $others $([ -n "$body" ] && echo 1 || echo 0)"
  echo "  main.tsx imports: ${tgt:-nothing named fonts.css}"
}
# ---- R8 ---------------------------------------------------------------------------
HTMLF="$BASE/f/index.html"
t8() { fetch apps/web/index.html "$HTMLF"; local m p; m=$(mnode preload "$HTMLF")
  cp "$HTMLF" "$HTMLF.m"; perl -0pi -e 's#(<title>)#<link rel="preload" as="font" type="font/woff2" crossorigin href="/x.woff2" />$1#' "$HTMLF.m"
  p=$(mnode preload "$HTMLF.m"); echo "T8 $(col 1 "$m") $([ "$(col 1 "$p")" != "$(col 1 "$m")" ] && echo 1 || echo 0)"; }
t8b() { fetch apps/web/index.html "$HTMLF"; local m h hit=0 p; m=$(mnode preload "$HTMLF"); h=$(col 4 "$m")
  [ "$(basename "$h")" = be-vietnam-pro-400.woff2 ] && git cat-file -e "$V:apps/web/${h#/}" 2>/dev/null && hit=1
  cp "$HTMLF" "$HTMLF.m"; perl -0pi -e 's#be-vietnam-pro-400\.woff2#be-vietnam-pro-500.woff2#' "$HTMLF.m"; p=$(mnode preload "$HTMLF.m"); h=$(col 4 "$p")
  echo "T8B $hit $([ "$(basename "$h")" = be-vietnam-pro-400.woff2 ] && echo 0 || echo 1)"; }
t8c() { fetch apps/web/index.html "$HTMLF"; local m p; m=$(mnode preload "$HTMLF")
  cp "$HTMLF" "$HTMLF.m"; perl -0pi -e 's#\s+crossorigin##; s#type="font/woff2"#type="font/ttf"#' "$HTMLF.m"; p=$(mnode preload "$HTMLF.m")
  echo "T8C $(col 2 "$m") $(col 3 "$m") $([ "$(col 2 "$p")$(col 3 "$p")" = 00 ] && echo 1 || echo 0)"; }
# ---- the built app (R9 to R11, R17) -------------------------------------------------
DIST() { echo "$WT/apps/web/dist"; }
t9() {
  need_build T9 || return; local m base=0; m=$(mnode dist-woff "$(DIST)")
  git show "$V:apps/web/vite.config.ts" | grep -qE '^\s*base\s*:' || base=1
  echo "T9 $(col 1 "$m") $(col 2 "$m") $base $(col 3 "$m")"
}
t9b() { need_build T9B || return; local m; m=$(mnode built-urls "$(DIST)"); echo "T9B $(col 1 "$m") $(col 2 "$m") $(col 3 "$m") $(col 4 "$m")"; }
t9c() {
  need_build T9C || return; local m c; m=$(mnode scan "$(DIST)" 'data:font')
  mkdir -p "$BASE/t/c1"; printf '@font-face{src:url(data:font/woff2;base64,AAAA)}' > "$BASE/t/c1/x.css"; c=$(mnode scan "$BASE/t/c1" 'data:font')
  echo "T9C $(col 1 "$m") $(col 2 "$m") $(col 2 "$c")"
}
preload_url() { local h; h=$(mnode preload "$(DIST)/index.html"); col 4 "$h"; }
t10() { need_build T10 || return; local h u; h=$(preload_url); u=$(mnode built-url "$(DIST)" "Be Vietnam Pro" 400)
  echo "T10 $([ "$h" = "$u" ] && [ "$h" != "-" ] && echo 1 || echo 0) $([ "$h" != "$(mnode built-url "$(DIST)" "Be Vietnam Pro" 500)" ] && echo 1 || echo 0)"; }
t10b() { need_build T10B || return; local h; h=$(preload_url); echo "T10B $([ "$h" != "-" ] && [ -f "$(DIST)${h}" ] && echo 1 || echo 0) $([ ! -f "$(DIST)${h}.nope" ] && echo 1 || echo 0)"; }
t11() {
  need_wt T11 || return
  local n h hm
  n=$(git ls-tree -r --name-only "$V" -- apps/web/index.html apps/web/src | wc -l | tr -d ' ')
  h=$(git grep -lE 'fonts\.(googleapis|gstatic)\.com' "$V" -- apps/web/index.html apps/web/src 2>/dev/null | wc -l | tr -d ' ')
  printf '\n<!-- fonts.gstatic.com -->\n' >> "$WT/apps/web/index.html"
  hm=$(grep -lE 'fonts\.(googleapis|gstatic)\.com' "$WT/apps/web/index.html" "$WT"/apps/web/src/main.tsx 2>/dev/null | wc -l | tr -d ' ')
  reset_wt
  echo "T11 $n $h $hm"
}
t11b() {
  need_build T11B || return
  local m c b
  m=$(mnode scan "$(DIST)" 'fonts\.(googleapis|gstatic)\.com')
  cp "$(DIST)/index.html" "$BASE/f/dist.index.bak"; printf '\n<!-- fonts.googleapis.com -->\n' >> "$(DIST)/index.html"
  c=$(mnode scan "$(DIST)" 'fonts\.(googleapis|gstatic)\.com'); cp "$BASE/f/dist.index.bak" "$(DIST)/index.html"
  b=$(mnode scan "$(DIST)" 'fonts\.(googleapis|gstatic)\.com')
  echo "T11B $(col 1 "$m") $(col 2 "$m") $(col 2 "$c") $(col 2 "$b")"
}
# ---- the browser rows (R12, R13) ----------------------------------------------------
BR_DONE=""; BR_ERR=""; BRJ="$BASE/browser.json"; PORT=""
write_sample() { # <dist folder>: the sample page and the control page
  local css; css=$(ls "$1"/assets/*.css 2>/dev/null | head -1)
  [ -n "$css" ] || return 1
  css="/assets/$(basename "$css")"
  {
    printf '<!doctype html><meta charset="utf-8"><title>sample</title><link rel="stylesheet" href="%s">\n' "$css"
    printf '<div id="l1" style="font:400 24px/1.4 %s">%s</div>\n' "'Be Vietnam Pro'" "$LINE"
    printf '<div id="l2" style="font:700 24px/1.4 %s">%s</div>\n' "'Bricolage Grotesque'" "$LINE"
    printf '<div id="l3" style="font:500 24px/1.4 %s">%s</div>\n' "'JetBrains Mono'" "$LINE"
    printf '<div id="c1" style="font:400 24px/1.4 %s">%s</div>\n' "'No Such Family',monospace" "$LINE"
  } > "$1/sample.html"
  printf '<!doctype html><meta charset="utf-8"><title>ctl</title><link rel="preload" as="font" type="font/woff2" crossorigin href="http://localhost:%s/none.woff2">\n<p>control</p>\n' "${2:-1}" > "$1/ctl.html"
}
browser_once() {
  [ -n "$BR_DONE" ] && return 0
  BR_DONE=1
  PORT=$(freeport)
  write_sample "$(DIST)" "$(freeport)" || { BR_ERR="the built CSS was not found"; return 1; }
  ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm --filter ./apps/web exec vite preview --host 127.0.0.1 --port "$PORT" --strictPort > "$BASE/preview.log" 2>&1 ) &
  PIDS="$PIDS $!"; disown
  local i; for i in $(seq 1 60); do [ "$(portbusy "$PORT")" = busy ] && break; sleep 0.5; done
  [ "$(portbusy "$PORT")" = busy ] || { BR_ERR="vite preview did not listen"; return 1; }
  printf '%s' "$LINE" > "$BASE/line.txt"
  ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" FKROOT="$WT" BASE_URL="http://127.0.0.1:$PORT" DISTDIR="$(DIST)" PREHREF="$(preload_url)" LINEFILE="$BASE/line.txt" node "$BASE/tools/browser.mjs" > "$BRJ" 2> "$BASE/browser.err" )
  [ -s "$BRJ" ] || { BR_ERR="$(head -1 "$BASE/browser.err" | cut -c1-160)"; return 1; }
  local e; e=$(jq -r '.error // empty' "$BRJ"); [ -z "$e" ] || { BR_ERR="$e"; return 1; }
  return 0
}
need_browser() { need_build "$1" || return 1; browser_once && return 0; echo "$1 could not run Chromium on the built app: ${BR_ERR:-unknown} (Blocked)"; return 1; }
jqr() { jq -r "$1" "$BRJ"; }
t12() {
  need_browser T12 || return
  echo "T12 $(jqr '[.notFoundShown // false] | map(if . then 1 else 0 end) | .[0]') $(jqr '[(.notFoundFonts // []) | length][0]') $(jqr '(.notFoundFonts // []) | map(select((.family | startswith("Be Vietnam Pro")) and .custom)) | length') $(jqr '(.sample.c1 // []) | map(select(.family | startswith("Be Vietnam Pro"))) | length | if . == 0 then 1 else 0 end')"
  echo "  the address after the load: $(jqr '.finalPath'); characters of text on the page: $(jqr '.bodyChars'); answer of /api/v1/auth/session: $(jqr '.sessionStatus')"
}
t12b() { need_browser T12B || return; echo "T12B $(jqr '.fontFiles') $(jqr '.preloadedRequested') $(jqr '.fontRequestsTotal') $(jqr '.sampleFontFiles')"; }
t12c() { need_browser T12C || return; echo "T12C $(jqr '.otherHost') $(jqr '.ctlOtherHost')"; }
fam_row() { # <id> <sample id> <family>
  need_browser "$1" || return
  echo "$1 $(jqr '.chars') $(jqr ".perChar.$2") $(jqr ".sample.$2 | length") $(jqr ".sample.$2 | map(select((.family | startswith(\"$3\")) and .custom)) | length") $(jqr '.perChar.c1 | if . == 0 then 1 else 0 end')"
}
t13() { fam_row T13 l1 "Be Vietnam Pro"; }
t13b() { fam_row T13B l2 "Bricolage Grotesque"; }
t13c() { fam_row T13C l3 "JetBrains Mono"; }
t13d() { echo "T13D Blocked: manual row, the QA draws the sample page in Safari and pastes the result (Steps in the record)"; }
t13e() { echo "T13E Blocked: manual row, the QA compares the Bricolage Grotesque title with the prototype by eye and pastes the result (Steps in the record)"; }
# ---- R14, R15 ---------------------------------------------------------------------
SRCS="$BASE/f/sources.json"; SRCD="$BASE/f/sources.delivered.json"
src_files() { fetch "$SPEC_DIR/sources.json" "$SRCS"; [ -n "$DELDIR" ] && fetch "$DELDIR/sources.json" "$SRCD"; return 0; }
src_mut() { # <perl expression> <file>: a mutated copy named mut.json
  cp "$2" "$BASE/f/mut.json"; perl -0pi -e "$1" "$BASE/f/mut.json"; cmp -s "$2" "$BASE/f/mut.json" && return 1; return 0
}
t14() {
  src_files; local m d p base="$SRCS"; m=$(mnode src-fields "$SRCS"); [ -f "$SRCS" ] || { [ -f "$SRCD" ] && d=$(mnode src-fields "$SRCD"); }
  [ -f "$base" ] || base="$SRCD"; p=0
  [ -f "$base" ] && src_mut 's/"sha256": "[0-9a-f]+",//' "$base" && [ "$(col 2 "$(mnode src-fields "$BASE/f/mut.json")")" != "$(col 2 "$(mnode src-fields "$base")")" ] && p=1
  echo "T14 $(col 1 "$m") $(col 2 "$m") $p"
  [ -f "$SRCS" ] || loc "$SPEC_DIR/sources.json" "$DELDIR/sources.json" "$(printf '%s %s' "$(col 1 "${d:-}")" "$(col 2 "${d:-}")")"
}
fonts_dir() { # <dir in V> <dest>: every file of the folder that has a font extension
  mkdir -p "$2"; local f; for f in $(git ls-tree --name-only "$V" -- "$1/" 2>/dev/null | grep -Ei "$FONTRE"); do fetch "$f" "$2/$(basename "$f")"; done
}
t14b() {
  src_files; fonts_dir "$SPEC_DIR" "$BASE/f/specfonts"
  local m d p=0 base="$SRCS"; m=$(mnode src-sha "$SRCS" "$BASE/f/specfonts")
  if [ ! -f "$SRCS" ] && [ -f "$SRCD" ]; then fonts_dir "$DELDIR" "$BASE/f/delfonts"; d=$(mnode src-sha "$SRCD" "$BASE/f/delfonts"); fi
  if [ -f "$base" ]; then :; else base="$SRCD"; fi
  if [ -f "$base" ] && src_mut 's/("sha256": ")(.)/$1.($2 eq "0" ? "1" : "0")/e' "$base"; then
    local fd="$BASE/f/specfonts"; [ -f "$SRCS" ] || fd="$BASE/f/delfonts"
    [ "$(col 2 "$(mnode src-sha "$BASE/f/mut.json" "$fd")")" != "$(col 2 "$(mnode src-sha "$base" "$fd")")" ] && p=1
  fi
  echo "T14B $(col 1 "$m") $(col 2 "$m") $p"
  [ -f "$SRCS" ] || loc "$SPEC_DIR/sources.json" "$DELDIR/sources.json" "$(printf '%s %s' "$(col 1 "${d:-}")" "$(col 2 "${d:-}")")"
}
t14c() { need T14C || return; make_map; local m; m=$(FKROOT="$WT" mnode f-record "$MAPF" "$SRCJ"); echo "T14C $(col 1 "$m") $(col 2 "$m") $(col 3 "$m")"; echo "  the record read is the tracked sources.json found at: $(git ls-tree -r --name-only "$V" -- apps/web | grep -E '/sources\.json$' | head -1)"; }
t15() {
  fonts_dir "$SPEC_DIR/licenses" "$BASE/f/lic"  # not fonts: copy every file instead
  rm -rf "$BASE/f/lic"; mkdir -p "$BASE/f/lic"; local f; for f in $(git ls-tree --name-only "$V" -- "$SPEC_DIR/licenses/" 2>/dev/null); do fetch "$f" "$BASE/f/lic/$(basename "$f")"; done
  local m; m=$(mnode lic-files "$BASE/f/lic"); echo "T15 $(col 1 "$m") $(col 2 "$m") $(col 3 "$m")"
  if [ "$(col 1 "$m")" = 0 ] && [ -n "$DELDIR" ]; then
    rm -rf "$BASE/f/lic2"; mkdir -p "$BASE/f/lic2"; for f in $(git ls-tree --name-only "$V" -- "$DELDIR/licenses/" 2>/dev/null); do fetch "$f" "$BASE/f/lic2/$(basename "$f")"; done
    echo "  $SPEC_DIR/licenses/ is absent at $V; the delivered folder is $DELDIR/licenses/; same measure there: $(mnode lic-files "$BASE/f/lic2")"
  fi
}
t15b() {
  src_files; local m d; mkdir -p "$BASE/f/licb/licenses"; rm -f "$BASE/f/licb/licenses"/*; local f
  for f in $(git ls-tree --name-only "$V" -- "$SPEC_DIR/licenses/" 2>/dev/null); do fetch "$f" "$BASE/f/licb/licenses/$(basename "$f")"; done
  m=$(mnode src-lic "$SRCS" "$BASE/f/licb")  # the record names "licenses/<file>", next to sources.json
  echo "T15B $(col 1 "$m") $(col 2 "$m") $(col 3 "$m")"
  if [ ! -f "$SRCS" ] && [ -f "$SRCD" ]; then
    rm -rf "$BASE/f/licd"; mkdir -p "$BASE/f/licd/licenses"; for f in $(git ls-tree --name-only "$V" -- "$DELDIR/licenses/" 2>/dev/null); do fetch "$f" "$BASE/f/licd/licenses/$(basename "$f")"; done
    loc "$SPEC_DIR/sources.json" "$DELDIR/sources.json" "$(mnode src-lic "$SRCD" "$BASE/f/licd")"
  fi
}
# ---- R16: check:fonts and its mutations ---------------------------------------------
cf() { pnenv -- --filter ./apps/web check:fonts > "$BASE/cf.log" 2>&1; return $?; }
cf_names() { grep -qE "$1" "$BASE/cf.log" && echo 1 || echo 0; }
FONT1="be-vietnam-pro-500.woff2"
t16() { need_build T16 || return; cf; echo "T16 $?"; }
mut_row() { # <id> <perl|rm|dist> <target relative to worktree> <perl expr or ""> <file regex> <requirement regex>
  need_build "$1" || return
  local rc1 rc2 nf nr
  case "$2" in
    rm) rm -f "$WT/$3" ;;
    perl) perl -0pi -e "$4" "$WT/$3"; ( cd "$WT" && git diff --quiet -- "$3" ) && { echo "$1 the mutation did not apply (Blocked)"; return; } ;;
    dist) mv "$WT/apps/web/dist" "$WT/apps/web/dist.bak" ;;
  esac
  cf; rc1=$?; nf=$(cf_names "$5"); nr=$(cf_names "$6")
  case "$2" in dist) mv "$WT/apps/web/dist.bak" "$WT/apps/web/dist" ;; *) reset_wt ;; esac
  cf; rc2=$?
  echo "$1 $([ "$rc1" != 0 ] && echo 1 || echo 0) $nf $nr $rc2"
}
t16b() { mut_row T16B rm "$DELDIR/$FONT1" "" 'be-vietnam-pro-500' '\bR(1|3)\b'; }
t16c() { mut_row T16C perl "$DELDIR/fonts.css" 's/font-weight: 500;/font-weight: 501;/' 'fonts\.css' '\bR2\b'; }
t16d() { mut_row T16D perl apps/web/index.html 's#(<title>)#<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/be-vietnam-pro-500.woff2" />\n$1#' 'index\.html' '\bR8\b'; }
t16e() { mut_row T16E perl "$DELDIR/sources.json" 's/("sha256": ")(.)/$1.($2 eq "0" ? "1" : "0")/e' 'sources\.json|be-vietnam-pro-400' '\bR14\b'; }
t16f() { mut_row T16F dist "" "" 'pnpm --filter \./apps/web build' 'pnpm --filter \./apps/web build'; }
t16g() {
  need_build T16G || return
  local big; big=$(find "$WT/node_modules/.pnpm" -name '*.woff2' -size +60k 2>/dev/null | head -1)
  [ -n "$big" ] || { echo "T16G Blocked: no uncut woff2 font is available offline in the temporary worktree to stand for the uncut upstream font"; return; }
  cp "$big" "$WT/$DELDIR/$FONT1"; local rc1 rc2 nf nr
  cf; rc1=$?; nf=$(cf_names 'be-vietnam-pro-500'); nr=$(cf_names '\bR(5|6)\b'); reset_wt; cf; rc2=$?
  echo "T16G $([ "$rc1" != 0 ] && echo 1 || echo 0) $nf $nr $rc2"
}
SCRIPTP="apps/web/scripts/check-fonts.mjs"
t16h() {
  need T16H || return
  local a b
  ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec eslint "$SCRIPTP" --max-warnings 0 >/dev/null 2>&1 ); a=$?
  printf '\nconst qaUnused = 1;\n' >> "$WT/$SCRIPTP"
  ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec eslint "$SCRIPTP" --max-warnings 0 >/dev/null 2>&1 ); b=$?
  reset_wt
  echo "T16H $a $([ "$b" != 0 ] && echo 1 || echo 0)"
}
t16i() {
  need T16I || return
  local a b
  ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec prettier --check "$SCRIPTP" >/dev/null 2>&1 ); a=$?
  printf '\nconst   qaSpaced   =   1;\n' >> "$WT/$SCRIPTP"
  ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec prettier --check "$SCRIPTP" >/dev/null 2>&1 ); b=$?
  reset_wt
  echo "T16I $a $([ "$b" != 0 ] && echo 1 || echo 0)"
}
t16j() { fetch "$SCRIPTP" "$BASE/f/check-fonts.mjs"; local m; m=$(mnode noprocess "$BASE/f/check-fonts.mjs"); echo "T16J $(col 1 "$m") $(col 2 "$m")"; }
# ---- R17, R18 ---------------------------------------------------------------------
t17() { need_build T17 || return; echo "T17 $BUILD_RC"; }
t17b() { need T17B || return; pnenv -- --filter ./apps/web typecheck > "$BASE/tc.log" 2>&1; echo "T17B $?"; }
t17c() {
  need_build T17C || return
  local m; m=$( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node --input-type=module -e '
    import { measure, verdict } from "./tools/bundle-size/check.mjs";
    import fs from "node:fs";
    const { bytes } = JSON.parse(fs.readFileSync("tools/bundle-size/limit.json", "utf8"));
    const size = measure("apps/web/dist");
    console.log(verdict(size, bytes).ok ? 1 : 0, verdict(size, 1).ok ? 0 : 1, size, bytes);' 2>/dev/null )
  [ -n "$m" ] || { echo "T17C the size measure did not run (Blocked)"; return; }
  echo "T17C $(col 1 "$m") $(col 2 "$m")"
  echo "  initial JavaScript $(col 3 "$m") bytes gzip, the limit of TOKI-006 R10 is $(col 4 "$m") bytes"
}
t18() {
  local out in_n
  out=$(git diff --name-only "$V^1" "$V" | grep -v '^apps/web/' | grep -vx 'pnpm-lock.yaml')
  in_n=$(git diff --name-only "$V^1" "$V" | wc -l | tr -d ' ')
  echo "T18 $(printf '%s' "$out" | grep -c .)"
  echo "  files changed by the pull request: $in_n; outside apps/web and not the lock file: $(printf '%s' "$out" | tr '\n' ' ' | sed 's/ $//')"
}

if [ "${1:-}" = SAMPLE ]; then
  write_sample "${2:?usage: SAMPLE <dist-folder>}" 1 && echo "sample.html and ctl.html written to $2" || echo "SAMPLE needs the built folder (assets/*.css): run the build first"
  exit 0
fi

rows="${*:-T1 T1B T2 T2B T2C T3 T3B T3C T4 T4B T5 T6 T6B T7 T7B T8 T8B T8C T9 T9B T9C T10 T10B T11 T11B T12 T12B T12C T13 T13B T13C T13D T13E T14 T14B T14C T15 T15B T16 T16B T16C T16D T16E T16F T16G T16H T16I T16J T17 T17B T17C T18}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr '[:upper:]' '[:lower:]')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
alive=0
for p in $PIDS; do kill_tree "$p"; done
sleep 1
for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
[ -n "$PORT" ] && [ "$(portbusy "$PORT")" = busy ] && alive=$((alive + 1))
cleanup; WT=""
echo "CLEAN worktrees $(git worktree list | grep -qF "$BASE" && echo changed || echo same) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
