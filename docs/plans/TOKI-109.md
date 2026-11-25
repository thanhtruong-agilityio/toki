# TOKI-109 UI parity check - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One check, run in the Playwright container, that compares the built app with a fixed copy of the prototype and writes a report of where they differ, for the token values (24 combinations) and for declared screens (Calm and Focus at three widths).

**Architecture:** A wrapper script (`tools/ui-parity/container.mjs`) runs the official Playwright image of the version in the lockfile, copies the repository into the container, installs Linux dependencies and runs `playwright.parity.config.ts` there. A differing token or image is a result, not a failed test: each check attaches a JSON row, and a custom reporter writes `report.md` and `report.json` to `e2e/assets/parity`. Reference images are made from the prototype by `pnpm ui:reference` through the same container.

**Tech Stack:** Playwright 1.65.1 (Chromium, image `mcr.microsoft.com/playwright:v1.65.1-noble`), Vitest (pure helpers), `node:test` (`tools/`), `pixelmatch` and `pngjs` (new devDependencies, exact versions), Docker.

**Spec:** `docs/specs/2026-11-24-ui-parity-check-design.md` (requirements R1 to R18, concerns 1 to 9). Intent: `docs/intents/ui-parity-check.md`. Ticket: TOKI-109, issue 270.

## Global Constraints
- Match rule: a pixel differs when `pixelmatch` says so with `threshold` 0.1 and `includeAA` false; the image matches when the ratio of different pixels is at most 0.02. All three values live in `e2e/parity/limits.ts` (R9).
- Widths: `wide` 1280 x 800, `mid` 900 x 800, `narrow` 390 x 844 (R6). Looks: `calm`, `focus`. Accents: `teal`, `indigo`, `clay`, `violet`. Densities: `own`, `comfortable`, `compact`.
- Capture settings: Chromium, scale factor 1, time zone `Asia/Ho_Chi_Minh`, locale `en-US`, reduced motion, browser time fixed at Tuesday 10 November 2026 10:42 `+07:00`, animations off, `document.fonts.ready` awaited (R6, R7). Prototype capture element `#app`; app capture element `.app`. Masks: `[data-timer]` and the declaration's selectors.
- Reference file name: `e2e/parity/reference/<screen-id>-<look>-<width>-chromium-linux.png` (R8). Report: `e2e/assets/parity/report.md` and `report.json` (deviation 1).
- Image: `mcr.microsoft.com/playwright:v<version of @playwright/test in pnpm-lock.yaml>-noble`; the run refuses to start when Docker is missing or the version differs (R8, R10).
- Platform: always `--platform linux/amd64`, on every machine and in CI, so that the reference images and the CI capture come from the same build (decided by Thanh Truong on 2026-11-24).
- Node in the container: the image's own Node (26.13.1 when probed), with `devEngines.runtime.onFail` changed from `error` to `warn` in the container's copy of `package.json` only; the repository's `package.json` is not changed (decided by Thanh Truong on 2026-11-24). pnpm 12.21.0 is installed with npm because the image has no corepack.
- Prototype copy: `e2e/prototype/index.html`, SHA-256 `8afc5b13cbc2f0a487eb3041421e2a81667ae0d783e6f87e65332e8377b7bb35` (2629 lines, 259,825 bytes), recorded in `e2e/parity/prototype.sha256` (R17).
- Parity web port: 5193 (5173, 5174, 5183 are taken). The parity config starts only Vite; every `/api` call is stubbed.
- Differences do not fail a run. A run fails only where no result can be given: reference missing, state not reachable, prototype hash changed, run outside the container, image version differs (R8, R10, R13, R17).
- No attribution lines in commits. Conventional Commits with a lowercase subject. Work on branch `test/toki-109-ui-parity-check`, never on `main`; no force-push; no merge.

## Deviations from the merged spec (recorded here and in the pull request)
1. Report path is `e2e/assets/parity`, not `test-results/parity/` (R11): every config writes under `e2e/assets/` and CI uploads that folder (`playwright.config.ts:19`, `ci.yml:159`).
2. Colour scheme: the app takes its look from `prefers-color-scheme` at load (`applyAppearance({look:"device"})`), so the app side uses `emulateMedia` dark for Focus and light for Calm; the prototype side sets its look explicitly. R6 says `light` for both.
3. R14 fallback applies: no built screen matches the prototype (the app's `/admin` shows Members and Channels, the prototype's `admin` shows Analytics and Automations). The proof of this ticket is the token check on the preview page (R3), two control tests that need no app screen (prototype against itself matches; prototype against an altered copy gives a report row) and the Vitest tests. `/admin` is declared as a smoke screen and recorded as a known difference, to run the app side of the pipeline end to end.
4. Layout additions to the spec's tree: `e2e/support/tokens.ts`, `e2e/support/parity-reporter.ts`, `e2e/vitest.config.ts` (a Vitest project, because the root `vitest.config.ts` lists only `apps/*` and `packages/*`), `tools/ui-parity/in-container.sh`, `playwright.parity.config.ts`.
5. Fonts are read from `apps/web/assets/fonts/` (the real path), not `apps/web/src/fonts/` as the TOKI-010 spec says.
6. Node 26, not 22, inside the container (the spec and `.nvmrc` say 22): the image ships Node 26.13.1 and no corepack, and the lead chose to run it rather than download Node 22 or build an image. The container's copy of `package.json` relaxes `devEngines` so that `pnpm install` runs; tests and Vite therefore run on Node 26 in this check while the other CI steps run on Node 22.
7. `--platform linux/amd64` always (the spec says "the same image and Chromium"; this fixes the architecture too). On Apple Silicon this runs under emulation, slower; if Chromium does not start there, stop and ask.

## How This Plan Was Created
1. Spec provided: `docs/specs/2026-11-24-ui-parity-check-design.md`; analysis and design approved by Thanh Truong on 2026-11-24.
2. Implementation plan: this document. Recommended execution: `cl-dev:executing-plans`.

---

