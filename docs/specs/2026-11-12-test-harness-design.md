# Test harness design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/test-harness.md (Thanh Truong)
Ticket: TOKI-008

## Goal
The builder needs one working test setup, so later tickets can be written test-first and "CI is green" has real tests behind it. The setup runs server tests against a real Postgres, runs one browser end-to-end test against the web app, and lets a test control the time the code sees. Later tickets add tests to this setup and do not build their own.

## Scope
- In: Vitest configuration for unit and server integration tests, extending the minimal Vitest setup from TOKI-004; a test database that is separate from development data, created by this work as a second database on the development Postgres server; a controllable clock; Playwright configuration with one sample test; root scripts to run them; one sample test of each kind as proof; running the existing tests from TOKI-004 and TOKI-005 under the harness and moving the TOKI-005 tests from the development database to the test database; the end-to-end job (`pnpm test:e2e`) and the Postgres service in the CI workflow that TOKI-007 creates.
- Plan change: TOKI-008 now also needs TOKI-007 (decision of 2026-11-12); the Blueprint plan must be updated.
- Out (not now):
  - The Postgres, MinIO and Mailpit services and the `dev:*` start and reset scripts: TOKI-003.
  - The Postgres connection, the migration workflow and the `workspaces` table: TOKI-005. This work only calls them.
  - The web skeleton, router and dev proxy: TOKI-006. The server skeleton and `/healthz`: TOKI-004.
  - The CI workflow file and its lint, type check, tests, build and bundle size jobs: TOKI-007. This work only adds the end-to-end job and the Postgres service to that file (see concern 2).
  - Lint and package boundary rules: TOKI-002.
  - The environment variable inventory and `.env.example`: TOKI-096. The test database connection variable is named there; this work uses that name and invents none (see concern 4).
  - Prototype seed data and `dev:seed`: TOKI-081. The 12 main end-to-end flows belong to the feature tickets that build them.
  - Shared date and time rules (formatting, time zones): TOKI-094. The clock here only supplies "now".
  - Tests for MinIO or Mailpit, component tests for `ui-web`, coverage thresholds: the intent does not ask for them.

## Requirements
- R1. `pnpm test` at the repository root runs Vitest for every workspace package that has tests and exits 0 when all pass.
- R2. A sample server integration test inserts a row into `workspaces` and reads it back through the Drizzle connection to a real Postgres; it passes with the development services up (`pnpm dev:up`).
- R3. The test run applies the TOKI-005 migrations to the test database before the first server test; on an empty test database the R2 test passes with no manual step.
- R4. Server tests use a database other than the development database: after `pnpm test`, the row counts in the development database are unchanged.
- R5. The server test run refuses to start when the test database connection points at the development database; it exits non-zero and prints the reason.
- R6. Each server test file starts with empty tables: two test files that insert the same `workspaces` row both pass, in either order.
- R7. With Postgres stopped, `pnpm test` exits non-zero and prints that the test database cannot be reached; no server test is skipped or reported as passed.
- R8. A clock interface with a `now()` function exists, with a system implementation and a test implementation; a test sets the test clock to a fixed instant and code that receives the clock reads exactly that instant.
- R9. Advancing the test clock by a given duration moves `now()` by exactly that duration; a sample unit test shows this.
- R10. `pnpm test:e2e` at the repository root starts the web app, runs the Playwright tests in `e2e/`, and exits 0 when all pass.
- R11. One sample Playwright test exists: it opens the web app's root page and checks that the page from TOKI-006 renders. Changing the expected text makes `pnpm test:e2e` exit non-zero.
- R12. A unit test file added under any package's `src/` and an end-to-end file added under `e2e/` are picked up by `pnpm test` and `pnpm test:e2e` with no configuration change.
- R13. The CI workflow from TOKI-007 has a Postgres service, added by this work, and runs the server tests against it: on a PR, the R2 test is reported as passed in CI, not skipped.
- R14. The CI workflow from TOKI-007 has an end-to-end job, added by this work, that runs `pnpm test:e2e`: on a PR where the R11 test fails, the CI run is red.
- R15. The existing tests from TOKI-004 and TOKI-005 run under the harness: `pnpm test` at the repository root reports them and exits non-zero when one of them fails.
- R16. The TOKI-005 tests use the test database, not the development database: after `pnpm test`, the development database holds no row and no schema change made by those tests.
- R17. This work creates the test database as a second database, under another name, on the development Postgres server: on a server that has only the development database, the documented test commands of this ticket bring the R2 test to pass without a hand-written SQL step.

