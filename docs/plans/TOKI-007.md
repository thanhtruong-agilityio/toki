# TOKI-007 CI on GitHub Actions

Spec: docs/specs/2026-11-12-ci-pipeline-design.md
Intent: docs/intents/ci-pipeline.md

## Design
Approved by Thanh, 2026-11-17. Technical design only; the requirements stay in the spec (R1 to R18).

### Files
```
.github/workflows/ci.yml          five independent jobs: lint, type check, tests, build, bundle size
package.json                      adds test, build, size
tools/bundle-size/check.mjs       measures the first-load JavaScript of apps/web/dist with gzip
tools/bundle-size/limit.json      {"bytes": 200000}
tools/bundle-size/check.test.mjs  node:test tests for the measuring function
```

### ci.yml
- Triggers `pull_request` and `push` to `main`; `permissions: contents: read`; no secret (R1, R11).
- `concurrency` group per pull request number (sha on push); `cancel-in-progress` only for pull requests (R18).
- Each job: checkout, `pnpm/action-setup` (version from `packageManager`), `actions/setup-node` with `node-version-file: .nvmrc` and `cache: pnpm`, `pnpm install --frozen-lockfile`, one root script (R10, R12, R16). No `needs`, no `continue-on-error`.
- Job names: `lint`, `type check`, `tests`, `build`, `bundle size` (R8).
- `tests` has a `postgres:17` service with a health check; `TEST_DATABASE_URL` is one URL in the workflow, throwaway password, database `toki_test` (R15).
- The file must not contain the words checked by R14 (no end-to-end step, no comment naming it).

### Root scripts
- `build`: `pnpm -r --if-present run build` (R6).
- `test`: `pnpm -r --if-present run test && node --test tools/bundle-size/check.test.mjs`. The second part keeps the tests of the size script running in CI; TOKI-008 must keep it when it replaces this script.
- `size`: `node tools/bundle-size/check.mjs`.

### check.mjs (R7)
`measure(distDir)` reads `index.html`, takes every `<script src>` and `<link rel="modulepreload">`, follows static `import ... from` and `export ... from` specifiers in each chunk (never `import()`), gzips each file once at level 9 and sums. The command: no `build` script in `apps/web` -> says so, exit 0; otherwise builds `@toki/web`, measures, prints size, limit and difference, exit 1 when size >= limit.

### Testing
Test first (`node:test`, fixtures in temp folders): below, equal to and above the limit; a dynamic chunk is not counted; a statically imported chunk is. Each root script run locally. On GitHub: a clean pull request (R13), plus two throwaway pull requests, lint error with a failing test (R16) and a stale lockfile (R17). Throwaway branches are not deleted without asking.

### Risks
- `packageManager` is `pnpm@12.21.0`; `pnpm/action-setup` must install it. The first run shows it.
