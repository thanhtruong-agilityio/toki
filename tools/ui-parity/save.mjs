import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { imageTag, playwrightVersion } from "./container.mjs";

// `pnpm ui:save`: keeps the results of the UI parity check in `docs/ui-parity/` (TOKI-135). The
// functions are pure or get what touches the outside as arguments, so that the tests need no Docker.

export class UsageError extends Error {}

// R1: four options and no other. `--prune <n>` is used alone.
export function parseSaveArgs(argv) {
  const o = { run: true, images: true, update: false, prune: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-run") o.run = false;
    else if (arg === "--no-images") o.images = false;
    else if (arg === "--update") o.update = true;
    else if (arg === "--prune") {
      i += 1;
      const value = argv[i];
      if (!/^[1-9][0-9]*$/.test(value ?? "")) {
        throw new UsageError("--prune needs a whole number of at least 1");
      }
      o.prune = Number(value);
    } else throw new UsageError(`unknown argument ${arg}`);
  }
  if (o.prune !== null && (!o.run || !o.images || o.update)) {
    throw new UsageError("--prune cannot be used with another option");
  }
  return o;
}

// R5: the UTC date and the first 7 characters of the commit; `-dirty` when the tree has uncommitted
// changes.
export const folderName = (iso, commit, dirty) =>
  `${iso.slice(0, 10)}-${commit.slice(0, 7)}${dirty ? "-dirty" : ""}`;

// R7: the rows of `report.json` counted by status (`stale-known` is "no longer a difference").
export function countRows(rows) {
  const c = {
    match: 0,
    differs: 0,
    known: 0,
    noLongerDifference: 0,
    notRun: 0,
  };
  for (const { status } of rows) {
    if (status === "match") c.match += 1;
    else if (status === "differs") c.differs += 1;
    else if (status === "known") c.known += 1;
    else if (status === "stale-known") c.noLongerDifference += 1;
    else if (status === "not-run") c.notRun += 1;
  }
  return c;
}

const unquote = (path) =>
  path.length >= 2 && path.startsWith('"') && path.endsWith('"')
    ? path.slice(1, -1)
    : path;

// R11: `git status --porcelain` gives "XY path" or "XY old -> new". The kept runs themselves, not yet
// committed, do not count as changes.
export function dirtyFiles(porcelain) {
  return porcelain
    .split("\n")
    .filter((line) => line.length > 3)
    .flatMap((line) => line.slice(3).split(" -> ").map(unquote))
    .filter((path) => !path.startsWith("docs/ui-parity/"));
}

// R7: the record of a kept run. It holds no name or address of a person.
export function buildMeta({
  now,
  commit,
  branch,
  dirty,
  ran,
  images,
  counts,
  imageTag,
  prototypeSha256,
}) {
  return {
    date: now.toISOString(),
    commit,
    branch,
    dirty: dirty.length > 0,
    dirtyFiles: dirty.length,
    ran,
    withImages: images,
    counts,
    imageTag,
    prototypeSha256,
  };
}

// Newest first by the date of `meta.json`, then by the name of the folder.
export const byNewest = (a, b) => {
  if (a.meta.date !== b.meta.date) return a.meta.date < b.meta.date ? 1 : -1;
  if (a.folder !== b.folder) return a.folder < b.folder ? 1 : -1;
  return 0;
};

const cell = (value) => String(value).replace(/\|/g, "\\|");