## Design
### Errors
- Test database unreachable -> the run fails before any server test, with a message naming the connection (host and database name only, no password).
- Test database connection equals the development connection, or is missing -> the run fails before any server test and prints which value is wrong or missing.
- Migration fails on the test database -> the run fails and prints the migration error.
- Web app does not start within Playwright's start timeout -> `pnpm test:e2e` fails and prints that the web server did not start.

### Layout
```
toki/
├─ vitest.workspace.ts            lists the packages that have tests
├─ playwright.config.ts           starts apps/web, points at e2e/
├─ package.json                   scripts: test, test:e2e
├─ apps/server/
│  ├─ vitest.config.ts
│  └─ test/
│     ├─ setup-db.ts              guard (R5), migrate (R3), empty tables (R6)
│     └─ workspaces.test.ts       sample integration test (R2)
├─ packages/shared/src/clock/
│  ├─ clock.ts                    Clock interface, system clock
│  ├─ test-clock.ts               set and advance
│  └─ clock.test.ts               sample unit test (R8, R9)
└─ e2e/
   └─ sample.spec.ts              sample Playwright test (R11)
```
- The test database is a second database, under another name, on the same development Postgres server from TOKI-003, not a second container. This work creates it (R17). `dev:reset:db` (TOKI-003) wipes only the development database; it never drops the server, the volume or the test database. Decided, see concern 3.
- The Vitest setup extends the minimal one that TOKI-004 added. The TOKI-004 and TOKI-005 tests stay where those tickets put them; the TOKI-005 tests are switched from the development database to the test database (R15, R16).
- CI: this work edits the workflow file that TOKI-007 creates. It adds a Postgres service for the server tests (R13) and an end-to-end job that runs `pnpm test:e2e` (R14). TOKI-007 itself contains no end-to-end step and no Postgres service. Decided, see concern 2.
- Assumption: the clock lives in `packages/shared` so the server and `client-core` can both take it. Code receives the clock as a parameter; it does not read a global. See concern 1.
- Assumption: the sample Playwright test runs in Chromium only and needs the web app only, not the server. See concern 5.
- The clock controls time read by application code. It does not change time produced inside Postgres (for example a column default of the current time).

## Testing
- The harness is proved by its own sample tests: the integration test (R2, R3), the clock test (R8, R9) and the Playwright test (R11). Each is written first and seen to fail before the configuration makes it pass.
- R4 to R7 are checked by hand once and recorded in the PR: run with the guard triggered, with Postgres stopped, and compare development row counts before and after.
- R13 and R14 are checked on this ticket's own PR: the CI run shows the server tests passing against the Postgres service and the end-to-end job passing.
- R15 and R16 are checked by running `pnpm test` and seeing the TOKI-004 and TOKI-005 tests in the report, then comparing the development database before and after. R17 is checked once by hand on a server that has only the development database, and recorded in the PR.
- Fake data only: the sample workspace row uses a made-up name. No seed data is used.

## Data safety
- The test database connection comes from the environment, never from a value committed to git. Its variable name is the one in the TOKI-096 inventory. Error messages do not print passwords.
- Tests empty tables, so the R5 guard must run before any statement is sent to the database.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008; I01 is done when `pnpm dev` runs, CI is green, and lint blocks a package-boundary violation | R1 and R10 give CI real tests to run; R13 and R14 make CI run them. `pnpm dev` and lint are owned by other I01 tickets (Scope, Out). |
| Milestone: M1 Foundation and design system | Planning fact; no design impact. |
| Size: M (about one working session with Claude) | Scope: one sample test of each kind, no feature tests. |
| Needs: TOKI-005 and TOKI-006 | R2 and R3 use the TOKI-005 connection, migrations and table. R10 and R11 use the TOKI-006 web skeleton. Plan change: TOKI-008 now also needs TOKI-007 (decision of 2026-11-12); the Blueprint plan must be updated. |
| Needed by: no ticket lists TOKI-008 in its Needs column | Planning fact; no design impact. TOKI-008 itself now needs TOKI-007 (concern 2). |
| Agreed test tools: Vitest for unit and server integration tests, Playwright for end-to-end tests | R1, R10, Layout. |
| Server integration tests run against a real Postgres | R2, R3, R7. No in-memory or mocked database. |
| The scope includes a controllable clock and one sample Playwright test | R8, R9, R11. |
| Development services (Postgres, MinIO, Mailpit) come from the local development environment | R2 runs against the Postgres started by `dev:up`. This work adds no local service of its own; the test database is a second database on that server (R17, concern 3). |
| The test database is separate from development data: no development reset script touches it | R4, R5, R16. The reset scripts are owned by TOKI-003; `dev:reset:db` wipes only the development database (concern 3). |
| The end-to-end tests later use the prototype seed data loaded by `dev:seed` (TOKI-081, end of M3) | Out of scope. R11 needs no seed data; R12 lets later tickets add seeded tests. |
| CI on every PR runs lint, type check, tests, build, end-to-end and bundle size | R1 and R10 provide the two commands CI calls. R13 and R14 wire the server tests with a Postgres service and the end-to-end job into the TOKI-007 workflow (concern 2). |

