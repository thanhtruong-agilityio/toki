#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-094.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile`. It uses no GitHub call, no database, no server, no port and no browser.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-094.checks.sh [T1 T2 ...]
# It reads files of the commit V with `git show`. A row that calls the module or runs a tool uses ONE
# temporary worktree of V, created on first use under one folder (BASE, made in the current shell, exported
# as TMPDIR and given to every process it starts through `env -i`), installed with
# `pnpm install --frozen-lockfile` under Node 22. The rows that call the module run one throwaway TypeScript
# harness (written into the temporary worktree for the length of one run, then deleted). The harness calls
# the real exports of `@toki/shared` with fixed instants and zones; it reads no clock and prints numbers.
# Each of those rows is PAIRED with a mutated copy: one line of a source file of the temporary worktree is
# changed, the harness runs again, the file is restored, and the LAST number of the row is 1 when the
# results of the row changed (0 when they did not, which would mean the row cannot tell). Everything the
# script started (worktree, folder) is removed when it ends, even when a row fails. The repository itself is
# not changed. No `.env` file is read or created. It prints one line for each row: counts, exit codes and
# words; no secret and no tool output. A row that loops prints how many items it checked. A row that cannot
# be shown prints "(Blocked)" and the reason.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }
SPEC="docs/specs/2026-11-16-date-time-rules-design.md"
DT="packages/shared/src/datetime"