// R12: the list of kept runs, made from the folders and never edited by hand.
export function renderIndex(entries) {
  const head =
    "| Date (UTC) | Commit | Branch | Tree | Match | Differs | Known | No longer | Not run |";
  const rows = [...entries].sort(byNewest).map(({ folder, meta: m }) => {
    const c = m.counts;
    return `| ${m.date.slice(0, 10)} | [${m.commit.slice(0, 7)}](${folder}/report.md) | ${cell(m.branch)} | ${m.dirty ? "dirty" : "clean"} | ${c.match} | ${c.differs} | ${c.known} | ${c.noLongerDifference} | ${c.notRun} |`;
  });
  return [
    "# UI parity: kept runs",
    "",
    "The runs that `pnpm ui:save` kept, newest first. This file is made again from the folders at every save; do not edit it by hand.",
    "",
    head,
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

// R12: the kept runs: every folder of `root` (not a dot folder, not a file) that has a readable
// `meta.json`. A folder whose `meta.json` is missing or bad is `unreadable`, and named.
export function listRuns(root) {
  const runs = [];
  const unreadable = [];
  let names;
  try {
    names = readdirSync(root);
  } catch {
    return { runs, unreadable };
  }
  for (const folder of names.sort()) {
    if (folder.startsWith(".")) continue;
    if (!statSync(join(root, folder)).isDirectory()) continue;
    try {
      const meta = JSON.parse(
        readFileSync(join(root, folder, "meta.json"), "utf8"),
      );
      if (
        typeof meta.date !== "string" ||
        typeof meta.commit !== "string" ||
        typeof meta.counts !== "object" ||
        meta.counts === null
      ) {
        throw new Error("not a meta.json of ui:save");
      }
      runs.push({ folder, meta });
    } catch {
      unreadable.push(folder);
    }
  }
  return { runs, unreadable };
}

// R12: writes `index.md` again from the folders, so a run removed by hand is gone from it.
export function writeIndex(root) {
  const { runs, unreadable } = listRuns(root);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "index.md"), renderIndex(runs));
  return { unreadable };
}

// R18: the newest `n` kept runs and the older ones, newest first. A folder with no readable
// `meta.json` is not counted.
export function pruneLines(root, n) {
  const { runs, unreadable } = listRuns(root);
  const sorted = [...runs].sort(byNewest).map((run) => run.folder);
  return { keep: sorted.slice(0, n), remove: sorted.slice(n), unreadable };
}

// R18: `--prune <n>` only prints. It keeps the newest `n` kept runs and prints the `git rm` command
// for each older one; the builder runs them. It deletes nothing itself.
export function prune(root, n, io) {
  const { keep, remove, unreadable } = pruneLines(root, n);
  for (const folder of unreadable) {
    io.warn(`not counted, no readable meta.json: docs/ui-parity/${folder}`);
  }
  if (remove.length === 0) {
    io.log(
      `nothing is older than the newest ${n} kept runs (${keep.length} kept)`,
    );
    return 0;
  }
  io.log(
    `keeping the newest ${n}; to remove the ${remove.length} older runs, run:`,
  );
  for (const folder of remove) io.log(`git rm -r docs/ui-parity/${folder}`);
  io.log(
    "then run `pnpm ui:save` next time: it makes index.md again from the folders",
  );
  return 0;
}

