# TOKI-119 QA of the test harness - implementation plan

**Goal:** TOKI-008 gets a QA record at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-test-harness-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-119-test-harness-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `4a17e4b` (PR #137, 2026-11-18), decided in concern 1. Concern 3 decided: a temporary PostgreSQL where the spec says the development services, the Chromium that Playwright has cached, free ports where the spec allows them, the development services and database untouched.

## Design

Same shape as the earlier QA tickets, with every lesson built in from the start: each part of a sentence of a requirement is a printed number; a row names one requirement; every row that needs a mutation pairs it with a run that passes; a row prints `Blocked` and never a Pass when it cannot be shown; every claim of the notes has a line of evidence (detail lines, a `HISTORY` line, the commands run against `main`); a changed `Expected` is approved again; one `BASE` folder made in the current shell holds every temporary file (exported as `TMPDIR` and given to every process, so a Postgres cluster, a worktree and a cache all live under it; the optional `QA_CACHE` folder for GitHub answers is the one named exception); the last line shows no process, no cluster and no folder left and the repository unchanged.

- **Temporary PostgreSQL 14.24** made with `initdb` as in the QA of TOKI-005, with `log_statement = all` and a log prefix that shows the database, so R17 can be read from the server's own log. Two databases on it: `qa_dev`, the stand-in for the development database (migrated, with a marker row), and the test database `toki_qa_test`, which the harness itself drops and creates. The Docker services and the real development database are not touched.
- **One full `pnpm test` run** in the temporary worktree (with `TEST_DATABASE_URL` and `DATABASE_URL` given on the command line, `NODE_ENV=development`, no `.env`) is shared by the rows that read it: T1, T2, T4, T15 (reporting), T16. The rows that mutate a file restore it with `git checkout`; each is paired with the unmutated run.
- **End-to-end runs** (`pnpm test:e2e`) use the ports the Playwright config fixes (web 5173, server 3000): a row runs only when both are free and is `Blocked` otherwise; nothing on the machine is stopped. The Chromium is the cached one; a mismatch of revision makes the rows `Blocked` with the first error line.
- **CI rows** (T13, T14) read `ci.yml` at the Version and the real runs of the workflow with read-only `gh api` requests, cached with `QA_CACHE`; the history is a fixed snapshot; a history row that finds no evidence is `Blocked`. The workflow changed after the delivery, so history shows how CI behaved later, not the file at the Version; each note says so.
- The script takes row ids, so the rows can be run in several groups (a full run takes longer than one command); the evidence file keeps the output of each group and the last line of each.
- Output is counts, exit codes, ids and words. No password and no log text.
- Rows are drafted by Claude and approved by the QA before any row is run. I debug on a mutated copy first; if I run a real row to debug it, I say so.

### Rows (one per requirement; ids follow the requirement numbers)

| ID | TOKI-008 | Output compared with Expected |
| :-- | :-- | :-- |
| T1 | R1 | `T1 0 4 4`: `pnpm test` exits 0; workspace folders that have test files (server, shared, tokens, ui-web); Vitest projects that reported results for them |
| T2 | R2 | `T2 1 1`: the server's integration test of `workspaces` inserts a row and reads it back through Drizzle; it is reported as passed |
| T3 | R3 | `T3 0 0 1`: the database tests pass when the test database does not exist, and again after a leftover table was added by hand; the leftover table is gone |
| T4 | R4 | `T4 1`: after `pnpm test` the row counts of every table of the development stand-in are unchanged |
| T5 | R5 | `T5 5 5 0 1 1`: five refusals (`127.0.0.1` and `localhost` for the same database, the development value with `?sslmode=disable`, a name without `_test`, a non-loopback host, the production setting) each name the failed check; zero connections reach a counting listener before the refusal; a valid value passes; the source checks `current_database()` |
| T6 | R6 | `T6 0 0 1 1`: the two database test files pass in either order; the database project runs files one at a time; removing the emptying step makes the second file fail |
| T7 | R7 | `T7 1 1 1 1`: with Postgres stopped `pnpm test` exits non-zero; the output says the test database cannot be reached; database tests are reported failed, none passed and none skipped; database-free tests still ran and passed |
| T8 | R8 | `T8 1 1 1`: the clock interface has `now(): number` with a system and a test implementation; a test clock set to a fixed instant makes the code that receives it read exactly that instant; the system clock is within a second of `Date.now()` |
| T9 | R9 | `T9 1 1`: advancing the test clock by a duration moves `now()` by exactly that duration, twice in a row; the sample unit test of the clock passes |
| T10 | R10 | `T10 0 1 2`: `pnpm test:e2e` exits 0; the only Playwright project is Chromium; two end-to-end tests passed |
| T11 | R11 | `T11 0 1 1`: the sample test passes; changing the expected text makes `pnpm test:e2e` exit non-zero; the test checks `app-root`, the text `Toki` and the console |
| T12 | R12 | `T12 1 1`: a unit test file added under a package's `src/` is picked up by `pnpm test`; an end-to-end file added under `e2e/` is listed by `playwright test`; no configuration file changed |
| T13 | R13 | `T13 1 1 1`: the CI tests job has a Postgres service and `TEST_DATABASE_URL` with a name ending `_test` and runs `pnpm test`; the log of a real run reports a database test file as passed |
| T14 | R14 | `T14 1 1`: the CI workflow has an `end-to-end` job that runs `pnpm test:e2e`; a real run failed at that step and the run is red |
| T15 | R15 | `T15 1 1 1 1`: the TOKI-004 tests are reported in the database-free project; the TOKI-005 tests in the database project; a failing TOKI-004 test makes `pnpm test` exit non-zero; so does a failing TOKI-005 test |
| T16 | R16 | `T16 1 1 0`: after `pnpm test` the development stand-in holds the same rows and the same schema; no test file calls `dev:reset:db` |
| T17 | R17 | `T17 1 1 0 1`: the harness sends `DROP DATABASE ... WITH (FORCE)` and `CREATE DATABASE` for the test database over the maintenance database `postgres`, and nothing else there (read from the server log); on a server that has only the development database the sample test passes |
| T18 | R18 | `T18 1 0`: a test that reads `current_database()` through the application's own client gets the test database name and not the development name |
| T19 | R19 | `T19 0 1 0`: matches of `Date.now(` and `new Date()` in `apps/server/src` and `packages/client-core/src` outside tests; files with `Date.now(` in `packages/shared/src` outside tests (only `clock.ts`); exit code of `scripts/check-clock-use.sh` |
| T20 | R20 | `T20 0 1 1 1`: with Postgres stopped the database-free script exits 0; the database project includes only `*.db.test.ts`; the database-free project excludes them; the server has the scripts `test` and `test:unit` |
| T21 | R21 | `T21 1 1 1`: the command `pnpm exec playwright install --with-deps chromium` is documented; the CI end-to-end job runs it before `pnpm test:e2e`; no browser other than Chromium is installed |
| T22 | R22 | `T22 0 0 1 (Blocked)`: no end-to-end spec uses seed data; no `dev:reset:db` or `dev:seed` in the end-to-end files or the Playwright config; the development stand-in is unchanged after the end-to-end run. The behavior of R22 (create, seed, drop an end-to-end database) is not exercised: no seeded flow exists at the Version, so the row is `Blocked` |
| T23 | R23 | `T23 1 1 1`: the proxy test requests `/api` and `/healthz` through the web app and checks the server's reply; it passes; aiming the proxy at another port makes `pnpm test:e2e` exit non-zero |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-008.checks.sh` | run on a mutated copy (guard check removed, emptying step removed, a `Date.now(` added, the CI job renamed): the matching rows fail; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-008.md` (unapproved, unrun) | `qa-ready.sh` reports the true gaps |
| R4, R6 | 3. QA approves rows; I run the rows in groups | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `4a17e4b`), `trace.sh` | the TOKI-008 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no process, cluster, worktree or folder left; no write to GitHub |

## What can break (riskiest first)

1. A database or browser row that passes without measuring: every case that must fail is paired with one that must pass and the numbers are printed.
2. Running time: a full run of all rows takes many minutes; the script takes row ids and the evidence keeps each group.
3. Ports 5173 and 3000 busy: the end-to-end rows are `Blocked`, not guessed.
4. The Postgres version (14.24, not 17) and the Chromium revision: a row that depends on either is `Blocked` with the first error line.
5. The GitHub rate limit: the CI rows use the cache and a fixed snapshot, and report an unreadable history as `Blocked`.
6. Mutating files of the temporary worktree: each mutation is restored with `git checkout` and paired with an unmutated run.
