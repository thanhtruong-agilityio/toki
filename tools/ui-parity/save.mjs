import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

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
