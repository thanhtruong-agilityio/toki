import test from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  UsageError,
  parseSaveArgs,
  folderName,
  countRows,
  dirtyFiles,
  buildMeta,
  renderIndex,
  listRuns,
  writeIndex,
  pruneLines,
  prune,
  saveRun,
} from "./save.mjs";

test("parseSaveArgs: defaults run and keep the images", () => {
  assert.deepEqual(parseSaveArgs([]), {
    run: true,
    images: true,
    update: false,
    prune: null,
  });
});

test("parseSaveArgs: the three options", () => {
  assert.deepEqual(parseSaveArgs(["--no-run", "--no-images", "--update"]), {
    run: false,
    images: false,
    update: true,
    prune: null,
  });
});

test("parseSaveArgs: --prune alone takes a whole number of at least 1", () => {
  assert.deepEqual(parseSaveArgs(["--prune", "3"]).prune, 3);
  for (const bad of [
    ["--prune"],
    ["--prune", "0"],
    ["--prune", "-1"],
    ["--prune", "x"],
    ["--prune", "2.5"],
  ]) {
    assert.throws(() => parseSaveArgs(bad), UsageError, bad.join(" "));
  }
});

test("parseSaveArgs: --prune cannot be combined", () => {
  for (const other of ["--no-run", "--no-images", "--update"]) {
    assert.throws(
      () => parseSaveArgs(["--prune", "2", other]),
      /another option/,
    );
  }
});

test("parseSaveArgs: an unknown option or a positional argument is refused", () => {
  assert.throws(() => parseSaveArgs(["--force"]), /unknown argument --force/);
  assert.throws(() => parseSaveArgs(["admin"]), /unknown argument admin/);
});

test("folderName: UTC date and 7 characters of the commit; -dirty when dirty", () => {
  const sha = "b0a772df1234567890abcdef1234567890abcdef";
  assert.equal(
    folderName("2026-11-26T23:59:59.000Z", sha, false),
    "2026-11-26-b0a772d",
  );
  assert.equal(
    folderName("2026-11-26T23:59:59.000Z", sha, true),
    "2026-11-26-b0a772d-dirty",
  );
});

test("countRows: counts the five statuses", () => {
  const rows = [
    "match",
    "match",
    "differs",
    "known",
    "stale-known",
    "not-run",
    "not-run",
  ].map((status) => ({ status }));
  assert.deepEqual(countRows(rows), {
    match: 2,
    differs: 1,
    known: 1,
    noLongerDifference: 1,
    notRun: 2,
  });
});

test("dirtyFiles: lists changed paths and leaves out docs/ui-parity", () => {
  const porcelain = [
    " M tools/a.mjs",
    "?? new.txt",
    "A  docs/ui-parity/index.md",
    "R  old.txt -> renamed.txt",
    "?? docs/ui-parity/2026-11-26-abc1234/",
  ].join("\n");
  assert.deepEqual(dirtyFiles(porcelain), [
    "tools/a.mjs",
    "new.txt",
    "old.txt",
    "renamed.txt",
  ]);
});

test("dirtyFiles: nothing for an empty status or only kept runs", () => {
  assert.deepEqual(dirtyFiles(""), []);
  assert.deepEqual(
    dirtyFiles("?? docs/ui-parity/x/\n M docs/ui-parity/index.md\n"),
    [],
  );
});

test("dirtyFiles: a quoted path loses its quotes", () => {
  assert.deepEqual(dirtyFiles('?? "a b.txt"'), ["a b.txt"]);
});

test("buildMeta: the keys of R7 and no person", () => {
  const counts = {
    match: 24,
    differs: 0,
    known: 6,
    noLongerDifference: 0,
    notRun: 0,
  };
  const meta = buildMeta({
    now: new Date("2026-11-26T08:03:25.000Z"),
    commit: "b".repeat(40),
    branch: "main",
    dirty: [],
    ran: true,
    images: true,
    counts,
    imageTag: "mcr.microsoft.com/playwright:v1.65.1-noble",
    prototypeSha256: "8afc",
  });
  assert.deepEqual(meta, {
    date: "2026-11-26T08:03:25.000Z",
    commit: "b".repeat(40),
    branch: "main",
    dirty: false,
    dirtyFiles: 0,
    ran: true,
    withImages: true,
    counts,
    imageTag: "mcr.microsoft.com/playwright:v1.65.1-noble",
    prototypeSha256: "8afc",
  });
});