BASE=$(mktemp -d); export TMPDIR="$BASE"
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""
cleanup() {
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  WT=""
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
INSTALL_RC=""
ensure() {
  [ "$NEED22" = 1 ] && return 1
  if [ -z "$WT" ]; then
    mkdir -p "$BASE/wt0"; git worktree add --detach "$BASE/wt0/wt" "$V" >/dev/null 2>&1 || return 1
    WT="$BASE/wt0/wt"
  fi
  if [ -z "$INSTALL_RC" ]; then pnenv -- install --frozen-lockfile >/dev/null 2>&1; INSTALL_RC=$?; fi
  [ "$INSTALL_RC" = 0 ]
}
need() { ensure && return 0; echo "$1 needs Node 22 and an installed worktree of $V (Blocked)"; return 1; }
restore() { ( cd "$WT" && git checkout -q -- . && git clean -fdq ); }
# mutate <file of the worktree> <perl program>: 0 when the file changed, 1 when it did not
mutate() { perl -0pi -e "$2" "$WT/$1" 2>/dev/null; ( cd "$WT" && ! git diff --quiet -- "$1" ); }
numsum() { nodebin -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1]));let n=0;for(const k in o)n+=o[k].length;console.log(n)' "$1"; }
hget() { nodebin -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log((o[process.argv[2]]||["missing"]).join(" "))' "$1" "$2"; }

# ---- the harness --------------------------------------------------------------------------------------
write_harness() { cat > "$1" <<'TS'
/* eslint-disable */
// @ts-nocheck
// Throwaway harness of the QA checks of TOKI-094. It calls the real exports of @toki/shared with fixed instants
// and zones, reads no clock, and prints one JSON object: row id -> list of numbers.
import * as shared from "../../packages/shared/src/index.js";
import { NAMES } from "../../packages/shared/src/datetime/names.js";

const {
  formatTime, formatDate, formatDay, formatDateTime, formatCountdown, zonedParts, utcOffsetMinutes,
  isValidTimeZone, atLocalTime, validateDateTime, validateFutureInstant, validateDateNotPast, quickTimeChoices,
} = shared as any;

const out: Record<string, number[]> = {};
function row(id: string, fn: () => number[]) {
  try { out[id] = fn(); } catch { out[id] = [-1]; }
}
const b = (x: unknown) => (x ? 1 : 0);
const J = (x: unknown) => JSON.stringify(x);
const T = (iso: string) => Date.parse(iso);
const HCM = "Asia/Ho_Chi_Minh", KOL = "Asia/Kolkata", NY = "America/New_York", AKL = "Pacific/Auckland";
const DW = { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday" };
const ctx = (now: number, timeZone = HCM, language = "en") => ({ now, timeZone, language, dayWords: DW });
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NOW = T("2026-11-10T05:00:00Z"); // Tue 10 Nov 2026 12:00 in Asia/Ho_Chi_Minh
const HOUR = 3_600_000, DAY = 86_400_000;

// ---- R1
row("T1", () => [
  b(formatTime(T("2026-11-10T08:05:00Z"), HCM) === "15:05"),
  b(formatTime(T("2026-11-09T17:00:00Z"), HCM) === "00:00"),
  b(formatTime(T("2026-11-10T16:59:00Z"), HCM) === "23:59"),
  b(formatTime(T("2026-11-10T08:05:00Z"), KOL) === "13:35"),
]);
row("T2", () => {
  const zones = [HCM, KOL, NY, AKL, "UTC", "Asia/Kathmandu"];
  let n = 0, match = 0, forbidden = 0;
  for (const z of zones) for (let i = 0; i < 96; i++) {
    const r = formatTime(T("2026-11-10T00:00:00Z") + i * 30 * 60_000, z);
    n++;
    if (typeof r === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(r)) match++;
    if (typeof r === "string" && /AM|PM|24:/.test(r)) forbidden++;
  }
  return [n, match, forbidden];
});

// ---- R2
row("T3", () => {
  const same = ctx(NOW);
  const { dayWords, ...noWords } = same as any;
  let n = 0, ok = 0;
  for (let d = 0; d < 7; d++) { // Sun 8 Nov to Sat 14 Nov 2026 in the zone
    const r = formatDate(T("2026-11-08T05:00:00Z") + d * DAY, noWords);
    n++; if (r === `${WD[d]} ${8 + d} Nov` && /^[A-Za-z]{3} [1-9][0-9]? [A-Za-z]{3}$/.test(r)) ok++;
  }
  for (let m = 0; m < 12; m++) { // the 5th of each month of 2026, 12:00 zone time
    const at = T(`2026-${String(m + 1).padStart(2, "0")}-05T05:00:00Z`);
    const r = formatDate(at, { ...noWords, now: at });
    const wd = zonedParts(at, HCM).weekday;
    n++; if (r === `${WD[wd]} 5 ${MO[m]}`) ok++;
  }
  return [
    b(formatDate(T("2026-11-10T08:05:00Z"), same) === "Tue 10 Nov"),
    b(formatDate(T("2026-11-10T08:05:00Z"), same, { weekday: false }) === "10 Nov"),
    b(formatDate(T("2026-11-01T05:00:00Z"), same) === "Sun 1 Nov"),
    b(formatDate(T("2026-11-10T08:05:00Z"), noWords) === "Tue 10 Nov"),
    n, ok,
  ];
});

// ---- R3
row("T4", () => [
  b(formatDate(T("2026-12-31T05:00:00Z"), ctx(T("2027-03-01T05:00:00Z"))) === "Thu 31 Dec 2026"),
  b(formatDate(T("2027-01-01T05:00:00Z"), ctx(T("2026-06-01T05:00:00Z"))) === "Fri 1 Jan 2027"),
  b(formatDate(T("2026-11-10T08:05:00Z"), ctx(NOW)) === "Tue 10 Nov"),
  b(formatDate(T("2027-11-10T05:00:00Z"), ctx(NOW)) === "Wed 10 Nov 2027"),
]);
row("T5", () => [
  b(formatDate(T("2026-11-10T08:05:00Z"), ctx(NOW), { year: "always" }) === "Tue 10 Nov 2026"),
  b(formatDate(T("2026-12-31T05:00:00Z"), ctx(T("2027-03-01T05:00:00Z")), { year: "always" }) === "Thu 31 Dec 2026"),
  b(formatDate(T("2026-11-10T08:05:00Z"), ctx(NOW), { weekday: false, year: "always" }) === "10 Nov 2026"),
]);
row("T6", () => [
  // 2026-12-31T20:00Z is 1 Jan 2027 03:00 in Asia/Ho_Chi_Minh: the zone year is 2027, the UTC year is 2026
  b(formatDate(T("2026-12-31T20:00:00Z"), ctx(T("2026-06-01T05:00:00Z"))) === "Fri 1 Jan 2027"),
  b(formatDate(T("2026-12-31T20:00:00Z"), ctx(T("2027-01-01T01:00:00Z"))) === "Fri 1 Jan"),
  // 2027-01-01T03:00Z is 31 Dec 2026 22:00 in America/New_York
  b(formatDate(T("2027-01-01T03:00:00Z"), ctx(T("2027-06-01T12:00:00Z"), NY)) === "Thu 31 Dec 2026"),
]);

// ---- R4
const dayOf = (iso: string, now = NOW) => formatDay(T(iso), ctx(now));
row("T7", () => [
  b(dayOf("2026-11-09T17:00:00Z") === "Today"), b(dayOf("2026-11-10T16:59:59.999Z") === "Today"),
  b(dayOf("2026-11-10T17:00:00Z") === "Tomorrow"), b(dayOf("2026-11-11T16:59:59.999Z") === "Tomorrow"),
  b(dayOf("2026-11-08T17:00:00Z") === "Yesterday"), b(dayOf("2026-11-09T16:59:59.999Z") === "Yesterday"),
]);
row("T8", () => {
  const n2330 = T("2026-11-10T16:30:00Z"); // 23:30 on 10 Nov in the zone
  const n0010 = T("2026-11-09T17:10:00Z"); // 00:10 on 10 Nov in the zone
  return [
    b(formatDay(n2330 + 40 * 60_000, ctx(n2330)) === "Tomorrow"),
    b(formatDay(T("2026-11-09T17:30:00Z") - 40 * 60_000, ctx(T("2026-11-09T17:30:00Z"))) === "Yesterday"),
    b(formatDay(n0010 + 23 * HOUR + 40 * 60_000, ctx(n0010)) === "Today"),
    b(formatDay(n0010 + 47 * HOUR + 40 * 60_000, ctx(n0010)) === "Tomorrow"),
  ];
});
row("T9", () => {
  let n = 0, ok = 0;
  for (let k = -30; k <= 30; k++) {
    if (Math.abs(k) <= 1) continue;
    const at = NOW + k * DAY;
    const r = formatDay(at, ctx(NOW)), d = formatDate(at, ctx(NOW));
    n++; if (r === d && d !== null && !/Today|Tomorrow|Yesterday/.test(r)) ok++;
  }
  return [n, ok, b(dayOf("2026-11-11T17:00:00Z") === "Thu 12 Nov"), b(dayOf("2026-11-08T16:59:59.999Z") === "Sun 8 Nov")];
});

// ---- R5
row("T10", () => {
  const c = ctx(NOW);
  const f = (iso: string) => formatDateTime(T(iso), c);
  return [
    b(f("2026-11-10T08:00:00Z") === "Today 15:00"), b(f("2026-11-11T02:00:00Z") === "Tomorrow 09:00"),
    b(f("2026-11-09T11:20:00Z") === "Yesterday 18:20"), b(f("2026-11-16T02:00:00Z") === "Mon 16 Nov 09:00"),
    b(f("2027-01-01T02:00:00Z") === "Fri 1 Jan 2027 09:00"),
  ];
});
row("T11", () => {
  let n = 0, ok = 0;
  const c = ctx(NOW);
  for (let i = 0; i < 40; i++) {
    const at = NOW - 4 * DAY + i * 7 * HOUR;
    n++; if (formatDateTime(at, c) === `${formatDay(at, c)} ${formatTime(at, HCM)}`) ok++;
  }
  return [n, ok];
});

// ---- R6
row("T12", () => {
  const cases: [number, string][] = [[999, "00:00"], [1000, "00:01"], [1999, "00:01"], [59_999, "00:59"], [60_000, "01:00"],
    [3_599_000, "59:59"], [3_600_000, "1:00:00"], [36_000_000, "10:00:00"], [3_725_999, "1:02:05"], [359_999_000, "99:59:59"]];
  let ok = 0; for (const [ms, w] of cases) if (formatCountdown(ms) === w) ok++;
  return [b(formatCountdown(65_000) === "01:05"), b(formatCountdown(3_725_000) === "1:02:05"), cases.length, ok];
});
row("T13", () => {
  const list = [0, -0, -1, -5000, -3_600_000, -1e12];
  let ok = 0; for (const v of list) if (formatCountdown(v) === "00:00") ok++;
  return [list.length, ok];
});
row("T14", () => {
  const list: any[] = [NaN, Infinity, -Infinity, undefined, "65000", "NaN"];
  let ok = 0; for (const v of list) if (formatCountdown(v) === null) ok++;
  return [list.length, ok];
});

// ---- R7
const BAD: any[] = [NaN, Infinity, -Infinity, undefined, "2026-11-10T08:05:00Z"];
row("T15", () => {
  const goodAt = T("2026-11-10T08:05:00Z");
  const places: ((v: any) => unknown)[] = [
    (v) => formatTime(v, HCM), (v) => formatDate(v, ctx(NOW)), (v) => formatDate(goodAt, ctx(v)),
    (v) => formatDay(v, ctx(NOW)), (v) => formatDay(goodAt, ctx(v)), (v) => formatDateTime(v, ctx(NOW)),
    (v) => formatDateTime(goodAt, ctx(v)), (v) => zonedParts(v, HCM), (v) => utcOffsetMinutes(v, HCM),
    (v) => atLocalTime(v, HCM, 0, "09:00"),
  ];
  let calls = 0, nulls = 0, valid = 0;
  for (const p of places) {
    for (const v of BAD) { calls++; if (p(v) === null) nulls++; }
    if (p(goodAt) !== null) valid++;
  }
  return [calls, nulls, valid];
});
row("T16", () => {
  const goodAt = T("2026-11-10T08:05:00Z");
  const places: ((z: any) => unknown)[] = [
    (z) => formatTime(goodAt, z), (z) => formatDate(goodAt, ctx(NOW, z)), (z) => formatDay(goodAt, ctx(NOW, z)),
    (z) => formatDateTime(goodAt, ctx(NOW, z)), (z) => zonedParts(goodAt, z), (z) => utcOffsetMinutes(goodAt, z),
    (z) => atLocalTime(goodAt, z, 0, "09:00"),
  ];
  let calls = 0, nulls = 0, valid = 0;
  for (const p of places) {
    for (const z of ["", "Mars/Phobos"]) { calls++; if (p(z) === null) nulls++; }
    if (p(HCM) !== null) valid++;
  }
  return [calls, nulls, valid];
});
row("T17", () => {
  let nulls = 0;
  for (const v of [NaN, Infinity, -Infinity, undefined]) if (formatCountdown(v as any) === null) nulls++;
  return [4, nulls, b(formatCountdown.length === 1), b((formatCountdown as any)(65_000, "Mars/Phobos") === "01:05")];
});
row("T18", () => {
  const ats: any[] = [T("2026-11-10T08:05:00Z"), T("2026-12-31T20:00:00Z"), 0, -1, 1e15, 8.64e15, 8.64e15 + 1, NaN, Infinity, undefined, "x"];
  const zones: any[] = [HCM, NY, KOL, "", "Mars/Phobos", undefined];
  const strings: string[] = []; let nulls = 0;
  const take = (r: unknown) => { if (typeof r === "string") strings.push(r); else if (r === null) nulls++; };
  for (const at of ats) for (const z of zones) {
    take(formatTime(at, z));
    for (const now of [NOW, NaN, undefined as any]) {
      const c = ctx(now, z);
      take(formatDate(at, c)); take(formatDay(at, c)); take(formatDateTime(at, c));
      take(formatDate(at, c, { weekday: false, year: "always" }));
      take(formatDay(at, { ...c, dayWords: undefined as any }));
      take(formatDateTime(at, { ...c, dayWords: { today: "a", tomorrow: undefined as any, yesterday: "c" } }));
    }
  }
  for (const v of [...ats, 65_000, -5]) take(formatCountdown(v));
  const bad = strings.filter((s) => /Invalid Date|NaN|undefined/.test(s)).length;
  return [strings.length, bad, b(nulls > 0)];
});

// ---- R8
const stripWords = (s: string) => s.split(" ").filter((w) => w !== "T1" && w !== "T2" && w !== "T3" && !WD.includes(w) && !MO.includes(w)).join(" ");
row("T19", () => {
  const c = { now: NOW, timeZone: HCM, language: "en", dayWords: { today: "T1", tomorrow: "T2", yesterday: "T3" } };
  let n = 0, clean = 0; const seen = new Set<string>();
  for (let k = -40; k <= 400; k++) {
    const at = NOW + k * DAY + 4 * HOUR + 30 * 60_000;
    for (const r of [formatDate(at, c), formatDate(at, c, { weekday: false }), formatDate(at, c, { year: "always" }), formatDay(at, c), formatDateTime(at, c)]) {
      n++;
      if (typeof r === "string" && /^[0-9 :]*$/.test(stripWords(r))) clean++;
      if (typeof r === "string") for (const w of r.split(" ")) if (/^T[123]$/.test(w)) seen.add(w);
    }
  }
  return [n, clean, seen.has("T1") ? 1 : 0, seen.has("T2") ? 1 : 0, seen.has("T3") ? 1 : 0];
});
row("T20", () => {
  const langs = Object.keys(NAMES);
  let ok = 0;
  for (const l of langs) if ((NAMES as any)[l].weekdays.length === 7 && (NAMES as any)[l].months.length === 12) ok++;
  return [langs.length, ok, b(J((NAMES as any).en?.weekdays) === J(WD) && J((NAMES as any).en?.months) === J(MO)), b(!("vi" in NAMES))];
});
row("T21", () => {
  const base = ctx(NOW); let n = 0, same = 0;
  for (let k = -3; k <= 40; k++) {
    const at = NOW + k * 9 * DAY + 3 * HOUR;
    for (const lang of ["vi", "fr", "xx", ""]) {
      const c2 = ctx(NOW, HCM, lang);
      n++; if (J([formatDate(at, c2), formatDay(at, c2), formatDateTime(at, c2)]) === J([formatDate(at, base), formatDay(at, base), formatDateTime(at, base)])) same++;
    }
  }
  return [n, same];
});

// ---- R9
row("T22", () => {
  const p = zonedParts(T("2026-11-10T08:05:09Z"), HCM);
  const want: any = { year: 2026, month: 11, day: 10, hour: 15, minute: 5, second: 9, weekday: 2 };
  let m = 0; for (const k of Object.keys(want)) if (p && p[k] === want[k]) m++;
  return [p ? Object.keys(p).length : 0, m,
    b(zonedParts(T("2026-11-08T05:00:00Z"), HCM).weekday === 0) + b(zonedParts(T("2026-11-14T05:00:00Z"), HCM).weekday === 6),
    b(zonedParts(T("2026-01-15T05:00:00Z"), HCM).month === 1) + b(zonedParts(T("2026-12-15T05:00:00Z"), HCM).month === 12),
    b(zonedParts(T("2026-11-09T17:00:00Z"), HCM).hour === 0) + b(zonedParts(T("2026-11-10T16:59:59Z"), HCM).hour === 23)];
});
row("T23", () => [
  b(utcOffsetMinutes(NOW, HCM) === 420), b(utcOffsetMinutes(NOW, KOL) === 330),
  b(utcOffsetMinutes(T("2026-01-15T12:00:00Z"), NY) === -300), b(utcOffsetMinutes(T("2026-07-15T12:00:00Z"), NY) === -240),
]);
row("T24", () => {
  let thrown = 0, falses = 0, n = 0;
  const other: any[] = ["", "Mars/Phobos", "Asia/Nowhere", "+07:00", undefined, null, 7, {}];
  for (const v of other) { n++; try { if (isValidTimeZone(v) === false) falses++; } catch { thrown++; } }
  return [b(isValidTimeZone(HCM) === true), b(isValidTimeZone(KOL) === true) + b(isValidTimeZone(NY) === true), n, falses, thrown];
});

// ---- R10
row("T25", () => [
  b(atLocalTime(NOW, HCM, 0, "09:00") === T("2026-11-10T02:00:00Z")),
  b(atLocalTime(NOW, HCM, 1, "09:00") === T("2026-11-11T02:00:00Z")),
  // 2026-11-10T20:00Z is 11 Nov 03:00 in the zone: the day of now is 11 Nov, not 10 Nov
  b(atLocalTime(T("2026-11-10T20:00:00Z"), HCM, 0, "09:00") === T("2026-11-11T02:00:00Z")),
  b(atLocalTime(T("2026-11-10T20:00:00Z"), HCM, 1, "09:00") === T("2026-11-12T02:00:00Z")),
]);
row("T26", () => {
  const ny = T("2026-03-07T17:00:00Z"), akl = T("2026-09-26T00:00:00Z");
  return [
    b(atLocalTime(ny, NY, 1, "02:30") === T("2026-03-08T07:00:00Z")),
    b(atLocalTime(ny, NY, 1, "02:00") === T("2026-03-08T07:00:00Z")),
    b(atLocalTime(akl, AKL, 1, "02:30") === T("2026-09-26T14:00:00Z")),
    b(atLocalTime(ny, NY, 1, "03:00") === T("2026-03-08T07:00:00Z")) + b(atLocalTime(ny, NY, 1, "01:59") === T("2026-03-08T06:59:00Z")),
  ];
});
row("T27", () => [
  b(atLocalTime(T("2026-10-31T16:00:00Z"), NY, 1, "01:30") === T("2026-11-01T05:30:00Z")),
  b(atLocalTime(T("2026-10-31T16:00:00Z"), NY, 1, "01:00") === T("2026-11-01T05:00:00Z")),
  b(atLocalTime(T("2026-04-03T12:00:00Z"), AKL, 1, "02:30") === T("2026-04-04T13:30:00Z")),
]);
row("T28", () => {
  const bad: any[] = ["9:5", "24:00", "tomorrow", "", "25:00", "12:60", "9:00", "09:00:00", " 09:00", undefined];
  let nulls = 0; for (const t of bad) if (atLocalTime(NOW, HCM, 0, t) === null) nulls++;
  let good = 0; for (const t of ["00:00", "23:59", "09:00"]) if (typeof atLocalTime(NOW, HCM, 0, t) === "number") good++;
  return [bad.length, nulls, good];
});

// ---- R11 to R13
const ENV = { now: NOW, timeZone: HCM };
const vdt = (i: any, e: any = ENV) => J(validateDateTime(i, e));
row("T29", () => {
  const want = J({ ok: false, reason: "required", field: "date" });
  const inputs: any[] = [{ time: "15:00" }, { date: undefined, time: "15:00" }, { date: null, time: "15:00" }, { date: "", time: "15:00" }, { date: "   ", time: "15:00" }];
  let ok = 0; for (const i of inputs) if (vdt(i) === want) ok++;
  return [inputs.length, ok];
});
row("T30", () => {
  const want = J({ ok: false, reason: "required", field: "time" });
  const inputs: any[] = [{ date: "2026-11-20" }, { date: "2026-11-20", time: undefined }, { date: "2026-11-20", time: null }, { date: "2026-11-20", time: "" }, { date: "2026-11-20", time: "  " }];
  let ok = 0; for (const i of inputs) if (vdt(i) === want) ok++;
  return [inputs.length, ok];
});
row("T31", () => {
  const want = J({ ok: false, reason: "required", field: "date" });
  const inputs: any[] = [{}, { date: "", time: "" }, { date: " ", time: null }];
  let ok = 0; for (const i of inputs) if (vdt(i) === want) ok++;
  return [inputs.length, ok];
});
row("T32", () => {
  const dates = ["2026-02-30", "2026-13-01", "tomorrow", "2026-1-1", "26-11-10", "2025-02-29"];
  const times = ["24:00", "9:5", "tomorrow", "09:60", "9:05", "09:00:00"];
  let dOk = 0, tOk = 0;
  for (const d of dates) if (vdt({ date: d, time: "15:00" }) === J({ ok: false, reason: "invalid", field: "date" })) dOk++;
  for (const t of times) if (vdt({ date: "2026-11-20", time: t }) === J({ ok: false, reason: "invalid", field: "time" })) tOk++;
  const leap: any = validateDateTime({ date: "2028-02-29", time: "09:00" }, ENV);
  return [dates.length, dOk, times.length, tOk, b(leap.ok === true && leap.at === T("2028-02-29T02:00:00Z"))];
});
row("T33", () => {
  const env = { now: T("2026-03-01T00:00:00Z"), timeZone: NY };
  let bad = 0;
  for (const t of ["02:00", "02:30", "02:59"]) if (vdt({ date: "2026-03-08", time: t }, env) === J({ ok: false, reason: "invalid", field: "time" })) bad++;
  const after: any = validateDateTime({ date: "2026-03-08", time: "03:00" }, env);
  return [3, bad, b(after.ok === true && after.at === T("2026-03-08T07:00:00Z"))];
});
row("T34", () => [
  b(vdt({ date: "2026-11-10", time: "11:59" }) === J({ ok: false, reason: "past" })),
  b(vdt({ date: "2026-11-10", time: "12:00" }) === J({ ok: false, reason: "past" })),
  b(vdt({ date: "2026-11-10", time: "12:01" }) === J({ ok: true, at: T("2026-11-10T05:01:00Z") })),
  b(vdt({ date: "2026-11-09", time: "23:59" }) === J({ ok: false, reason: "past" })),
]);
row("T35", () => {
  const e1 = { now: T("2026-10-31T00:00:00Z"), timeZone: NY };
  const e2 = { now: T("2026-11-01T05:45:00Z"), timeZone: NY }; // between the two 01:30 of that day
  return [
    b(vdt({ date: "2026-11-01", time: "01:30" }, e1) === J({ ok: true, at: T("2026-11-01T05:30:00Z") })),
    b(vdt({ date: "2026-11-01", time: "01:30" }, e2) === J({ ok: false, reason: "past" })),
  ];
});

// ---- R14
row("T36", () => {
  const N = 1_800_000_000_000;
  return [
    b(J(validateFutureInstant(null, N)) === J({ ok: false, reason: "required" })),
    b(J(validateFutureInstant(undefined, N)) === J({ ok: false, reason: "required" })),
    b(J(validateFutureInstant(NaN, N)) === J({ ok: false, reason: "invalid" })),
    b(J(validateFutureInstant(N - 1, N)) === J({ ok: false, reason: "past" })),
    b(J(validateFutureInstant(N, N)) === J({ ok: false, reason: "past" })),
    b(J(validateFutureInstant(N + 1, N)) === J({ ok: true, at: N + 1 })),
    [Infinity, -Infinity, "2026-11-10T08:05:00Z" as any].filter((v) => J(validateFutureInstant(v, N)) === J({ ok: false, reason: "invalid" })).length,
  ];
});

// ---- R15
const vnp = (d: any, e: any = ENV) => J(validateDateNotPast(d, e));
row("T37", () => {
  let req = 0, inv = 0;
  for (const d of ["", "   ", null, undefined]) if (vnp(d) === J({ ok: false, reason: "required" })) req++;
  for (const d of ["2026-02-30", "tomorrow", "2026-13-01", "2026-11-1"]) if (vnp(d) === J({ ok: false, reason: "invalid" })) inv++;
  return [4, req, 4, inv];
});
row("T38", () => {
  const hcm = { now: T("2026-11-10T20:00:00Z"), timeZone: HCM }; // 11 Nov 03:00 in the zone, 10 Nov in UTC
  const ny = { now: T("2026-11-11T03:00:00Z"), timeZone: NY }; // 10 Nov 22:00 in the zone, 11 Nov in UTC
  return [
    b(vnp("2026-11-10", hcm) === J({ ok: false, reason: "past" })), b(vnp("2026-11-11", hcm) === J({ ok: true, date: "2026-11-11" })),
    b(vnp("2026-11-12", hcm) === J({ ok: true, date: "2026-11-12" })),
    b(vnp("2026-11-09", ny) === J({ ok: false, reason: "past" })), b(vnp("2026-11-10", ny) === J({ ok: true, date: "2026-11-10" })),
    b(vnp("2026-11-11", ny) === J({ ok: true, date: "2026-11-11" })),
  ];
});
row("T39", () => [
  b(vnp("1999-01-01") === J({ ok: false, reason: "past" })), b(vnp("2099-12-31") === J({ ok: true, date: "2099-12-31" })),
  b(vnp("2026-11-10") === J({ ok: true, date: "2026-11-10" })),
]);

// ---- R16
const IDS = (l: any[]) => l.map((x) => x.id).join(">");
const CASES: [string, string][] = [["2026-11-10T03:42:00Z", "in1Hour>today1500>tomorrow0900"], ["2026-11-10T07:59:59Z", "in1Hour>today1500>tomorrow0900"],
  ["2026-11-10T08:00:00Z", "in1Hour>in3Hours>tomorrow0900"], ["2026-11-10T16:30:00Z", "in1Hour>in3Hours>tomorrow0900"]];
row("T40", () => {
  let three = 0, order = 0;
  for (const [iso, ids] of CASES) {
    const l = quickTimeChoices(T(iso), HCM);
    if (l.length === 3) three++;
    if (IDS(l) === ids) order++;
  }
  return [CASES.length, three, order];
});
row("T41", () => {
  let hour = 0, t15 = 0, h3 = 0, t9 = 0;
  for (const [iso] of CASES) {
    const now = T(iso), l = quickTimeChoices(now, HCM);
    const get = (id: string) => l.find((x: any) => x.id === id)?.at;
    if (get("in1Hour") === now + HOUR) hour++;
    if (get("today1500") === T("2026-11-10T08:00:00Z")) t15++;
    if (get("in3Hours") === now + 3 * HOUR) h3++;
    if (get("tomorrow0900") === T("2026-11-11T02:00:00Z")) t9++;
  }
  return [hour, t15, h3, t9];
});
row("T42", () => {
  let lists = 0, three = 0, later = 0, order = 0;
  const ok = ["in1Hour>today1500>tomorrow0900", "in1Hour>in3Hours>tomorrow0900"];
  const run = (z: string, from: string) => { for (let i = 0; i < 192; i++) {
    const now = T(from) + i * 15 * 60_000; const l = quickTimeChoices(now, z);
    lists++; if (l.length === 3) three++;
    if (l.every((x: any) => x.at > now)) later++;
    if (ok.includes(IDS(l))) order++;
  } };
  run(HCM, "2026-11-10T00:00:00Z"); run(NY, "2026-03-07T12:00:00Z"); run(NY, "2026-10-31T12:00:00Z");
  return [lists, three, later, order];
});

// ---- R18 (the names)
row("T47", () => {
  const names = ["formatTime", "formatDate", "formatDay", "formatDateTime", "formatCountdown", "zonedParts", "utcOffsetMinutes",
    "isValidTimeZone", "atLocalTime", "validateDateTime", "validateFutureInstant", "validateDateNotPast", "quickTimeChoices"];
  let n = 0; for (const k of names) if (typeof (shared as any)[k] === "function") n++;
  return [names.length, n];
});

console.log(JSON.stringify(out));
TS
}

# hrun <output file> [VAR=value ...]: runs the harness in the worktree with only those variables
hrun() {
  local o="$1"; shift
  write_harness "$WT/apps/server/zz-datetime.ts"
  ( cd "$WT/apps/server" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" "$@" node --import tsx zz-datetime.ts > "$o" 2>"$BASE/h.err" ); local rc=$?
  rm -f "$WT/apps/server/zz-datetime.ts"
  return $rc
}
H0=""
hclean() { # the harness on the unchanged worktree, once
  [ -n "$H0" ] && return 0
  need "$1" || return 1
  hrun "$BASE/h0.json" || { echo "$1 the harness did not run (Blocked)"; return 1; }
  H0=1
}
# hrow <row> <file> <perl program> [extra numbers]: the numbers of the row on the unchanged copy, any extra
# numbers, then 1 when the results of the row changed on the mutated copy
hrow() {
  local id="$1" file="$2" prog="$3" extra="${4:-}" clean mut flag
  hclean "$id" || return
  clean=$(hget "$BASE/h0.json" "$id")
  if ! mutate "$file" "$prog"; then restore; echo "$id $clean${extra:+ $extra} the mutation did not apply, so the pairing is not shown (Blocked)"; return; fi
  hrun "$BASE/h1.json" || true
  mut=$(hget "$BASE/h1.json" "$id" 2>/dev/null)
  restore
  flag=0; [ "$mut" != "$clean" ] && flag=1
  echo "$id $clean${extra:+ $extra} $flag"
}
FMT="$DT/format.ts"; ZONE="$DT/zone.ts"; VAL="$DT/validate.ts"; QC="$DT/quick-choices.ts"; NAMEF="$DT/names.ts"

# R1
t1() { hrow T1 $FMT 's/pad2\(parts\.hour\)/pad2((parts.hour + 3) % 24)/'; }
t2() { hrow T2 $FMT 's/pad2\(parts\.hour\)/(parts.hour === 0 ? "24" : pad2(parts.hour))/'; }
# R2
t3() {
  local tb=0
  doc "$SPEC" | grep -qF '| Short weekday names (Sunday first) | Sun, Mon, Tue, Wed, Thu, Fri, Sat |' && doc "$SPEC" | grep -qF '| Short month names | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec |' && tb=1
  hrow T3 $FMT 's/names\.weekdays\[parts\.weekday\]/names.weekdays[(parts.weekday + 1) % 7]/' "$tb"
}
# R3
t4() { hrow T4 $FMT 's/parts\.year !== today\.year/parts.year === today.year/'; }
t5() { hrow T5 $FMT 's/opts\.year === "always" \|\| //'; }
t6() { hrow T6 $FMT 's/const parts = zonedParts\(at, ctx\.timeZone\);\n(\s+)const today = zonedParts/const parts = zonedParts(at, "UTC");\n$1const today = zonedParts/'; }
# R4
t7() { hrow T7 $FMT 's/if \(difference === 0\) return ctx\.dayWords\.today;/if (difference === 0 \&\& parts.hour < 23) return ctx.dayWords.today;/'; }
t8() { hrow T8 $FMT 's/const difference =.*?;\n  if/const difference = Math.round((at - ctx.now) \/ DAY_MS);\n  if/s'; }
t9() { hrow T9 $FMT 's/return formatDate\(at, ctx\);/return formatDate(at, ctx, { weekday: false });/'; }
# R5
t10() { hrow T10 $FMT 's/\$\{day\} \$\{time\}/\${day}, \${time}/'; }
t11() { hrow T11 $FMT 's/\$\{day\} \$\{time\}/\${day}, \${time}/'; }
# R6
t12() { hrow T12 $FMT 's/Math\.floor\(ms \/ 1000\)/Math.round(ms \/ 1000)/'; }
t13() { hrow T13 $FMT 's/const total = ms > 0 \? Math\.floor\(ms \/ 1000\) : 0;/const total = Math.floor(Math.abs(ms) \/ 1000);/'; }
t14() { hrow T14 $FMT 's/!Number\.isFinite\(ms\)/Number.isNaN(ms)/'; }
# R7
t15() { hrow T15 $ZONE 's/typeof value === "number" &&\n\s+Number\.isFinite\(value\) &&\n\s+Math\.abs\(value\) <= MAX_INSTANT/typeof value === "number"/'; }
t16() { hrow T16 $ZONE 's/\} catch \{\n    return null;/} catch {\n    return formatterFor("UTC");/'; }
t17() { hrow T17 $FMT 's/formatCountdown\(ms: number\)/formatCountdown(ms: number, timeZone: string)/'; }
t18() { hrow T18 $FMT 's/return parts === null \? null : /return parts === null ? "Invalid Date" : /'; }
# R8
t19() { hrow T19 $FMT 's/return ctx\.dayWords\.today;/return "Today";/'; }
t20() { hrow T20 $NAMEF 's/"Sat"\]/"Sat", "Xxx"]/'; }
t21() { hrow T21 $NAMEF 's/NAMES\[language\] \?\? en/NAMES[language] ?? { weekdays: en.weekdays.map((w) => w.toUpperCase()), months: en.months }/'; }
# R9
t22() { hrow T22 $ZONE 's/weekday,\n  \};/weekday: (weekday + 1) % 7,\n  };/'; }
t23() { hrow T23 $ZONE 's/\(wallOf\(parts\) - whole\) \/ MINUTE_MS/(whole - wallOf(parts)) \/ MINUTE_MS/'; }
t24() { hrow T24 $ZONE 's/return formatterFor\(timeZone\) !== null;/return timeZone !== "";/'; }
# R10
t25() { hrow T25 $ZONE 's/const today = zonedParts\(now, timeZone\);/const today = zonedParts(now, "UTC");/'; }
t26() { hrow T26 $ZONE 's/return \{ kind: "gap", at: high \};/return { kind: "gap", at: low };/'; }
t27() { hrow T27 $ZONE 's/Math\.min\(\.\.\.valid\)/Math.max(...valid)/'; }
t28() { hrow T28 $ZONE 's/2\[0-3\]/2[0-9]/'; }
# R11 to R13
BLANK='s/\(typeof value === "string" && value\.trim\(\) === ""\)/(typeof value === "string" \&\& value === "")/'
t29() { hrow T29 $VAL "$BLANK"; }
t30() { hrow T30 $VAL "$BLANK"; }
t31() { hrow T31 $VAL 's/(if \(isBlank\(input\.date\)\)\n\s+return \{[^}]*\};)\n(\s+)(if \(isBlank\(input\.time\)\)\n\s+return \{[^}]*\};)/$3\n$2$1/'; }
t32() { hrow T32 $VAL 's/return real \? \{ year, month, day \} : null;/return { year, month, day };/'; }
t33() { hrow T33 $VAL 's/resolved\.kind === "gap"/false/'; }
t34() { hrow T34 $VAL 's/resolved\.at <= env\.now/resolved.at < env.now/'; }
t35() { hrow T35 $ZONE 's/Math\.min\(\.\.\.valid\)/Math.max(...valid)/'; }
# R14
t36() { hrow T36 $VAL 's/return at <= now \? \{ ok: false, reason: "past" \}/return at < now ? { ok: false, reason: "past" }/'; }
# R15
t37() { hrow T37 $VAL 's/if \(isBlank\(date\)\) return \{ ok: false, reason: "required" \};/if (date === null || date === undefined) return { ok: false, reason: "required" };/'; }
t38() { hrow T38 $VAL 's/const today = zonedParts\(env\.now, env\.timeZone\);/const today = zonedParts(env.now, "UTC");/'; }
t39() { hrow T39 $VAL 's/typed < current/typed <= current/'; }
# R16
t40() { hrow T40 $QC 's/return \[\n(\s+)\{ id: "in1Hour", at: now \+ HOUR_MS \},\n\s+second,/return [\n$1second,\n$1\{ id: "in1Hour", at: now + HOUR_MS \},/'; }
t41() { hrow T41 $QC 's/now \+ 3 \* HOUR_MS/now + 2 * HOUR_MS/'; }
t42() { hrow T42 $QC 's/today1500 > now/today1500 >= now/'; }

# R17
t43() {
  need T43 || return
  local files n d nd mut
  files=$(cd "$WT" && ls $DT/*.ts | grep -v '\.test\.ts$')
  count_clock() { ( cd "$WT" && grep -lE 'Date\.now' $files 2>/dev/null | wc -l | tr -d ' ' ); }
  count_new() { ( cd "$WT" && grep -lE 'new Date\(\s*\)' $files 2>/dev/null | wc -l | tr -d ' ' ); }
  n=$(echo "$files" | wc -w | tr -d ' '); d=$(count_clock); nd=$(count_new)
  mutate "$ZONE" 's/(export function isValidTimeZone\(timeZone: string\): boolean \{)/$1\n  void Date.now();/' || { restore; echo "T43 the mutation did not apply (Blocked)"; return; }
  mut=$(count_clock); restore
  echo "T43 $n $d $nd $([ "$mut" -ge 1 ] && echo 1 || echo 0)"
}
t44() {
  need T44 || return
  local files n amb cnt loc tz mut
  files=$(cd "$WT" && ls $DT/*.ts | grep -v '\.test\.ts$')
  ambient() { ( cd "$WT" && grep -lE 'getTimezoneOffset|toLocale|\.get(Hours|Date|Day|FullYear|Month|Minutes|Seconds|Milliseconds)\(|resolvedOptions|navigator|process\.env|Intl\.DateTimeFormat\(\)|new Date\(\s*\)|Date\.now' $files 2>/dev/null | wc -l | tr -d ' ' ); }
  n=$(echo "$files" | wc -w | tr -d ' '); amb=$(ambient)
  cnt=$( cd "$WT" && cat $files | grep -c 'new Intl\.DateTimeFormat(' )
  loc=$( cd "$WT" && cat $files | grep -c 'new Intl\.DateTimeFormat("en-US", {' )
  tz=$( cd "$WT" && cat $files | grep -cE '^\s+timeZone,$' )
  mutate "$ZONE" 's/(export function isValidTimeZone\(timeZone: string\): boolean \{)/$1\n  void new Date().getHours();/' || { restore; echo "T44 the mutation did not apply (Blocked)"; return; }
  mut=$(ambient); restore
  echo "T44 $n $amb $cnt $loc $tz $([ "$mut" -ge 1 ] && echo 1 || echo 0)"
}
suite() { # <TZ> <output name>: prints "exit passed failed files"
  local rc
  pnenv TZ="$1" -- exec vitest run packages/shared/src/datetime --reporter=json --outputFile="$BASE/$2.json" >/dev/null 2>&1; rc=$?
  echo "$rc $(nodebin -e 'try{const o=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log(o.numPassedTests,o.numFailedTests,o.testResults.filter(t=>t.status==="passed").length)}catch{console.log("0 0 0")}' "$BASE/$2.json")"
}
t45() {
  need T45 || return
  local a b mrc
  a=$(suite UTC s1); b=$(suite Pacific/Auckland s2)
  mutate "$FMT" 's/pad2\(parts\.hour\)/pad2((parts.hour + 3) % 24)/' || { restore; echo "T45 the mutation did not apply (Blocked)"; return; }
  mrc=$(suite UTC s3 | cut -d' ' -f1); restore
  echo "T45 $(echo "$a" | cut -d' ' -f1) $(echo "$b" | cut -d' ' -f1) $(echo "$a" | cut -d' ' -f2) $(echo "$b" | cut -d' ' -f2) $(echo "$a" | cut -d' ' -f3) $(echo "$a" | cut -d' ' -f4) $([ "$mrc" != 0 ] && echo 1 || echo 0)"
}
t46() {
  hclean T46 || return
  local h1 h2 h3 n same1=0 same2=0 mdiff=0
  hrun "$BASE/z1.json" TZ=UTC || true
  hrun "$BASE/z2.json" TZ=Pacific/Auckland || true
  hrun "$BASE/z3.json" TZ=America/Los_Angeles LANG=vi_VN.UTF-8 LC_ALL=vi_VN.UTF-8 || true
  h1=$(shasum < "$BASE/z1.json"); h2=$(shasum < "$BASE/z2.json"); h3=$(shasum < "$BASE/z3.json")
  [ "$h1" = "$h2" ] && same1=1
  [ "$h1" = "$h3" ] && same2=1
  n=$(numsum "$BASE/z1.json")
  mutate "$ZONE" 's/      timeZone,\n      hourCycle/      hourCycle/' || { restore; echo "T46 the mutation did not apply (Blocked)"; return; }
  hrun "$BASE/m1.json" TZ=UTC || true
  hrun "$BASE/m2.json" TZ=Pacific/Auckland || true
  restore
  [ "$(shasum < "$BASE/m1.json")" != "$(shasum < "$BASE/m2.json")" ] && mdiff=1
  echo "T46 $same1 $same2 $n $mdiff"
}
# R18
t47() {
  local ix=0
  doc packages/shared/src/index.ts | grep -qF 'export * from "./datetime/index.js";' && ix=1
  hrow T47 "$DT/index.ts" 's/export \{ quickTimeChoices \} from "\.\/quick-choices\.js";//' "$ix"
}
t48() {
  need T48 || return
  local good bad
  cat > "$WT/packages/shared/src/zz-types.ts" <<'TS'
import type { DateContext, FormatContext } from "./index.js";
export const a: DateContext = { now: 1, timeZone: "UTC", language: "en" };
export const b: FormatContext = { ...a, dayWords: { today: "a", tomorrow: "b", yesterday: "c" } };
TS
  pnenv -- --filter @toki/shared run typecheck >/dev/null 2>&1; good=$?
  cat > "$WT/packages/shared/src/zz-types.ts" <<'TS'
import type { DateContext, NoSuchContext } from "./index.js";
export const a: DateContext | NoSuchContext = { now: 1, timeZone: "UTC", language: "en" };
TS
  pnenv -- --filter @toki/shared run typecheck >/dev/null 2>&1; bad=$?
  restore
  echo "T48 $good $([ "$bad" != 0 ] && echo 1 || echo 0)"
}
t49() {
  need T49 || return
  local good bad
  pnenv -- run typecheck >/dev/null 2>&1; good=$?
  mutate "$ZONE" 's/\n$/\nexport const zzBad: number = "x";\n/' || { restore; echo "T49 the mutation did not apply (Blocked)"; return; }
  pnenv -- run typecheck >/dev/null 2>&1; bad=$?
  restore
  echo "T49 $good $([ "$bad" != 0 ] && echo 1 || echo 0)"
}
t50() { need T50 || return; pnenv -- run lint >/dev/null 2>&1; echo "T50 $?"; }
t51() {
  need T51 || return
  local good bad
  pnenv -- exec eslint packages/shared/src/datetime --max-warnings 0 >/dev/null 2>&1; good=$?
  mutate "$ZONE" 's/\n$/\nexport const zzGlobal = window.location;\n/' || { restore; echo "T51 the mutation did not apply (Blocked)"; return; }
  pnenv -- exec eslint packages/shared/src/datetime --max-warnings 0 >/dev/null 2>&1; bad=$?
  restore
  echo "T51 $good $([ "$bad" != 0 ] && echo 1 || echo 0)"
}
t52() {
  need T52 || return
  local before after eq=0 changed spec nrel mut files
  before=$(git show "$V^1:packages/shared/package.json" 2>/dev/null | nodebin -e 'const o=JSON.parse(require("fs").readFileSync(0));console.log(JSON.stringify(o.dependencies||{}))')
  after=$(doc packages/shared/package.json | nodebin -e 'const o=JSON.parse(require("fs").readFileSync(0));console.log(JSON.stringify(o.dependencies||{}))')
  [ -n "$before" ] && [ "$before" = "$after" ] && eq=1
  changed=$(git diff --name-only "$V^1" "$V" -- packages/shared/package.json | wc -l | tr -d ' ')
  files=$(cd "$WT" && ls $DT/*.ts | grep -v '\.test\.ts$')
  specs() { ( cd "$WT" && cat $files | grep -oE 'from "[^"]+"' | wc -l | tr -d ' ' ); }
  nonrel() { ( cd "$WT" && cat $files | grep -oE 'from "[^"]+"' | grep -vcE 'from "\.' ); }
  spec=$(specs); nrel=$(nonrel)
  mutate "$ZONE" 's/^/import { zz } from "date-fns";\n/' || { restore; echo "T52 the mutation did not apply (Blocked)"; return; }
  mut=$(nonrel); restore
  echo "T52 $eq $changed $spec $nrel $([ "$mut" -ge 1 ] && echo 1 || echo 0)"
}

rows="${*:-$(seq -f 'T%g' 1 52 | tr '\n' ' ')}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
cleanup
echo "CLEAN worktrees $([ "$(git worktree list | grep -cF "$BASE")" = 0 ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes 0 temporary-folder $([ -d "$BASE" ] && echo kept || echo removed)"
