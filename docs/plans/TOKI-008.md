# TOKI-008 Test harness

Spec: docs/specs/2026-11-12-test-harness-design.md
Intent: docs/intents/test-harness.md
Tier: M

## Design
The design is the spec (Layout, Design, Errors). This section records only what the code on `main` changes about it.

### What main already has
- `apps/server/vitest.config.ts` loads the root `.env` and has no projects. Tests sit in `apps/server/src/test/` and `apps/server/src/db/*.test.ts`; `src/test/throwaway-db.ts` makes a throwaway database per test file (TOKI-005).
- Vitest 5.1.0 is pinned, so `test.projects` is the right key (spec concern 9 is settled).
- Root `package.json` has two `test` keys; the last wins (`pnpm -r --if-present run test`). This work keeps one.
- `apps/web` proxies `/api/v1` and `/healthz`, not `/api`. R23 therefore requests `/healthz` and `/api/v1/...` through the web port; both are proxied to the server port.
- CI (`ci.yml`) already has the `tests` job with Postgres 17 and `TEST_DATABASE_URL=.../toki_test`; it passes the R5 guard as written.
- `main.ts` needs `DATABASE_URL` but opens no connection at start, so the end-to-end run gives the server the test URL.

### Files
- `vitest.config.ts` (root): `test.projects`: `apps/*`, `packages/*`, plus `apps/server/vitest.db.config.ts`.
- `apps/server/vitest.config.ts`: database-free project; excludes `*.db.test.ts`.
- `apps/server/vitest.db.config.ts`: `*.db.test.ts` only, `fileParallelism: false`, `globalSetup`, `setupFiles`, `test.env.DATABASE_URL` set from `TEST_DATABASE_URL` after the guard.
- `apps/server/vitest.all.config.ts`: `projects` of the two above, for the `test` script of `apps/server`. `test:unit` uses `vitest.config.ts` only.
- `apps/server/test/guard.ts` + `guard.test.ts`: pure function; host, name, `_test`, NODE_ENV.
- `apps/server/test/global-setup-db.ts`: guard, maintenance connection, `DROP DATABASE ... WITH (FORCE)`, `CREATE DATABASE`, `runMigrations`. Prints host and database name only.
- `apps/server/test/setup-file-db.ts`: `current_database()` check, empty all tables before each file.
- `apps/server/test/workspaces.db.test.ts` + a second file for R6 + a test for R18.
- Existing DB-using TOKI-005 tests renamed to `*.db.test.ts`. They keep their own throwaway databases (spec, Design).
- `packages/shared/src/clock/{clock,test-clock,clock.test}.ts`, exported from the shared index.
- `playwright.config.ts` (root), `e2e/sample.spec.ts`, `e2e/proxy.spec.ts`; web server + server started by `webServer`; Chromium only.
- Root `package.json`: `test` (`vitest run`), `test:e2e` (`playwright test`); devDependencies `@playwright/test`, versions pinned exactly.
- `.github/workflows/ci.yml`: new `e2e` job (install, `pnpm exec playwright install --with-deps chromium`, `pnpm test:e2e`).
- `scripts/check-clock-use.sh` for R19 (grep run by hand in the PR, not wired into CI).

### Risks
- NODE_ENV: Vitest sets it to `test` in its own process, so the guard reads the shell and the root `.env` value the way `scripts/guard.sh` does, not `process.env` alone.
- Glob projects over a package with no config: confirm Vitest accepts a bare directory; if not, add a minimal `vitest.config.ts` per package.
- `e2e/` is outside any package: check ESLint and tsconfig cover it.

## AC -> step -> test
| R | Step | Test |
| :-- | :-- | :-- |
| R8, R9 | clock + test clock | `clock.test.ts` |
| R5 | `guard.ts` | `guard.test.ts` (127.0.0.1 vs localhost, `?sslmode=disable`, no `_test`, non-loopback, production, valid) |
| R3, R17, R2 | global setup, workspaces test | `workspaces.db.test.ts`; by hand: no test DB, leftover table |
| R6, R18 | setup file | two sample files; test reads `current_database()` through the app client |
| R20, R15, R7, R12 | project configs, renames, root config | by hand: Postgres stopped; new test file picked up |
| R1, R4, R16 | scripts | by hand: dev row counts before and after |
| R10, R11, R21 | Playwright config, sample | `sample.spec.ts`; changed text turns it red |
| R23 | proxy test | `proxy.spec.ts`; server stopped turns it red |
| R13, R14 | `ci.yml` | throwaway PRs, one fault each |
| R19 | clock use script | grep over `apps/server/src` and `packages/client-core/src` |
| R22 | none now | first seeded flow |

## Order
1. Clock and its test. 2. Guard and its test. 3. Projects, global setup, sample DB tests, renames. 4. Playwright and both tests. 5. CI job. 6. R19 script and by-hand checks. Each test is seen failing before its code.