test("buildMeta: a dirty tree is marked with the number of files", () => {
  const meta = buildMeta({
    now: new Date(0),
    commit: "a".repeat(40),
    branch: "HEAD",
    dirty: ["x", "y"],
    ran: false,
    images: false,
    counts: {},
    imageTag: "t",
    prototypeSha256: "h",
  });
  assert.equal(meta.dirty, true);
  assert.equal(meta.dirtyFiles, 2);
  assert.equal(meta.withImages, false);
  assert.equal(meta.ran, false);
});

const meta = (date, c = {}) => ({
  date,
  commit: "c".repeat(40),
  branch: "main",
  dirty: false,
  dirtyFiles: 0,
  ran: true,
  withImages: true,
  counts: {
    match: 24,
    differs: 0,
    known: 6,
    noLongerDifference: 0,
    notRun: 0,
    ...c,
  },
  imageTag: "t",
  prototypeSha256: "h",
});

test("renderIndex: a heading, a sentence and a table, newest first", () => {
  const md = renderIndex([
    { folder: "2026-11-24-aaaaaaa", meta: meta("2026-11-24T10:00:00.000Z") },
    {
      folder: "2026-11-26-bbbbbbb-dirty",
      meta: {
        ...meta("2026-11-26T09:00:00.000Z"),
        dirty: true,
        dirtyFiles: 3,
        branch: "feat/x",
        commit: "b".repeat(40),
      },
    },
  ]);
  const lines = md.split("\n").filter((l) => l.startsWith("|"));
  assert.equal(
    lines[0],
    "| Date (UTC) | Commit | Branch | Tree | Match | Differs | Known | No longer | Not run |",
  );
  assert.match(
    lines[2],
    /^\| 2026-11-26 \| \[bbbbbbb\]\(2026-11-26-bbbbbbb-dirty\/report\.md\) \| feat\/x \| dirty \| 24 \| 0 \| 6 \| 0 \| 0 \|$/,
  );
  assert.match(
    lines[3],
    /^\| 2026-11-24 \| \[ccccccc\]\(2026-11-24-aaaaaaa\/report\.md\) \| main \| clean \|/,
  );
});

test("renderIndex: the same date is ordered by folder name, and the text is stable", () => {
  const a = {
    folder: "2026-11-26-aaaaaaa",
    meta: meta("2026-11-26T10:00:00.000Z"),
  };
  const b = {
    folder: "2026-11-26-bbbbbbb",
    meta: meta("2026-11-26T10:00:00.000Z"),
  };
  assert.equal(renderIndex([a, b]), renderIndex([b, a]));
  const md = renderIndex([a, b]);
  assert.ok(md.indexOf("bbbbbbb") < md.indexOf("aaaaaaa"));
});

test("renderIndex: a pipe in a branch name does not break the table", () => {
  const md = renderIndex([
    {
      folder: "2026-11-26-aaaaaaa",
      meta: { ...meta("2026-11-26T10:00:00.000Z"), branch: "a|b" },
    },
  ]);
  assert.ok(md.includes("a\\|b"));
});

test("renderIndex: no kept run gives the heading and an empty table", () => {
  assert.match(renderIndex([]), /\| Date \(UTC\) \|/);
});

const tmpRoot = () => mkdtempSync(join(tmpdir(), "ui-save-root-"));

function keep(root, folder, m) {
  mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(join(root, folder, "meta.json"), JSON.stringify(m));
}

function five() {
  const root = tmpRoot();
  for (let d = 21; d <= 25; d += 1) {
    keep(
      root,
      `2026-11-${d}-aaaaaa${d % 10}`,
      meta(`2026-11-${d}T10:00:00.000Z`),
    );
  }
  return root;
}

