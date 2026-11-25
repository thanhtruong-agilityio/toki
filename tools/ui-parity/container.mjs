import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

// Runs the UI parity check inside the official Playwright container image, so that the reference
// images and the comparison are drawn by the same Chromium and the same fonts (TOKI-109 R8, R10).

export function playwrightVersion(lockText) {
  const m =
    /'@playwright\/test':\s+specifier: \S+\s+version: ([0-9][0-9.]*)/.exec(
      lockText,
    );
  if (!m) throw new Error("pnpm-lock.yaml has no entry for @playwright/test");
  return m[1];
}

export const imageTag = (version) =>
  `mcr.microsoft.com/playwright:v${version}-noble`;

// `repo` is mounted read-only; the container works on a copy. `out` receives the report and
// `ref` the reference images. The platform is always linux/arm64 (the platform of the builder and of the CI parity job).
export function dockerArgs({
  repo,
  out,
  ref,
  cache,
  uid,
  gid,
  tag,
  mode,
  env,
  args = [],
}) {
  const e = {
    TOKI_PARITY_CONTAINER: "1",
    PARITY_MODE: mode,
    HOME: "/tmp/home",
    ...env,
  };
  return [
    "run",
    "--rm",
    "--init",
    "--ipc=host",
    "--platform",
    "linux/arm64",
    "--user",
    `${uid}:${gid}`,
    "-v",
    `${repo}:/repo:ro`,
    "-v",
    `${out}:/out`,
    "-v",
    `${ref}:/ref`,
    "-v",
    `${cache}:/pnpm-store`,
    ...Object.entries(e).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
    tag,
    "bash",
    "/repo/tools/ui-parity/in-container.sh",
    // The arguments of the user, one for each argument, so that a space or a `*` in one is kept.
    ...args,
  ];
}

// `pnpm ui:reference <screen-id>... | --all [--update]` (R8). An image that exists is kept unless
// --update is given.
export function parseReferenceArgs(args) {
  let all = false;
  let update = false;
  const ids = [];
  for (const arg of args) {
    if (arg === "--all") all = true;
    else if (arg === "--update") update = true;
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else ids.push(arg);
  }
  if (!all && ids.length === 0) throw new Error("give a screen id or --all");
  return { all, ids: all ? [] : ids, update };
}

// The command line, only when this file is run directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const [mode = "test", ...rest] = process.argv.slice(2);
  const docker = spawnSync(
    "docker",
    ["info", "--format", "{{.ServerVersion}}"],
    { encoding: "utf8" },
  );
  if (docker.status !== 0) {
    console.error(
      "parity: Docker is not available; the check runs only in the Playwright container.",
    );
    process.exit(1);
  }
  const version = playwrightVersion(
    readFileSync(`${repo}/pnpm-lock.yaml`, "utf8"),
  );
  const out = `${repo}/e2e/assets/parity`;
  const ref = `${repo}/e2e/parity/reference`;
  // The pnpm store and the pnpm program, kept between runs. It is a folder of the user, because the
  // container runs as the user and a Docker volume would belong to root.
  const cache = `${homedir()}/.cache/toki-parity`;
  mkdirSync(cache, { recursive: true });
  mkdirSync(out, { recursive: true });
  mkdirSync(ref, { recursive: true });
  // The reference mode runs only reference.spec.ts, for the ids asked for.
  let env = {};
  let args = rest;
  if (mode === "reference") {
    try {
      const a = parseReferenceArgs(rest);
      args = ["reference.spec.ts"];
      env = {
        PARITY_REFERENCE_IDS: a.all ? "all" : a.ids.join(","),
        PARITY_UPDATE: a.update ? "1" : "0",
      };
    } catch (error) {
      console.error(`parity: ${error.message}`);
      process.exit(1);
    }
  }
  const result = spawnSync(
    "docker",
    dockerArgs({
      repo,
      out,
      ref,
      cache,
      uid: process.getuid(),
      gid: process.getgid(),
      tag: imageTag(version),
      mode,
      env,
      args,
    }),
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}
