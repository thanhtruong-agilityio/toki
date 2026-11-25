import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
export function dockerArgs({ repo, out, ref, uid, gid, tag, mode, env }) {
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
    "toki-parity-pnpm-store:/pnpm-store",
    ...Object.entries(e).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
    tag,
    "bash",
    "/repo/tools/ui-parity/in-container.sh",
  ];
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
  mkdirSync(out, { recursive: true });
  mkdirSync(ref, { recursive: true });
  const result = spawnSync(
    "docker",
    dockerArgs({
      repo,
      out,
      ref,
      uid: process.getuid(),
      gid: process.getgid(),
      tag: imageTag(version),
      mode,
      env: { PARITY_ARGS: rest.join(" ") },
    }),
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}