## AC -> step -> test
| Req | Acceptance criterion (short) | Task / step | Test that proves it |
|---|---|---|---|
| R1 | Prototype copy opened by `openPrototype`; seven font faces; no other host | T3 steps 1, 4-6 | `e2e/parity/prototype.spec.ts` "no request leaves the machine, seven faces load" |
| R2 | Look/accent/density set the way the prototype does | T3 steps 4-6 | `prototype.spec.ts` "--accent is ... in ... with ..." (Calm teal `#0F766E`, Focus teal `#5EEAD4`, Calm indigo `#4F46E5`, Focus indigo `#A5B4FC`, clay `#B4532A`/`#FDBA8C`, violet `#7C3AED`/`#C4B5FD`) |
| R3 | 24 combinations, one row per difference, computed values | T4 steps 1-8 | `e2e/support/tokens.test.ts` (diff, normaliser); `e2e/parity/tokens.spec.ts`; negative: change one token value |
| R4 | Names from `tokens.css`; known differences; stale entry listed | T4 steps 1-4, 9 | `tokens.test.ts` "parseTokenNames", "known differences" |
| R5 | Declaration files picked up with no other edit | T5 steps 7-8 | `e2e/support/parity.test.ts` "expandScreens"; `screens.spec.ts` |
| R6 | Same capture settings on both sides; "sizes differ" is a result | T3 step 8, T5 steps 1-2 | `parity.test.ts` "sizes differ"; `controls.spec.ts` |
| R7 | Stable capture: clock, animations, `#app`, masks, determinism | T5 steps 3-6 | `controls.spec.ts` "prototype twice is identical" |
| R8 | `pnpm ui:reference`: from the prototype, `--update`, image version check | T1 steps 1-4, T6 steps 1-5 | `container.test.mjs`; `reference.spec.ts` "keeps an existing image without --update" |
| R9 | Per-pixel rule and ratio in one place; difference is a result | T5 steps 1-2 | `parity.test.ts` "compareImages" (identical, one pixel, AA ignored, sizes differ) |
| R10 | Container only; never skips; missing reference fails | T1 step 5, T2 steps 1-3 | `guard.test.ts`; negative: run natively fails with the message |
| R11 | Report rows with stable names, box, three images | T4 step 8, T5 steps 5-6 | `parity-reporter.test.ts`; `controls.spec.ts` "altered copy gives a row" |
| R12 | `seed: true` accepted, counted "not run" | T5 step 7 | `parity.test.ts` "seeded declarations are not run" |
| R13 | Unreachable state fails naming screen, step, selector; writes nothing | T5 step 4 | `controls.spec.ts` "wrong selector" |
| R14 | Fallback: proof by token check, controls, Vitest; `/admin` smoke | T7 steps 1-5 | `screens.spec.ts` for `admin`; known differences listed in the report |
| R15 | Two CI steps in the e2e job; green with differences | T8 steps 1-3 | A pull request with a deliberate difference: job green, summary shows the row (recorded in the PR) |
| R16 | One-page guide | T8 step 4 | The sample (`admin`) was added by following it |
| R17 | Hash check fails with the message | T3 steps 2-3, 7 | `prototype.test.ts` "hash mismatch" |
| R18 | All checks exit 0; Vitest tests for pure functions | T8 step 6 | `pnpm lint`, `typecheck`, `test`, `format:check`, `test:e2e`, `test:e2e:parity` |

## Design
(Approved by Thanh Truong on 2026-11-24. Facts found in exploration are in the tasks.)

**Run.** `pnpm test:e2e:parity` and `pnpm ui:reference` call `tools/ui-parity/container.mjs`. It checks that Docker answers, reads the version of `@playwright/test` from `pnpm-lock.yaml`, builds the image tag, and runs the container with `--user <uid>:<gid>`, `--ipc=host`, the repository mounted read-only at `/repo`, `e2e/assets/parity` mounted at `/out`, `e2e/parity/reference` mounted at `/ref`, and a named volume `toki-parity-pnpm-store`. `tools/ui-parity/in-container.sh` copies `/repo` to `/work` (without `node_modules`, `.git`, `e2e/assets`), relaxes `devEngines` in that copy, installs pnpm 12.21.0 with npm (the image has no corepack), runs `pnpm install --frozen-lockfile` and then `playwright test -c playwright.parity.config.ts`. The container is always `linux/amd64`. Copying keeps the Linux install away from the host's `node_modules`. Vite runs in the same container, so `127.0.0.1` works.

**Tests.** The parity config (`testDir ./e2e/parity`, `testMatch **/*.spec.ts`, one worker, port 5193, `outputDir /out`, reporter `list` plus `e2e/support/parity-reporter.ts`) holds: `prototype.spec.ts` (R1, R2), `tokens.spec.ts` (R3, R4), `controls.spec.ts` (R7, R9, R11, R13), `screens.spec.ts` (R5, R12 and the declared screens), `reference.spec.ts` (R8, active only when `PARITY_REFERENCE=1`). The default config ignores `parity/**` and `prototype/**`.

**Results.** A check attaches a `parity-row` JSON (`kind`, `name`, `status`: `match | differs | known | stale-known | not-run`, details, image paths). The reporter reads the attachments in `onTestEnd` and writes the report in `onEnd`.

**Helpers** are plain TypeScript in `e2e/support/` with Vitest tests in `e2e/support/*.test.ts` (Vitest project `e2e`). The tools in `tools/ui-parity/` are `.mjs` with `node:test`, listed in the root `test` script like `tools/bundle-size`.

## Files by task
| Task | Creates | Modifies |
|---|---|---|
| T1 | `tools/ui-parity/container.mjs`, `container.test.mjs`, `in-container.sh` | `package.json` (scripts `test:e2e:parity`, `test`) |
| T2 | `playwright.parity.config.ts`, `e2e/support/guard.ts`, `e2e/support/guard.test.ts`, `e2e/vitest.config.ts` | `playwright.config.ts` (`testIgnore`), `vitest.config.ts`, `tsconfig.json`, `.prettierignore`, `package.json` (devDependencies), `pnpm-lock.yaml` |
| T3 | `e2e/prototype/index.html`, `e2e/parity/prototype.sha256`, `e2e/support/prototype.ts`, `e2e/support/prototype.test.ts`, `e2e/parity/prototype.spec.ts` | none |
| T4 | `e2e/support/tokens.ts`, `e2e/support/tokens.test.ts`, `e2e/support/parity-reporter.ts`, `e2e/support/parity-reporter.test.ts`, `e2e/parity/known-differences.ts`, `e2e/parity/tokens.spec.ts` | none |
| T5 | `e2e/parity/limits.ts`, `e2e/support/parity.ts`, `e2e/support/parity.test.ts`, `e2e/parity/controls.spec.ts`, `e2e/parity/screens.spec.ts` | none |
| T6 | `tools/ui-parity/reference.test.mjs`, `e2e/parity/reference.spec.ts` | `package.json` (script `ui:reference`), `tools/ui-parity/container.mjs` |
| T7 | `e2e/parity/screens/admin.ts`, 6 reference PNGs | `e2e/parity/known-differences.ts` |
| T8 | `e2e/parity/README.md` | `.github/workflows/ci.yml`, `.github/scripts/changed.sh`, `CLAUDE.md` (Commands) |