test("listRuns: reads the folders, names an unreadable one and ignores files and dot folders", () => {
  const root = tmpRoot();
  keep(root, "2026-11-24-aaaaaaa", meta("2026-11-24T10:00:00.000Z"));
  keep(root, "2026-11-26-bbbbbbb", meta("2026-11-26T10:00:00.000Z"));
  mkdirSync(join(root, "2026-11-25-ccccccc")); // no meta.json
  mkdirSync(join(root, "2026-11-25-ddddddd"));
  writeFileSync(join(root, "2026-11-25-ddddddd", "meta.json"), "{"); // not JSON
  mkdirSync(join(root, ".tmp-x"));
  writeFileSync(join(root, "index.md"), "x");
  const { runs, unreadable } = listRuns(root);
  assert.deepEqual(
    runs.map((r) => r.folder),
    ["2026-11-24-aaaaaaa", "2026-11-26-bbbbbbb"],
  );
  assert.deepEqual(unreadable, ["2026-11-25-ccccccc", "2026-11-25-ddddddd"]);
});

test("listRuns: a missing root is no run and no error", () => {
  assert.deepEqual(listRuns(join(tmpRoot(), "nope")), {
    runs: [],
    unreadable: [],
  });
});

test("writeIndex: the list follows the folders, so a removed run is gone at the next write", () => {
  const root = tmpRoot();
  keep(root, "2026-11-24-aaaaaaa", meta("2026-11-24T10:00:00.000Z"));
  keep(root, "2026-11-26-bbbbbbb", meta("2026-11-26T10:00:00.000Z"));
  mkdirSync(join(root, "2026-11-01-bad"));
  assert.deepEqual(writeIndex(root).unreadable, ["2026-11-01-bad"]);
  assert.match(readFileSync(join(root, "index.md"), "utf8"), /aaaaaaa/);
  rmSync(join(root, "2026-11-24-aaaaaaa"), { recursive: true });
  writeIndex(root);
  const md = readFileSync(join(root, "index.md"), "utf8");
  assert.doesNotMatch(md, /aaaaaaa/);
  assert.doesNotMatch(md, /bad/);
  assert.match(md, /bbbbbbb/);
});

test("pruneLines: keeps the newest n and names the older ones, newest first", () => {
  const r = pruneLines(five(), 2);
  assert.deepEqual(r.keep, ["2026-11-25-aaaaaa5", "2026-11-24-aaaaaa4"]);
  assert.deepEqual(r.remove, [
    "2026-11-23-aaaaaa3",
    "2026-11-22-aaaaaa2",
    "2026-11-21-aaaaaa1",
  ]);
});

test("pruneLines: n larger than the number of folders removes nothing", () => {
  const r = pruneLines(five(), 9);
  assert.equal(r.remove.length, 0);
  assert.equal(r.keep.length, 5);
});

test("pruneLines: an unreadable folder is not counted and is named", () => {
  const root = five();
  mkdirSync(join(root, "2026-11-26-zzzzzzz"));
  const r = pruneLines(root, 2);
  assert.deepEqual(r.unreadable, ["2026-11-26-zzzzzzz"]);
  assert.equal(r.keep.length + r.remove.length, 5);
});

function io() {
  const logs = [];
  const warns = [];
  return { logs, warns, log: (l) => logs.push(l), warn: (l) => warns.push(l) };
}

test("prune: prints the git rm commands for the runs older than the newest n and deletes nothing", () => {
  const root = five();
  const before = readdirSync(root).sort();
  const o = io();
  assert.equal(prune(root, 2, o), 0);
  assert.deepEqual(
    o.logs.filter((l) => l.startsWith("git rm")),
    [
      "git rm -r docs/ui-parity/2026-11-23-aaaaaa3",
      "git rm -r docs/ui-parity/2026-11-22-aaaaaa2",
      "git rm -r docs/ui-parity/2026-11-21-aaaaaa1",
    ],
  );
  assert.ok(o.logs.some((l) => /makes index\.md again/.test(l)));
  assert.deepEqual(readdirSync(root).sort(), before);
});

test("prune: says that nothing is older when n is larger than the number of folders", () => {
  const o = io();
  assert.equal(prune(five(), 9, o), 0);
  assert.ok(o.logs.some((l) => /nothing is older/.test(l)));
  assert.equal(o.logs.filter((l) => l.startsWith("git rm")).length, 0);
});

