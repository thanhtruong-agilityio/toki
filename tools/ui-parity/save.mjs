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