---

### Task 1: Container wrapper
**Files:** Create `tools/ui-parity/container.mjs`, `tools/ui-parity/container.test.mjs`, `tools/ui-parity/in-container.sh`; Modify `package.json`.

**Interfaces:**
- Produces: `playwrightVersion(lockText: string): string`, `imageTag(version: string): string`, `dockerArgs(o: { repo, out, ref, uid, gid, tag, mode: "test" | "reference", env: Record<string,string> }): string[]`, and a CLI: `node tools/ui-parity/container.mjs test|reference [--all|<id>] [--update]`.

**Acceptance Criteria:**
- [ ] The image tag is derived from the lockfile; a mismatch or a missing Docker prints a message and runs nothing (R8, R10).

- [x] **Step 1: Probe the image once.** Done on 2026-11-24: Node v26.13.1, no corepack, npm 11.20.0, `aarch64` on the Apple Silicon host. The repository wants Node 22 (`engines`, `devEngines` with `onFail: error`, `.nvmrc`). Thanh Truong decided to run the image's Node 26 and to force `linux/amd64` everywhere (deviations 6 and 7).
- [ ] **Step 2: Write the failing tests** in `container.test.mjs`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import { playwrightVersion, imageTag, dockerArgs } from "./container.mjs";

const lock = `      '@playwright/test':\n        specifier: 1.65.1\n        version: 1.65.1\n`;
test("reads the version from the lockfile", () => assert.equal(playwrightVersion(lock), "1.65.1"));
test("throws when the lockfile has no entry", () => assert.throws(() => playwrightVersion("x"), /@playwright\/test/));
test("tag", () => assert.equal(imageTag("1.65.1"), "mcr.microsoft.com/playwright:v1.65.1-noble"));
test("docker args mount the repo read-only and pass the user", () => {
  const a = dockerArgs({ repo: "/r", out: "/o", ref: "/f", uid: 501, gid: 20, tag: "img", mode: "test", env: {} });
  assert.ok(a.includes("--user") && a.includes("501:20"));
  assert.ok(a.join(" ").includes("--platform linux/amd64"));
  assert.ok(a.includes("/r:/repo:ro") && a.includes("/o:/out") && a.includes("/f:/ref"));
  assert.ok(a.includes("TOKI_PARITY_CONTAINER=1"));
});
```
- [ ] **Step 3: Run `node --test tools/ui-parity/container.test.mjs`.** Expected: FAIL (module missing).
- [ ] **Step 4: Implement** `container.mjs`:
```js
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export function playwrightVersion(lockText) {
  const m = /'@playwright\/test':\s+specifier: \S+\s+version: ([0-9][0-9.]*)/.exec(lockText);
  if (!m) throw new Error("pnpm-lock.yaml has no entry for @playwright/test");
  return m[1];
}
export const imageTag = (v) => `mcr.microsoft.com/playwright:v${v}-noble`;
export function dockerArgs({ repo, out, ref, uid, gid, tag, mode, env }) {
  const e = { TOKI_PARITY_CONTAINER: "1", PARITY_MODE: mode, HOME: "/tmp/home", ...env };
  return ["run", "--rm", "--init", "--ipc=host", "--platform", "linux/amd64", "--user", `${uid}:${gid}`,
    "-v", `${repo}:/repo:ro`, "-v", `${out}:/out`, "-v", `${ref}:/ref`,
    "-v", "toki-parity-pnpm-store:/pnpm-store",
    ...Object.entries(e).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
    tag, "bash", "/repo/tools/ui-parity/in-container.sh"];
}
// CLI: only when run directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const [mode = "test", ...rest] = process.argv.slice(2);
  const docker = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8" });
  if (docker.status !== 0) { console.error("parity: Docker is not available; the check runs only in the Playwright container."); process.exit(1); }
  const version = playwrightVersion(readFileSync(`${repo}/pnpm-lock.yaml`, "utf8"));
  const out = `${repo}/e2e/assets/parity`, ref = `${repo}/e2e/parity/reference`;
  mkdirSync(out, { recursive: true }); mkdirSync(ref, { recursive: true });
  const env = { PARITY_ARGS: rest.join(" ") };
  const r = spawnSync("docker", dockerArgs({ repo, out, ref, uid: process.getuid(), gid: process.getgid(), tag: imageTag(version), mode, env }), { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
```
- [ ] **Step 5: Write `in-container.sh`** (guard: refuses to run when `TOKI_PARITY_CONTAINER` is not `1`; the version check of R8 compares `npx playwright --version` inside with the lockfile's version and exits 1 on a difference):
```bash
#!/usr/bin/env bash
set -euo pipefail
[ "${TOKI_PARITY_CONTAINER:-}" = "1" ] || { echo "parity: run through pnpm test:e2e:parity"; exit 1; }
mkdir -p /work "$HOME" && tar -C /repo --exclude=node_modules --exclude=.git --exclude=e2e/assets -cf - . | tar -C /work -xf -
cd /work
# The image has Node 26 and no corepack; the repository asks for Node 22 (devEngines, onFail error).
# Decided by Thanh Truong on 2026-11-24: run the image's Node and relax the check in this copy only.
node -e "const fs=require('fs'),p=JSON.parse(fs.readFileSync('package.json','utf8'));p.devEngines.runtime.onFail='warn';fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
npm install --silent --prefix /pnpm-store/tool pnpm@12.21.0
export PATH="/pnpm-store/tool/node_modules/.bin:$PATH"
pnpm install --frozen-lockfile --store-dir /pnpm-store/store
want=$(node -e "console.log(/'@playwright\/test':\s+specifier: \S+\s+version: ([0-9.]+)/.exec(require('fs').readFileSync('pnpm-lock.yaml','utf8'))[1])")
have=$(pnpm exec playwright --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
[ "$want" = "$have" ] || { echo "parity: image has Playwright $have, lockfile has $want"; exit 1; }
if [ "${PARITY_MODE}" = "reference" ]; then export PARITY_REFERENCE=1 PARITY_REFERENCE_DIR=/ref; fi
PARITY_OUT=/out pnpm exec playwright test -c playwright.parity.config.ts ${PARITY_ARGS:-}
```
Add scripts to `package.json`: `"test:e2e:parity": "node tools/ui-parity/container.mjs test"`; and append `tools/ui-parity/container.test.mjs` to the `test` script's `node --test` list.
- [ ] **Step 6: Run the tests.** `node --test tools/ui-parity/container.test.mjs` Expected: PASS. Commit: `git add tools/ui-parity package.json && git commit -m "test(e2e): run the parity check in the playwright container (TOKI-109)"`.

---

### Task 2: Parity config, guard and scaffolding
**Files:** Create `playwright.parity.config.ts`, `e2e/support/guard.ts`, `e2e/support/guard.test.ts`, `e2e/vitest.config.ts`; Modify `playwright.config.ts`, `vitest.config.ts`, `tsconfig.json`, `.prettierignore`, `package.json`, `pnpm-lock.yaml`.

**Interfaces:** Produces `assertInContainer(env: Record<string, string | undefined>): void` (throws `Error("parity: run through pnpm test:e2e:parity (the check compares only inside the Playwright container)")`).

**Acceptance Criteria:**
- [ ] A run outside the container fails with that message and compares nothing (R10).
- [ ] `pnpm test:e2e` does not run `e2e/parity/**` (R15).

- [ ] **Step 1: Failing test** `e2e/support/guard.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { assertInContainer } from "./guard";
describe("assertInContainer", () => {
  it("throws outside the container", () => expect(() => assertInContainer({})).toThrow(/Playwright container/));
  it("passes inside", () => expect(() => assertInContainer({ TOKI_PARITY_CONTAINER: "1" })).not.toThrow());
});
```
- [ ] **Step 2: Create `e2e/vitest.config.ts`** (`import { defineConfig } from "vitest/config"; export default defineConfig({ test: { name: "e2e", include: ["support/**/*.test.ts"] } });`), add `"e2e"` to `projects` in `vitest.config.ts`. Run `pnpm exec vitest run --project e2e`. Expected: FAIL (`./guard` missing).
- [ ] **Step 3: Implement** `guard.ts` (the function above) and run again. Expected: PASS.
- [ ] **Step 4: Add the devDependencies** with exact versions: `pnpm add -D -w pixelmatch@<latest 5.x or 7.x exact> pngjs@<latest exact> @types/pngjs@<latest exact>` (check `pnpm view pixelmatch version`; use the exact number, no caret). Expected: `pnpm-lock.yaml` changes only for these.
- [ ] **Step 5: Create `playwright.parity.config.ts`:**
```ts
import { defineConfig, devices } from "@playwright/test";
import { assertInContainer } from "./e2e/support/guard";

assertInContainer(process.env);
const WEB_PORT = 5193;
export default defineConfig({
  testDir: "./e2e/parity",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["./e2e/support/parity-reporter.ts"]],
  outputDir: `${process.env.PARITY_OUT ?? "e2e/assets/parity"}/results`,
  use: { baseURL: `http://127.0.0.1:${WEB_PORT}`, trace: "off", screenshot: "off", video: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm --filter @toki/web exec vite --host 127.0.0.1 --port ${WEB_PORT}`,
    url: `http://127.0.0.1:${WEB_PORT}`,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 90_000,
  },
});
```
- [ ] **Step 6: Edit the other files:** in `playwright.config.ts` extend `testIgnore` with `"parity/**"` and `"prototype/**"`; in `tsconfig.json` add `"playwright.parity.config.ts"` to `include`; in `.prettierignore` add `e2e/prototype/index.html`.
- [ ] **Step 7: Negative check.** Run `pnpm exec playwright test -c playwright.parity.config.ts` on the host. Expected: exits non-zero with the guard message. Run `pnpm exec playwright test --list` Expected: no file under `e2e/parity`.
- [ ] **Step 8: Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.** Commit: `test(e2e): add the parity config and its guard (TOKI-109)`.

---

### Task 3: Prototype copy, hash and `openPrototype`
**Files:** Create `e2e/prototype/index.html`, `e2e/parity/prototype.sha256`, `e2e/support/prototype.ts`, `e2e/support/prototype.test.ts`, `e2e/parity/prototype.spec.ts`.

**Interfaces:**
- Produces: `sha256(buf: Buffer): string`; `checkHash(file: Buffer, recorded: string): string | null` (the R17 message or `null`); `type Look = "calm" | "focus"`, `type Accent`, `type Density = "own" | "comfortable" | "compact"`; `WIDTHS: Record<"wide" | "mid" | "narrow", { width: number; height: number }>`; `type Width = "wide" | "mid" | "narrow"`; `openPrototype(page: Page, state: { look: Look; accent?: Accent; density?: Density; width?: Width; hash?: string }): Promise<void>` (default width `wide`); `PROTOTYPE_FILE` (the constant, R1).

**Acceptance Criteria:**
- [ ] The copy has the recorded hash and no request leaves the machine (R1, R17); the accent values match (R2).

- [ ] **Step 1: Copy and record.** `mkdir -p e2e/prototype && cp ../toki-blueprint/docs/blueprint/prototype/index.html e2e/prototype/index.html && shasum -a 256 e2e/prototype/index.html | cut -d' ' -f1 > e2e/parity/prototype.sha256`. Expected: the file holds `8afc5b13...bb35`. If it differs, stop.
- [ ] **Step 2: Failing test** `prototype.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { checkHash, sha256 } from "./prototype";
describe("checkHash", () => {
  const file = Buffer.from("abc");
  it("accepts the recorded hash", () => expect(checkHash(file, sha256(file))).toBeNull());
  it("names the change", () =>
    expect(checkHash(Buffer.from("abd"), sha256(file))).toBe(
      "the prototype changed: make the references again and record the new hash"));
});
```
- [ ] **Step 3: Run `pnpm exec vitest run --project e2e`.** Expected: FAIL. Implement `sha256` (`createHash("sha256").update(buf).digest("hex")`) and `checkHash` in `prototype.ts`; run again. Expected: PASS.
- [ ] **Step 4: Failing Playwright spec** `prototype.spec.ts` (written first, runs in the container):
```ts
import { expect, test } from "@playwright/test";
import { openPrototype } from "../support/prototype";