test("prune: names a folder with no readable meta.json", () => {
  const root = five();
  mkdirSync(join(root, "2026-11-26-zzzzzzz"));
  const o = io();
  prune(root, 2, o);
  assert.ok(o.warns.some((l) => l.includes("2026-11-26-zzzzzzz")));
});

// The world of a save: a temporary repository with the output of the check, a fake `git` that
// answers only the commands that read (any other fails the test), a fake check and a fixed clock.
function world({
  rows,
  images = ["a-reference.png", "a-app.png", "a-diff.png"],
  porcelain = "",
  runCode = 0,
  writeOnRun = true,
} = {}) {
  const repo = mkdtempSync(join(tmpdir(), "ui-save-"));
  const out = join(repo, "e2e/assets/parity");
  const writeReport = () => {
    mkdirSync(join(out, "images"), { recursive: true });
    writeFileSync(join(out, "report.md"), "# UI parity report\n");
    writeFileSync(
      join(out, "report.json"),
      JSON.stringify({ summary: "checked 3 · match 2 · differs 1", rows }),
    );
    for (const name of images) writeFileSync(join(out, "images", name), "png");
  };
  mkdirSync(join(repo, "e2e/parity"), { recursive: true });
  writeFileSync(join(repo, "e2e/parity/prototype.sha256"), "8afc\n");
  writeFileSync(
    join(repo, "pnpm-lock.yaml"),
    "      '@playwright/test':\n        specifier: 1.65.1\n        version: 1.65.1\n",
  );
  const logs = [];
  const warns = [];
  const gitCalls = [];
  const runs = [];
  const deps = {
    repo,
    git: (args) => {
      gitCalls.push(args.join(" "));
      if (args[0] === "rev-parse" && args[1] === "HEAD") {
        return `${"b0a772df".padEnd(40, "0")}\n`;
      }
      if (args[0] === "rev-parse") return "feat/x\n";
      if (args[0] === "status") return porcelain;
      throw new Error(`git ${args.join(" ")} is not a command that reads`);
    },
    runCheck: () => {
      runs.push("node tools/ui-parity/container.mjs test");
      if (writeOnRun) writeReport();
      return runCode;
    },
    now: () => new Date("2026-11-26T08:03:25.000Z"),
    log: (l) => logs.push(l),
    warn: (l) => warns.push(l),
  };
  return { repo, out, deps, logs, warns, gitCalls, runs, writeReport };
}

const ROWS = ["match", "match", "differs"].map((status, i) => ({
  kind: "token",
  name: `r${i}`,
  status,
  detail: {},
}));
const OPTS = { run: true, images: true, update: false, prune: null };
const NAME = "2026-11-26-b0a772d";
const read = (...p) => readFileSync(join(...p), "utf8");
const dotFiles = (dir) => readdirSync(dir).filter((n) => n.startsWith("."));

test("runs the whole check, once, with no further argument (R3)", () => {
  const w = world({ rows: ROWS });
  assert.equal(saveRun(OPTS, w.deps), 0);
  assert.deepEqual(w.runs, ["node tools/ui-parity/container.mjs test"]);
});

test("an old report is not kept when the check fails (R2, R4)", () => {
  const w = world({ rows: ROWS, runCode: 1, writeOnRun: false });
  w.writeReport(); // the old report of an earlier run
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity")), false);
  assert.equal(existsSync(join(w.out, "report.json")), false); // deleted before the run (R2)
  assert.match(w.warns.join("\n"), /code 1/);
});

test("no result: the check ends with a code other than 0 even when a report was written (R4)", () => {
  const w = world({ rows: ROWS, runCode: 2 });
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity")), false);
});

test("no result: report.json is missing (R4)", () => {
  const w = world({ rows: ROWS, writeOnRun: false });
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.match(w.warns.join("\n"), /report\.json/);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity")), false);
});

test("no result: report.json holds no row, and nothing is written (R4)", () => {
  const w = world({ rows: [] });
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.match(w.warns.join("\n"), /no row/);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity")), false);
});