## Open questions from the intent
- The Blueprint lists nothing under "Open for the spec" for TOKI-008. Not a question.
- What is the controllable clock needed for? Answered in part: for the time-dependent rules of phase 1 (code and session lifetimes, invitation expiry, rate limits, presence, status timers, reminders); first needed by TOKI-022. Carried forward as concern 1.
- Should the sample end-to-end test run in CI as part of this ticket or as part of TOKI-007? Answered: as part of this ticket; TOKI-008 adds the end-to-end job and the Postgres service to the CI workflow that TOKI-007 creates. See concern 2.

## Areas of concern
1. The purpose and first use of the controllable clock are not stated in the intent or the Blueprint. This spec assumes an injected `now()` clock in `packages/shared`. If the first use needs timers, browser time in Playwright, or database time, the design changes. Answered in part: the clock is for the time-dependent rules of phase 1. The Blueprint states: a sign-in code is valid for 10 minutes; a session lasts 30 days; an invitation expires after 7 days (G4); at most 5 code requests in 15 minutes and resend after 60 seconds (G5); presence turns Away after 5 minutes (G3); a status clears on a timer (TOKI-056); reminders and snoozes fire on time (TOKI-066, TOKI-067; M5 exit check "reminders fire on time"). The first ticket by milestone order that needs it is TOKI-022 "Sign-in API" (M2). Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Requirements tab, Sign-in; assumptions G3, G4, G5; Plan tab, tickets TOKI-022, TOKI-056, TOKI-067 and milestone M5. Still open: whether an injected `now()` is enough once timers run in the job queue (TOKI-064, pg-boss) and in the browser. Owner: Thanh Truong.
2. The Blueprint Infrastructure section says CI runs end-to-end on every PR, but the TOKI-007 scope lists only lint, type check, tests, build and bundle size, and TOKI-007 does not need TOKI-008. The question was which ticket adds `pnpm test:e2e` and a Postgres service to CI. Decided: TOKI-008 adds the end-to-end job (`pnpm test:e2e`) and the Postgres service to the CI workflow that TOKI-007 creates; TOKI-007 itself contains no end-to-end step and no Postgres service; TOKI-008 now also needs TOKI-007 (R13, R14). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
3. The Blueprint says no reset touches the test database but does not say where the test database lives or who creates it. Decided: the test database is a second database, under another name, on the same development Postgres server; `dev:reset:db` wipes only the development database and never drops the server, the volume or the test database; TOKI-008 still owns creating the test database (R17). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
4. The test database connection needs an environment variable. Its name, default and place in `.env.example` belong to the TOKI-096 inventory, which is not written yet. Decided: the test database connection variable is named in the TOKI-096 inventory; TOKI-096 is done first and names every phase 1 variable, and this work uses that name and invents none. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
5. The Blueprint says end-to-end tests run at desktop and phone widths but names no browsers. This spec assumes the sample test runs in Chromium at the default width only. The browser list and the two widths need a decision before feature flows are added. Answered in part: the two widths belong to TOKI-090 "12 end-to-end flows: Complete at desktop and phone widths" (M6), per the phase 1 acceptance criterion "All 12 end-to-end flows pass at desktop and phone widths"; the sample test here does not need them. Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Plan tab, ticket TOKI-090; Requirements tab, Acceptance criteria for phase 1. Still open: the browser list, which the Blueprint does not name. Owner: Thanh Truong.
6. R6 empties tables per test file, which assumes server test files do not run against the same database in parallel. If parallel runs are wanted for speed, the isolation method (one database per worker, or transactions) must be chosen. Owner: Thanh Truong.
7. The sample Playwright test does not start the server. No test in this ticket proves that the web app, the dev proxy and the server work together. Decide whether that proof belongs here or in the first feature ticket. Owner: Thanh Truong.