test("no request leaves the machine, seven faces load", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await openPrototype(page, { look: "calm" });
  await page.evaluate(() => document.fonts.ready);
  expect(urls.filter((u) => !/^(file|data|blob):/.test(u))).toEqual([]);
  const faces = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").length);
  expect(faces).toBe(7);
});
const accents = [
  ["calm", "teal", "#0F766E"], ["focus", "teal", "#5EEAD4"], ["calm", "indigo", "#4F46E5"],
  ["focus", "indigo", "#A5B4FC"], ["calm", "clay", "#B4532A"], ["focus", "clay", "#FDBA8C"],
  ["calm", "violet", "#7C3AED"], ["focus", "violet", "#C4B5FD"],
] as const;
for (const [look, accent, value] of accents) {
  test(`--accent is ${value} in ${look} with ${accent}`, async ({ page }) => {
    await openPrototype(page, { look, accent });
    const v = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    expect(v.toUpperCase()).toBe(value);
  });
}
```
- [ ] **Step 5: Implement `openPrototype`.** (a) Read `PROTOTYPE_FILE = resolve("e2e/prototype/index.html")` and `e2e/parity/prototype.sha256`, call `checkHash`, throw its message on a change. (b) `page.context().route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())`. (c) `page.emulateMedia({ colorScheme: look === "focus" ? "dark" : "light", reducedMotion: "reduce" })`. (d) `page.clock.install({ time: new Date("2026-11-10T10:42:00+07:00") })` then `page.clock.pauseAt` one second later, as `e2e/app-shell.spec.ts:619`. (e) `page.goto("file://" + PROTOTYPE_FILE + (hash ? "#" + hash : ""))`. (f) Inject the fonts: read `apps/web/assets/fonts/fonts.css`, replace `url("./` by `url("file://<absolute fonts dir>/`, `page.addStyleTag({ content })`. (g) Set the state: `page.evaluate(({look, accent, density}) => { S.look = look; S.prefs.accent = accent ?? "teal"; S.prefs.density = density && density !== "own" ? density : null; applyLook(); }, state)` (the prototype's `S` and `applyLook` are global, lines 1118 and 1137). (h) Await `document.fonts.ready`.
- [ ] **Step 6: Run in the container.** `pnpm test:e2e:parity` Expected: the nine tests PASS. If the first run fails on the viewport size, set it in `openPrototype` (step 9) first.
- [ ] **Step 7: Check the negative case.** Change one byte of `e2e/prototype/index.html` in a scratch copy of the repo, run: Expected: fails with the R17 message. Restore.
- [ ] **Step 8: Export `WIDTHS`** = `{ wide: {1280, 800}, mid: {900, 800}, narrow: {390, 844} }` and make `openPrototype` accept `width` and call `page.setViewportSize`; context options (`timezoneId: "Asia/Ho_Chi_Minh"`, `locale: "en-US"`, `deviceScaleFactor: 1`) are set in `playwright.parity.config.ts` `use`.
- [ ] **Step 9: Commit:** `test(e2e): open the prototype copy with a recorded hash (TOKI-109)`.

---

### Task 4: Token check and the report rows
**Files:** Create `e2e/support/tokens.ts`, `tokens.test.ts`, `e2e/support/parity-reporter.ts`, `parity-reporter.test.ts`, `e2e/parity/known-differences.ts`, `e2e/parity/tokens.spec.ts`.

**Interfaces:**
- Produces: `parseTokenNames(css: string): string[]`; `kindOf(name: string): "colour" | "length" | "percent" | "shadow"`; `diffTokens(proto: Record<string,string>, app: Record<string,string>): { property: string; prototype: string; app: string }[]`; `type KnownDifference = { id: string; reason: string; ticket: string }`; `applyKnown(rows: Row[], known: KnownDifference[]): Row[]`; `type Row = { kind: "token" | "screen"; name: string; status: "match" | "differs" | "known" | "stale-known" | "not-run"; detail: Record<string, unknown>; images?: string[] }`; `renderReport(rows: Row[]): { md: string; json: string }`.

**Acceptance Criteria:**
- [ ] One row per differing property and combination, values compared as computed (R3); names read from `tokens.css` (R4); known and stale entries are separate in the report (R4, R11).

- [ ] **Step 1: Failing tests** `tokens.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diffTokens, kindOf, parseTokenNames } from "./tokens";
describe("parseTokenNames", () => {
  const css = readFileSync("packages/tokens/src/tokens.css", "utf8");
  it("reads the 32 names of the first :root block, in order", () => {
    const names = parseTokenNames(css);
    expect(names).toHaveLength(32);
    expect(names[0]).toBe("--bg");
    expect(names).toContain("--pop");
  });
  it("ignores names in later blocks", () => expect(new Set(parseTokenNames(css)).size).toBe(32));
});
describe("diffTokens", () => {
  it("returns one row per difference", () =>
    expect(diffTokens({ "--bg": "rgb(1, 2, 3)", "--ink": "x" }, { "--bg": "rgb(1, 2, 4)", "--ink": "x" }))
      .toEqual([{ property: "--bg", prototype: "rgb(1, 2, 3)", app: "rgb(1, 2, 4)" }]));
  it("reports a property that the prototype lacks", () =>
    expect(diffTokens({}, { "--bg": "a" })[0].prototype).toBe("the prototype has no value"));
});
describe("kindOf", () => {
  it("classes the 32 names", () => {
    expect(kindOf("--shadow")).toBe("shadow");
    expect(kindOf("--av-s")).toBe("percent");
    expect(kindOf("--gap")).toBe("length");
    expect(kindOf("--accent")).toBe("colour");
  });
});
```
- [ ] **Step 2: Run, see it fail; implement.** `parseTokenNames`: take the text from the first `{` after the selector `:root, :root[data-eff="calm"]` to the next `}` and collect `/(--[a-z0-9-]+)\s*:/g` in order. `kindOf`: `--shadow` and `--pop` are shadow; `--av`, `--gap`, `--row`, `--radius`, `--radius-sm` are length; `--av-s`, `--av-l`, `--av-ts`, `--av-tl` are percent; everything else is colour. `diffTokens` iterates the union of the names of `app`, writes `"the prototype has no value"` when missing, compares strings. Run. Expected: PASS.
- [ ] **Step 3: Failing tests** `parity-reporter.test.ts` for `applyKnown` and `renderReport`: (a) a `differs` row whose name equals a known `id` becomes `known` and carries `ticket`; (b) a known id with no differing row becomes a `stale-known` row with the text "no longer a difference: remove the entry"; (c) `renderReport` starts with a line `checked N · match N · differs N · known N · no longer a difference N · not run N` and lists each `differs` row with its name and values; (d) the same rows give the same text twice. Run, see it fail; implement `applyKnown` and `renderReport` in `parity-reporter.ts` (pure) and the reporter class `export default class ParityReporter implements Reporter` collecting `result.attachments` named `parity-row` in `onTestEnd` and writing `report.md` and `report.json` to `process.env.PARITY_OUT ?? "e2e/assets/parity"` in `onEnd`. Run. Expected: PASS.
- [ ] **Step 4: Create `known-differences.ts`** exporting `export const knownDifferences: KnownDifference[] = [];` (T7 adds entries).
- [ ] **Step 5: Write `tokens.spec.ts`:** for each look in `["calm","focus"]`, accent in the four, density in `["own","comfortable","compact"]` (24 tests): open the prototype with `openPrototype(page, {look, accent, density})`, read the 32 values through `readTokens(page, names)`, open `/preview.html?look=&accent=&density=` in a second page, read the same, `diffTokens`, attach one `parity-row` per property (`kind: "token"`, `name: "<property> <look>/<accent>/<density>"`, status `differs`) and one `match` row for the combination. The test never fails on a difference.
- [ ] **Step 6: Implement `readTokens(page, names)`** in `tokens.ts` with `page.evaluate`: create a probe `div` inside a `div` 1000 px wide; for each name by `kindOf`: colour: `probe.style.color = ""; probe.style.color = "var(--x)"; getComputedStyle(probe).color`; length: `probe.style.width = "var(--x)"` then `getComputedStyle(probe).width`; percent: the same on the 1000 px parent (so `45%` gives `450px`); shadow: `probe.style.boxShadow = "var(--x)"` then `getComputedStyle(probe).boxShadow`. The probe is attached to `document.documentElement` so that custom properties resolve.
- [ ] **Step 7: Run `pnpm test:e2e:parity`.** Expected: the 24 combinations run; read `e2e/assets/parity/report.md`. If a combination reports many differences, first suspect the normaliser or the way the state is set, not the app.
- [ ] **Step 8: Negative check.** Change `--accent` in `packages/tokens/src/tokens.ts` calm indigo by one digit, regenerate (`pnpm --filter @toki/tokens generate`), run: Expected: rows for `--accent` in the indigo combinations of Calm, job green. Revert.
- [ ] **Step 9: Commit:** `test(e2e): compare the design tokens with the prototype (TOKI-109)`.

---

### Task 5: Screen check core
**Files:** Create `e2e/parity/limits.ts`, `e2e/support/parity.ts`, `e2e/support/parity.test.ts`, `e2e/parity/controls.spec.ts`, `e2e/parity/screens.spec.ts`.

**Interfaces:**
- Consumes: `WIDTHS`, `openPrototype`, `Row`, `renderReport` (T3, T4).
- Produces: `LIMITS = { ratio: 0.02, threshold: 0.1, includeAA: false }`; `compareImages(a: Buffer, b: Buffer): { sameSize: boolean; sizes: [string, string]; ratio: number; box: [number, number, number, number] | null; diff: Buffer | null }`; `type ScreenDecl = { id: string; section: string; prototypeSteps?: Step[]; appRoute: string; appSteps?: Step[]; mask?: string[]; looks?: Look[]; widths?: Width[]; seed?: boolean; setup?: (page: Page) => Promise<void> }`; `type Step = { click: string } | { press: string } | { fill: [string, string] }`; `expandScreens(decls: ScreenDecl[]): { decl: ScreenDecl; look: Look; width: Width; run: boolean }[]`; `runSteps(page: Page, id: string, steps: Step[]): Promise<void>` (throws `Error("screen <id>: step <n> selector <s> not found")`); `captureElement(page: Page, selector: string, mask: string[]): Promise<Buffer>`.

**Acceptance Criteria:**
- [ ] A difference is a recorded result with a box and a ratio; "sizes differ" is a result; a seeded declaration is counted "not run"; a step that cannot be reached fails with three names (R5, R6, R7, R9, R11, R12, R13).

- [ ] **Step 1: Failing tests** `parity.test.ts` with images made by `pngjs` (`new PNG({ width, height })`, fill a colour, `PNG.sync.write`):
```ts
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { compareImages, expandScreens, type ScreenDecl } from "./parity";

// A solid w x h image; `dots` paints single pixels.
function png(w: number, h: number, rgb: [number, number, number], dots: [number, number][] = []): Buffer {
  const img = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) img.data.set([...rgb, 255], i * 4);
  for (const [x, y] of dots) img.data.set([255, 255, 255, 255], (y * w + x) * 4);
  return PNG.sync.write(img);
}
const decl = (over: Partial<ScreenDecl> = {}): ScreenDecl => ({ id: "s", section: "home", appRoute: "/", ...over });

describe("compareImages", () => {
  it("identical images: ratio 0, no box", () => {
    const r = compareImages(png(10, 10, [9, 9, 9]), png(10, 10, [9, 9, 9]));
    expect(r.ratio).toBe(0);
    expect(r.box).toBeNull();
  });
  it("one different pixel of 100: ratio 0.01, box 1x1", () => {
    const r = compareImages(png(10, 10, [9, 9, 9]), png(10, 10, [9, 9, 9], [[3, 4]]));
    expect(r.ratio).toBeCloseTo(0.01);
    expect(r.box).toEqual([3, 4, 3, 4]);
  });
  it("sizes differ is a result", () => {
    const r = compareImages(png(10, 10, [0, 0, 0]), png(12, 10, [0, 0, 0]));
    expect(r.sameSize).toBe(false);
    expect(r.sizes).toEqual(["10x10", "12x10"]);
  });
});
describe("expandScreens", () => {
  it("gives one entry per look and width by default (2 x 3)", () => {
    const e = expandScreens([decl()]);
    expect(e).toHaveLength(6);
    expect(e.every((x) => x.run)).toBe(true);
  });
  it("honours the looks and widths of a declaration", () =>
    expect(expandScreens([decl({ looks: ["calm"], widths: ["wide"] })])).toHaveLength(1));
  it("does not run a seeded declaration", () =>
    expect(expandScreens([decl({ seed: true })]).every((x) => !x.run)).toBe(true));
});
```
- [ ] **Step 2: Run, see it fail; implement** `compareImages` with `PNG.sync.read`, `pixelmatch(a.data, b.data, diff.data, w, h, { threshold: LIMITS.threshold, includeAA: LIMITS.includeAA })`, ratio = count / (w * h), box = min/max x,y of pixels where `diff` is not the unchanged colour (scan `diff.data` for the diff colour `[255,0,0]`), `diff: PNG.sync.write(out)`; `expandScreens`. Run. Expected: PASS.
- [ ] **Step 3: Failing control spec** `controls.spec.ts`:
```ts
test("the prototype twice is identical (R7)", async ({ page }) => {
  await openPrototype(page, { look: "calm", width: "wide", hash: "admin" });
  const a = await captureElement(page, "#app", ["[data-timer]"]);
  await openPrototype(page, { look: "calm", width: "wide", hash: "admin" });
  const b = await captureElement(page, "#app", ["[data-timer]"]);
  expect(compareImages(a, b).ratio).toBe(0);
});
test("an altered copy gives a report row (R9, R11)", async ({ page }, info) => {
  await openPrototype(page, { look: "calm", width: "wide", hash: "admin" });
  const a = await captureElement(page, "#app", []);
  await page.evaluate(() => document.documentElement.style.setProperty("--surface", "#ff0000"));
  const b = await captureElement(page, "#app", []);
  const r = compareImages(a, b);
  expect(r.ratio).toBeGreaterThan(LIMITS.ratio);
  await attachRow(info, { kind: "screen", name: "control altered/calm/wide", status: "differs", detail: { ratio: r.ratio, limit: LIMITS.ratio, box: r.box }, images: [] });
});
test("a wrong selector fails with the screen, the step and the selector (R13)", async ({ page }) => {
  await openPrototype(page, { look: "calm", width: "wide", hash: "admin" });
  await expect(runSteps(page, "demo", [{ click: "#nope" }])).rejects.toThrow(/screen demo: step 1 selector #nope not found/);
});
```
Run in the container. Expected: FAIL (helpers missing).
- [ ] **Step 4: Implement `captureElement`:** `page.locator(selector).screenshot({ animations: "disabled", caret: "hide", scale: "css", mask: mask.map((m) => page.locator(m)) })`; before it `await page.evaluate(() => document.fonts.ready)` and scroll every `.scroll` pane to 0. `runSteps`: for each step find the selector with `page.locator(sel).first()`, `count() === 0` throws the message; `click`, `press` (`page.keyboard.press`), `fill`. Run. Expected: PASS.
- [ ] **Step 5: Add `attachRow(info, row)`** (`info.attach("parity-row", { body: JSON.stringify(row), contentType: "application/json" })`) to `parity.ts`, used by the specs; attach the three images (reference, app, diff) to the Playwright result and to `row.images` (paths under `outputDir`).
- [ ] **Step 6: Write `screens.spec.ts`:** `const decls = (await Promise.all(readdirSync("e2e/parity/screens").filter((f) => f.endsWith(".ts")).map((f) => import(`./screens/${f}`)))).flatMap((m) => Object.values(m).flat())` (ESM, top-level await; the repository is `"type": "module"`); for each `expandScreens` entry: if `!run` attach a `not-run` row and return; else open the prototype in the declared state, run `prototypeSteps`, capture `#app`, open the app (`decl.setup(page)` stubs first, `emulateMedia`, clock, `goto(appRoute)`, set accent/density through `page.evaluate` on `<html>` as `apps/web/src/preview/controls.ts:46-52` does), run `appSteps`, capture `.app`; read the reference image (a missing one throws "no reference for <name>: run pnpm ui:reference"; in CI that fails the run, R10), `compareImages`, attach the row (`match` when `ratio <= LIMITS.ratio`, else `differs`, `sizes differ` as a `differs` row) and the three images. Applied through `applyKnown` in the reporter, not here.
- [ ] **Step 7: Negative check.** Delete one reference image (after T7), run: Expected: the run fails naming the missing file. Restore.
- [ ] **Step 8: Commit:** `test(e2e): compare declared screens with the prototype (TOKI-109)`.

---

### Task 6: Reference command
**Files:** Create `e2e/parity/reference.spec.ts`, `tools/ui-parity/reference.test.mjs`; Modify `package.json`, `tools/ui-parity/container.mjs`.

**Acceptance Criteria:**
- [ ] `pnpm ui:reference <id>` and `--all` write images from the prototype; an existing image is kept without `--update` and the command exits non-zero; each written file is listed (R8).

- [ ] **Step 1: Failing test** `reference.test.mjs`: `parseReferenceArgs(["--all", "--update"])` returns `{ all: true, ids: [], update: true }`; `["admin"]` returns `{ all: false, ids: ["admin"], update: false }`; `[]` throws "give a screen id or --all". Run: FAIL.
- [ ] **Step 2: Implement `parseReferenceArgs`** in `container.mjs`, export it; the CLI for mode `reference` turns the arguments into env `PARITY_ARGS="--grep @reference"`, `PARITY_REFERENCE_IDS=<ids|all>`, `PARITY_UPDATE=1` when `--update`. Add the script `"ui:reference": "node tools/ui-parity/container.mjs reference"` and the new test file to the `test` script. Run. Expected: PASS.
- [ ] **Step 3: Write `reference.spec.ts`** (`test.skip(process.env.PARITY_REFERENCE !== "1")`; tag `@reference`): for each `expandScreens` entry whose id is in `PARITY_REFERENCE_IDS` (or all) and `run`: open the prototype, run `prototypeSteps`, `captureElement(page, "#app", ...)`; target `${PARITY_REFERENCE_DIR}/<id>-<look>-<width>-chromium-linux.png`; if the file exists and `PARITY_UPDATE !== "1"`: `console.log("kept " + file)` and `expect.soft(false, "exists; use --update").toBe(true)`; else write it and `console.log("wrote " + file)`.
- [ ] **Step 4: Run in the container** for the sample after T7: `pnpm ui:reference admin` twice. Expected: first run lists six `wrote`; second run exits non-zero with `kept`; `pnpm ui:reference admin --update` lists six `wrote`. Run the first command twice with `--update` and compare file hashes: identical (R7).
- [ ] **Step 5: Commit:** `test(e2e): add the command that makes the reference images (TOKI-109)`.

---

### Task 7: `/admin` smoke screen
**Files:** Create `e2e/parity/screens/admin.ts` and six PNGs; Modify `e2e/parity/known-differences.ts`.

**Acceptance Criteria:**
- [ ] The app side of the pipeline runs end to end (stubs, clock, appearance, capture, report); the difference is a known difference with a reason (spec concern 9, deviation 3).

- [ ] **Step 1: Write the declaration** `screens/admin.ts`: `export const admin: ScreenDecl = { id: "admin", section: "admin", appRoute: "/admin", setup: async (page) => { await stubBootstrap(page); await stubAdminApi(page); }, mask: [] }`. `stubAdminApi` is a local function in the same file that answers `GET /api/v1/auth/session` (user Lan, role admin), `GET /api/v1/members` (three rows: Lan admin, Minh, Ann admin; same shape as `stubApi` in `e2e/admin.spec.ts`) and `GET /api/v1/channels` (one channel, `general`); copy the shapes of `person(...)` and the three answers from `e2e/admin.spec.ts` lines 60 to 118 into this file with all dates fixed at `2026-01-03T10:00:00Z`. Do not edit `admin.spec.ts`.
- [ ] **Step 2: Make the references:** `pnpm ui:reference admin`. Expected: six files in `e2e/parity/reference/`.
- [ ] **Step 3: Run `pnpm test:e2e:parity`.** Expected: six `differs` rows for `admin` (large ratio; the screens have different content), job green.
- [ ] **Step 4: Record the differences.** In `known-differences.ts` add six entries, ids `admin/calm/wide` to `admin/focus/narrow` (the row names of T5), `reason: "The app's Admin shows Members and Channels; the prototype's admin shows Analytics and Automations, which the Admin page spec leaves to phase 5 (docs/specs/2026-11-17-admin-page-design.md:27)"`, `ticket: "accepted"` (decided by Thanh Truong on 2026-11-24: no new ticket; when phase 5 builds the tabs the report lists these rows as "no longer a difference" and the entries are removed). Run again. Expected: the six rows are under "known", none under "no longer a difference".
- [ ] **Step 5: Commit:** `test(e2e): declare the admin screen as the smoke screen (TOKI-109)`.

---

### Task 8: CI, guide and documents
**Files:** Create `e2e/parity/README.md`; Modify `.github/workflows/ci.yml`, `.github/scripts/changed.sh`, `CLAUDE.md`.

**Acceptance Criteria:**
- [ ] The e2e job runs the parity check and appends the report to the job summary whether or not there are differences, with the existing `changed` guard (R15); the guide exists (R16); `CLAUDE.md` lists the new commands.

- [ ] **Step 1: Add two steps** to the `e2e` job of `.github/workflows/ci.yml`, after `pnpm test:e2e:sign-in` and before the artifact upload:
```yaml
      - if: steps.changed.outputs.run == 'true'
        run: pnpm test:e2e:parity
      - if: ${{ !cancelled() && steps.changed.outputs.run == 'true' }}
        run: cat e2e/assets/parity/report.md >> "$GITHUB_STEP_SUMMARY"
```
The upload step already uploads `e2e/assets/` and runs with `!cancelled()`.
- [ ] **Step 2: Extend `changed.sh`:** in the `e2e)` line add `tools/ui-parity/*` to `own`. Run `bash .github/scripts/changed.sh e2e` with a `BASE_SHA` and a changed file under `tools/ui-parity/` (see the existing test of the script if there is one; if `changed.test.sh` exists add a case).
- [ ] **Step 3: Update `CLAUDE.md`, section Commands:** add `pnpm test:e2e:parity` (runs the UI parity check in the Playwright container; needs Docker; writes `e2e/assets/parity/report.md`) and `pnpm ui:reference <screen-id> | --all [--update]` (makes the reference images from the prototype).
- [ ] **Step 4: Write `e2e/parity/README.md`** (one page): the declaration (fields of `ScreenDecl`), `pnpm ui:reference`, what to write in the pull request (which images, why), how to read `report.md` (rows, ratio, box, three images), how to record a known difference, what fails the run (and what does not).
- [ ] **Step 5: Follow the README once** to add a throwaway declaration, then remove it (R16 check).
- [ ] **Step 6: Full verification:** `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm test:e2e && pnpm test:e2e:parity`. Expected: all exit 0 (`pnpm test:e2e:parity` needs Docker).
- [ ] **Step 7: Deliberate difference in CI, on a throwaway pull request.** Do not put the deliberate difference in the real pull request. From a scratch branch cut from this branch (`test/toki-109-ci-difference`, never merged), change one token value in `packages/tokens/src/tokens.ts`, regenerate, push, open a draft pull request, and confirm that the end-to-end job is green, the job summary shows the row of that property and the artifact holds the images. Close that pull request and leave its branch for the user to delete (deleting a branch needs their yes). Record the link of that run and the link of the run of the real pull request in the real pull request description (R15 check). Also record the time the parity step added to the job; if it is more than 5 minutes, say so in the description and propose a follow-up ticket for caching (the pnpm store, the image), as decided by Thanh Truong on 2026-11-24.
- [ ] **Step 8: Commit:** `ci: run the ui parity check in the e2e job (TOKI-109)`.

---

## Risks and the riskiest step
1. **Riskiest: Task 1 and Task 3 together** (the image on `linux/amd64`, Node 26, `pnpm install` in a copy, fonts and `file://` loading). Step 1 of Task 1 probes the Node version first; Task 3 step 6 is the first real run in the container. If the install or the font loading fails here, stop and report before building more.
2. **Pixel stability.** The first run of the determinism test (Task 5 step 3) is the proof; masks and `animations: "disabled"` are the fixes to try, in that order.
3. **Normaliser.** A false token difference is more likely a probe bug than an app bug (Task 4 step 7).
4. **Time in CI.** The first run pulls the image (about 1.5 GB) and installs dependencies; the volume `toki-parity-pnpm-store` speeds up local runs only. Measure in the pull request; if the job grows by more than a few minutes, report it.
5. **Dependency versions.** `pixelmatch` and `pngjs` are pinned with exact versions (Task 2 step 4).
6. **Node 26 in the container** (deviation 6). A dependency or Vite behaving differently on Node 26 shows at Task 3 step 6, the first run. If `pnpm install --frozen-lockfile` fails because the lockfile records `devEngines`, or a package refuses Node 26, stop and ask; do not change the repository's `package.json`.
7. **amd64 emulation on Apple Silicon** (deviation 7). Chromium under emulation can be slow or crash. Task 3 step 6 shows it; if it fails there, stop and ask.
