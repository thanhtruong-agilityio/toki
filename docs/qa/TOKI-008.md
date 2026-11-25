# QA record: TOKI-008
Ticket: TOKI-008
Spec: docs/specs/2026-11-12-test-harness-design.md
Version: 4a17e4b
Environment: a temporary worktree of the Version under Node 22 (`~/.nvm`), pnpm through corepack, macOS; a temporary PostgreSQL 14.24 (Homebrew) cluster made with `initdb` on a loopback port, with a development stand-in database and the test database the harness itself makes (not the PostgreSQL 17 of Compose; the Docker services and the real development database are not touched); the Chromium cached by Playwright; the web app and the server on the ports 5173 and 3000 that the Playwright config fixes (free when the rows ran); the CI rows read `ci.yml` at the Version and the real runs of the workflow with read-only `gh api` requests (nothing written to GitHub, no pull request opened); the repository itself is not changed

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafts the rows; the QA approves them before any row is run. Claude runs the command rows.

Each row runs `V=4a17e4b bash docs/qa/TOKI-008.checks.sh <ID>` (called `checks` below) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-008.evidence.txt`. `4a17e4b` is the merge commit of PR #137 (2026-11-18), decided in concern 1 of the spec of this record. The rows that change a file of the temporary worktree restore it and are paired with an unchanged run. The history rows read the runs of `ci.yml` from the first commit of PR #137 up to a fixed instant; the workflow changed after the delivery, so a history row shows how CI behaved, not the file at the Version. No `.env` is read or created; no password and no log text is kept.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 0 4 4`: `pnpm test` exits 0; four workspace folders have test files (server, shared, tokens, ui-web) and all four have files reported as passed by Vitest |  | P1 |  |  |  |
| T2 | R2 | command | `checks T2` | `T2 1 1`: the server's integration test of `workspaces` inserts a row and reads it back through Drizzle; it is reported as passed |  | P1 |  |  |  |
| T3 | R3 | command | `checks T3` | `T3 0 0 1`: the database tests pass when the test database does not exist, and again after a leftover table was added by hand; the leftover table is gone |  | P1 |  |  |  |
| T4 | R4 | command | `checks T4` | `T4 1`: after `pnpm test` the row counts of every table of the development stand-in are unchanged |  | P1 |  |  |  |
| T5 | R5 | command | `checks T5` | `T5 5 5 0 1 1`: five refusals (the same database through `localhost`, the development value with `?sslmode=disable`, a name without `_test`, a non-loopback host, the production setting) each name the failed check; zero connections reach a counting listener before the runtime refusal; a valid value passes; the source checks `current_database()` |  | P1 |  |  |  |
| T6 | R6 | command | `checks T6` | `T6 0 0 1 1`: the two database test files pass in either order; the database project runs files one at a time; removing the emptying step makes the run fail |  | P1 |  |  |  |
| T7 | R7 | command | `checks T7` | `T7 1 1 1 1`: with Postgres stopped `pnpm test` exits non-zero; the output says the test database cannot be reached; database test files are reported failed, none passed and none skipped; database-free tests still ran and passed |  | P1 |  |  |  |
| T8 | R8 | command | `checks T8` | `T8 1 1 1 1`: the clock interface has `now(): number`; a test clock set to a fixed instant makes the code that receives it read exactly that instant; the system clock is within a second of `Date.now()`; the system implementation has a `now` function |  | P2 |  |  |  |
| T9 | R9 | command | `checks T9` | `T9 1 1`: advancing the test clock by a duration moves `now()` by exactly that duration, twice in a row; the sample unit test of the clock passes |  | P2 |  |  |  |
| T10 | R10 | command | `checks T10` | `T10 0 1 2`: `pnpm test:e2e` exits 0; the only Playwright project is Chromium; two end-to-end tests passed |  | P1 |  |  |  |
| T11 | R11 | command | `checks T11` | `T11 0 1 1`: the sample test passes; changing the expected text makes the run exit non-zero; the test checks `app-root`, the text `Toki` and the console |  | P1 |  |  |  |
| T12 | R12 | command | `checks T12` | `T12 1 1 1`: a unit test file added under a package's `src/` is picked up by Vitest; an end-to-end file added under `e2e/` is listed by Playwright; only the two new files changed (no configuration file) |  | P2 |  |  |  |
| T13 | R13 | command | `checks T13` | `T13 1 1 1`: the CI tests job writes `TEST_DATABASE_URL` with a name ending `_test` and runs `pnpm test`; the log of a real pull request run reports a database test file as passed, nothing skipped |  | P1 |  |  |  |
| T14 | R14 | command | `checks T14` | `T14 1 1`: the CI workflow has an `end-to-end` job that runs `pnpm test:e2e`; a real run failed at that step and the run is red |  | P2 |  |  |  |
| T15 | R15 | command | `checks T15` | `T15 1 1 1 1`: the TOKI-004 tests are reported in the database-free project; the TOKI-005 tests in the database project; an expectation changed in a TOKI-004 test makes `pnpm test` exit non-zero; so does one in a TOKI-005 test |  | P1 |  |  |  |
| T16 | R16 | command | `checks T16` | `T16 1 1 0`: after `pnpm test` the development stand-in holds the same rows and the same schema; no test file calls `dev:reset:db` |  | P1 |  |  |  |
| T17 | R17 | command | `checks T17` | `T17 1 1 0 1`: the harness sends `DROP DATABASE ... WITH (FORCE)` and `CREATE DATABASE` for the test database over the maintenance database `postgres` and nothing else there (read from the server's own log); on a server that has only the development database the database tests pass |  | P1 |  |  |  |
| T18 | R18 | command | `checks T18` | `T18 1 0`: a test that reads `current_database()` through the application's own client gets the test database name and not the development name |  | P2 |  |  |  |
| T19 | R19 | command | `checks T19` | `T19 0 1 0`: files with `Date.now(` or `new Date()` in `apps/server/src` and `packages/client-core/src` outside tests; files with `Date.now(` in `packages/shared/src` outside tests (only `clock.ts`); exit code of `scripts/check-clock-use.sh` |  | P2 |  |  |  |
| T20 | R20 | command | `checks T20` | `T20 0 1 1 1`: with Postgres stopped the database-free script exits 0; the database project includes only `*.db.test.ts`; the database-free project excludes them; the server has the scripts `test` and `test:unit` |  | P1 |  |  |  |
| T21 | R21 | command | `checks T21` | `T21 1 1 1`: the command `pnpm exec playwright install --with-deps chromium` is documented; the CI end-to-end job runs it before `pnpm test:e2e`; only Chromium is installed |  | P2 |  |  |  |
| T22 | R22 | command | `checks T22` | `T22 0 0 1`: no end-to-end file uses seed data; no `dev:reset:db` or `dev:seed` in the end-to-end files or the Playwright config; the development stand-in is unchanged after the end-to-end run. The create, seed and drop behavior of R22 is not exercised: no seeded flow exists at the Version, so the row is Blocked |  | P2 |  |  |  |
| T23 | R23 | command | `checks T23` | `T23 1 1 1`: the proxy test requests `/healthz` and `/api/v1` through the web app and checks the server's reply; it passes; aiming the proxy at another port makes `pnpm test:e2e` exit non-zero |  | P1 |  |  |  |

## Not covered
- None: every requirement R1 to R23 of the spec has a row (the spec numbers R17 after R18; the rows follow the requirement numbers).