test("keeps the report, the images and meta.json (R6, R7)", () => {
  const w = world({ rows: ROWS });
  saveRun(OPTS, w.deps);
  const dir = join(w.repo, "docs/ui-parity", NAME);
  assert.deepEqual(readdirSync(dir).sort(), [
    "images",
    "meta.json",
    "report.json",
    "report.md",
  ]);
  assert.deepEqual(readdirSync(join(dir, "images")).sort(), [
    "a-app.png",
    "a-diff.png",
    "a-reference.png",
  ]);
  assert.deepEqual(JSON.parse(read(dir, "meta.json")), {
    date: "2026-11-26T08:03:25.000Z",
    commit: "b0a772df".padEnd(40, "0"),
    branch: "feat/x",
    dirty: false,
    dirtyFiles: 0,
    ran: true,
    withImages: true,
    counts: {
      match: 2,
      differs: 1,
      known: 0,
      noLongerDifference: 0,
      notRun: 0,
    },
    imageTag: "mcr.microsoft.com/playwright:v1.65.1-noble",
    prototypeSha256: "8afc",
  });
});

test("keeps only the .png files of images/ (R6)", () => {
  const w = world({ rows: ROWS, images: ["a-app.png", "notes.txt"] });
  saveRun(OPTS, w.deps);
  assert.deepEqual(
    readdirSync(join(w.repo, "docs/ui-parity", NAME, "images")),
    ["a-app.png"],
  );
});

test("--no-images keeps no images (R8)", () => {
  const w = world({ rows: ROWS });
  saveRun({ ...OPTS, images: false }, w.deps);
  const dir = join(w.repo, "docs/ui-parity", NAME);
  assert.equal(existsSync(join(dir, "images")), false);
  assert.equal(JSON.parse(read(dir, "meta.json")).withImages, false);
});

test("--no-run keeps the last report and says how old it is (R9)", () => {
  const w = world({ rows: ROWS, writeOnRun: false });
  w.writeReport();
  const hourAgo = new Date(w.deps.now().getTime() - 3600_000);
  utimesSync(join(w.out, "report.json"), hourAgo, hourAgo);
  assert.equal(saveRun({ ...OPTS, run: false }, w.deps), 0);
  assert.deepEqual(w.runs, []);
  assert.equal(existsSync(join(w.out, "report.md")), true); // nothing was deleted (R9)
  assert.ok(
    w.logs.some((l) => l.includes("checked 3") && l.includes("1 h 0 min ago")),
  );
  assert.equal(
    JSON.parse(read(w.repo, "docs/ui-parity", NAME, "meta.json")).ran,
    false,
  );
});

test("--no-run with no report keeps nothing (R4, R9)", () => {
  const w = world({ rows: ROWS, writeOnRun: false });
  assert.equal(saveRun({ ...OPTS, run: false }, w.deps), 1);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity")), false);
});

test("a dirty tree is kept, marked and warned about (R11)", () => {
  const w = world({ rows: ROWS, porcelain: " M tools/a.mjs\n" });
  assert.equal(saveRun(OPTS, w.deps), 0);
  const m = JSON.parse(
    read(w.repo, "docs/ui-parity", `${NAME}-dirty`, "meta.json"),
  );
  assert.equal(m.dirty, true);
  assert.equal(m.dirtyFiles, 1);
  assert.equal(w.warns.filter((l) => /uncommitted/.test(l)).length, 1);
  assert.match(w.warns.join("\n"), /1 uncommitted/);
});

test("changes only under docs/ui-parity do not make the tree dirty (R11)", () => {
  const w = world({
    rows: ROWS,
    porcelain: "?? docs/ui-parity/old/\n M docs/ui-parity/index.md\n",
  });
  saveRun(OPTS, w.deps);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity", NAME)), true);
  assert.equal(w.warns.length, 0);
});

test("refuses to replace a kept run, and leaves it as it was (R10)", () => {
  const w = world({ rows: ROWS });
  saveRun(OPTS, w.deps);
  const dir = join(w.repo, "docs/ui-parity", NAME);
  writeFileSync(join(dir, "mark.txt"), "mine");
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.match(w.warns.join("\n"), new RegExp(NAME));
  assert.equal(read(dir, "mark.txt"), "mine");
});