// "1 h 0 min" for the age of the report kept by `--no-run` (R9).
export function ago(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${Math.floor(min / 1440)} d ${Math.floor((min % 1440) / 60)} h`;
}

// R13: what an earlier crash left behind. A `.tmp-*` folder is removed. An `.old-*` folder is the run
// that `--update` set aside: it is put back when its folder is missing, else removed.
function cleanLeftovers(root) {
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (name.startsWith(".tmp-")) {
      rmSync(dir, { recursive: true, force: true });
    } else if (name.startsWith(".old-")) {
      let target = null;
      try {
        target = readFileSync(join(dir, ".target"), "utf8").trim();
      } catch {
        // no .target: nothing to put back
      }
      if (target && !existsSync(join(root, target))) {
        rmSync(join(dir, ".target"), { force: true });
        renameSync(dir, join(root, target));
      } else {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  }
}

const fail = (warn, message) => {
  warn(`nothing kept: ${message}`);
  return 1;
};

// R2-R4, R6-R15: runs the check (or not), and keeps its output in `docs/ui-parity/<name>/`. What
// touches the outside is in `deps`: { repo, git, runCheck, now, log, warn, copy? }.
export function saveRun(options, deps) {
  const { repo, git, runCheck, now, log, warn } = deps;
  const copy = deps.copy ?? cpSync;
  const rename = deps.rename ?? renameSync;
  const out = join(repo, "e2e/assets/parity");
  const root = join(repo, "docs/ui-parity");
  if (existsSync(root)) cleanLeftovers(root);
  const commit = git(["rev-parse", "HEAD"]).trim();
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const dirty = dirtyFiles(git(["status", "--porcelain"]));

  if (options.run) {
    for (const name of ["report.md", "report.json"]) {
      rmSync(join(out, name), { force: true });
    }
    rmSync(join(out, "images"), { recursive: true, force: true });
    const code = runCheck();
    if (code !== 0) {
      return fail(warn, `the check ended with code ${code}`);
    }
  }

  let report;
  try {
    report = JSON.parse(readFileSync(join(out, "report.json"), "utf8"));
  } catch {
    return fail(warn, "e2e/assets/parity/report.json is missing or unreadable");
  }
  if (!Array.isArray(report.rows) || report.rows.length === 0) {
    return fail(warn, "report.json has no row");
  }
  if (!options.run) {
    const age = ago(
      now().getTime() - statSync(join(out, "report.json")).mtimeMs,
    );
    log(`${report.summary} (report written ${age} ago)`);
  }

  const name = folderName(now().toISOString(), commit, dirty.length > 0);
  const target = join(root, name);
  if (existsSync(target) && !options.update) {
    return fail(warn, `${target} is already kept; use --update to replace it`);
  }
  if (dirty.length > 0) {
    warn(
      `the working tree has ${dirty.length} uncommitted file(s); the run is kept and marked dirty`,
    );
  }

  const meta = buildMeta({
    now: now(),
    commit,
    branch,
    dirty,
    ran: options.run,
    images: options.images,
    counts: countRows(report.rows),
    imageTag: imageTag(
      playwrightVersion(readFileSync(join(repo, "pnpm-lock.yaml"), "utf8")),
    ),
    prototypeSha256: readFileSync(
      join(repo, "e2e/parity/prototype.sha256"),
      "utf8",
    ).trim(),
  });

  const id = randomBytes(4).toString("hex");
  const tmp = join(root, `.tmp-${id}`);
  const old = join(root, `.old-${id}`);
  let aside = false;
  try {
    mkdirSync(root, { recursive: true });
    mkdirSync(tmp);
    copy(join(out, "report.md"), join(tmp, "report.md"));
    copy(join(out, "report.json"), join(tmp, "report.json"));
    if (options.images) {
      copy(join(out, "images"), join(tmp, "images"), {
        recursive: true,
        filter: (src) => statSync(src).isDirectory() || src.endsWith(".png"),
      });
    }
    writeFileSync(join(tmp, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
    if (existsSync(target)) {
      rename(target, old);
      aside = true;
      writeFileSync(join(old, ".target"), name);
    }
    try {
      rename(tmp, target);
    } catch (error) {
      if (aside) {
        rmSync(join(old, ".target"), { force: true });
        renameSync(old, target);
      }
      aside = false;
      throw error;
    }
    if (aside) rmSync(old, { recursive: true, force: true });
  } catch (error) {
    rmSync(tmp, { recursive: true, force: true });
    return fail(warn, error.message);
  }

  const { unreadable } = writeIndex(root);
  for (const folder of unreadable) {
    warn(
      `left out of index.md, no readable meta.json: docs/ui-parity/${folder}`,
    );
  }
  const c = meta.counts;
  log(`kept docs/ui-parity/${name}`);
  log(
    `match ${c.match} · differs ${c.differs} · known ${c.known} · no longer a difference ${c.noLongerDifference} · not run ${c.notRun}`,
  );
  log("next: git add docs/ui-parity");
  return 0;
}

const USAGE =
  "usage: pnpm ui:save [--no-run] [--no-images] [--update]   |   pnpm ui:save --prune <n>";

// The command line. `io` replaces what touches the outside; the defaults are the real thing.
export function main(argv, io = {}) {
  const repo =
    io.repo ?? resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const deps = {
    ...io,
    repo,
    git:
      io.git ??
      ((args) => {
        const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
        if (r.status !== 0) {
          throw new Error(`git ${args.join(" ")} failed: ${r.stderr.trim()}`);
        }
        return r.stdout;
      }),
    runCheck:
      io.runCheck ??
      (() =>
        spawnSync(process.execPath, ["tools/ui-parity/container.mjs", "test"], {
          cwd: repo,
          stdio: "inherit",
        }).status ?? 1),
    now: io.now ?? (() => new Date()),
    log: io.log ?? ((line) => console.log(line)),
    warn: io.warn ?? ((line) => console.error(line)),
  };
  let options;
  try {
    options = parseSaveArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    deps.warn(`${error.message}\n${USAGE}`);
    return 2;
  }
  if (options.prune !== null) {
    return prune(join(repo, "docs/ui-parity"), options.prune, deps);
  }
  return saveRun(options, deps);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
