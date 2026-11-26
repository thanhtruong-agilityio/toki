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