test("--update replaces the folder as a whole (R10)", () => {
  const w = world({ rows: ROWS });
  saveRun(OPTS, w.deps);
  const dir = join(w.repo, "docs/ui-parity", NAME);
  writeFileSync(join(dir, "old-only.txt"), "x");
  assert.equal(saveRun({ ...OPTS, update: true }, w.deps), 0);
  assert.equal(existsSync(join(dir, "old-only.txt")), false);
  assert.equal(existsSync(join(dir, "report.md")), true);
  assert.deepEqual(dotFiles(join(w.repo, "docs/ui-parity")), []);
});

test("a copy that fails half way leaves no folder and no temporary folder (R13)", () => {
  const w = world({ rows: ROWS });
  let calls = 0;
  w.deps.copy = (from, to, options) => {
    calls += 1;
    if (calls === 2) throw new Error("disk full");
    cpSync(from, to, options);
  };
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.match(w.warns.join("\n"), /disk full/);
  assert.deepEqual(readdirSync(join(w.repo, "docs/ui-parity")), []);
});

test("--update keeps the old folder when the copy fails (R13)", () => {
  const w = world({ rows: ROWS });
  saveRun(OPTS, w.deps);
  const dir = join(w.repo, "docs/ui-parity", NAME);
  writeFileSync(join(dir, "mark.txt"), "mine");
  w.deps.copy = () => {
    throw new Error("disk full");
  };
  assert.equal(saveRun({ ...OPTS, update: true }, w.deps), 1);
  assert.equal(read(dir, "mark.txt"), "mine");
  assert.deepEqual(dotFiles(join(w.repo, "docs/ui-parity")), []);
});

test("removes the leftovers of an earlier crash (R13)", () => {
  const w = world({ rows: ROWS });
  const root = join(w.repo, "docs/ui-parity");
  mkdirSync(join(root, ".tmp-dead"), { recursive: true });
  mkdirSync(join(root, ".old-lost"), { recursive: true }); // its folder is missing: put it back
  writeFileSync(join(root, ".old-lost", ".target"), "2026-11-20-aaaaaaa");
  writeFileSync(
    join(root, ".old-lost", "meta.json"),
    JSON.stringify(meta("2026-11-20T10:00:00.000Z")),
  );
  mkdirSync(join(root, ".old-two"), { recursive: true }); // its folder is there by then: remove it
  writeFileSync(join(root, ".old-two", ".target"), "2026-11-20-aaaaaaa");
  assert.equal(saveRun(OPTS, w.deps), 0);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["2026-11-20-aaaaaaa", NAME, "index.md"].sort(),
  );
  assert.equal(existsSync(join(root, "2026-11-20-aaaaaaa", ".target")), false);
});

test("prints the folder, the counts and the next step, and exits 0 (R14)", () => {
  const w = world({ rows: ROWS });
  assert.equal(saveRun(OPTS, w.deps), 0);
  assert.ok(w.logs.includes(`kept docs/ui-parity/${NAME}`));
  assert.ok(w.logs.some((l) => l.startsWith("match 2 · differs 1 · known 0")));
  assert.ok(w.logs.includes("next: git add docs/ui-parity"));
});

test("only commands of git that read are used (R15)", () => {
  const w = world({ rows: ROWS, porcelain: " M x\n" });
  saveRun(OPTS, w.deps);
  assert.ok(w.gitCalls.length >= 3);
  assert.ok(
    w.gitCalls.every(
      (c) => c.startsWith("rev-parse") || c.startsWith("status"),
    ),
  );
});

test("the list follows the folders after a save, and names a bad folder (R12)", () => {
  const w = world({ rows: ROWS });
  mkdirSync(join(w.repo, "docs/ui-parity/2026-11-01-bad"), { recursive: true }); // no meta.json
  saveRun(OPTS, w.deps);
  assert.match(read(w.repo, "docs/ui-parity/index.md"), /b0a772d/);
  assert.doesNotMatch(
    read(w.repo, "docs/ui-parity/index.md"),
    /2026-11-01-bad/,
  );
  assert.ok(w.warns.some((l) => l.includes("2026-11-01-bad")));
  rmSync(join(w.repo, "docs/ui-parity", NAME), { recursive: true });
  saveRun(OPTS, { ...w.deps, now: () => new Date("2026-11-27T08:00:00.000Z") });
  const md = read(w.repo, "docs/ui-parity/index.md");
  assert.match(md, /2026-11-27/);
  assert.doesNotMatch(md, /2026-11-26/);
});
