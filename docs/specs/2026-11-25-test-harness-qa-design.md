# QA of the test harness design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/test-harness-qa.md (Thanh Truong)
Ticket: TOKI-119

## Goal
The builder, the QA and the BA need to know whether TOKI-008 (the Vitest and Playwright test harness) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-008 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is one of the eight QA tickets for the Blueprint outcome I01 repo-foundation; the acceptance of I01 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of TOKI-001 (`docs/specs/2026-11-25-monorepo-typescript-setup-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-008.md`, its checks script `docs/qa/TOKI-008.checks.sh` and its evidence file `docs/qa/TOKI-008.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I01 and the acceptance record of I01.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-008, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-008 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-008; a row may point to a check that already runs.

## Requirements
- R1. `docs/qa/TOKI-008.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-008`, `Spec: docs/specs/2026-11-12-test-harness-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-008` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-008 (R1 to R23) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-008` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-008.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool, a service or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-008.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with a temporary PostgreSQL cluster (as for the QA of TOKI-005), a headless Chromium installed by Playwright in the worktree, and the web app and the server started on free ports. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-008, `4a17e4b` (#137) (concern 1), and every row is judged at it. PR #137 delivered it. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it, without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I01. The record carries a result note that says which Success Criterion of I01 each row will feed (the `done` line: `pnpm dev` runs, CI is green, lint blocks a package-boundary violation), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-008 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-008, the files that TOKI-008 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-008 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-008 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-008 states. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior.

| TOKI-008 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R12, R15, R20 | `pnpm test` runs Vitest for every package with tests and exits 0; the TOKI-004 tests run in the database-free project and the TOKI-005 tests in the database project (a name ending `.db.test.ts`); a new test file is picked up with no configuration change | command | install, temporary Postgres |
| R2, R3, R4, R5, R6, R16, R17, R18, R22 | a sample test inserts into `workspaces` through Drizzle; each run drops, creates and migrates the test database first; tests never touch another database; the run refuses to start unless the connection is a `_test` database on an allowed host; each file starts with empty tables and files run one at a time; code under test reaches the database through the configuration module | command | install, temporary Postgres |
| R7 | with Postgres stopped `pnpm test` exits non-zero, says the test database cannot be reached, skips no database test, and the database-free tests still run | command | install, temporary Postgres |
| R8, R9, R19 | the clock interface has a system and a test implementation, the test clock sets and advances by exact amounts, and application code takes the clock as a parameter (a search for `Date.now` and global timers finds none outside the clock) | command | install, files |
| R10, R11, R21, R23 | `pnpm test:e2e` starts the web app (and the server), runs the Playwright tests in Chromium only and exits 0; the sample test shows "Toki" in `app-root` with no console error; a request to the web app's `/api` reaches the server; the Chromium install command is the one documented | command | install, browser, runs servers |
| R13, R14 | the CI workflow runs the server tests against its Postgres service with `TEST_DATABASE_URL` written in the workflow, and has an end-to-end job that runs `pnpm test:e2e` (a red run on the failing test comes from the history) | command | files, gh history |

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1).

### Layout
```
docs/
  qa/TOKI-008.md  TOKI-008.checks.sh  TOKI-008.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-008` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need installs, services, a browser or a database, and must not change the repository or the development data | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-008 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-008, or the current `main`? Answered: the merge commit, `4a17e4b` (#137) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local services, browser and ports that the rows need, isolated from the development data? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The harness tests need a Postgres "with the development services up", a browser and the web and server processes. Which do the rows use? Answered: the temporary Postgres cluster instead of the development services, a headless Chromium installed in the temporary worktree, and free ports; the development services are not used. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-008 describe the repository when the ticket closed, and later tickets changed it. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `4a17e4b` (#137), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I01. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree and use the local services, browser and ports that its rows need, isolated from the development data, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. Owner: Thanh Truong (QA).
3. The services behind the harness rows. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows use a temporary Postgres cluster (as in the QA of TOKI-005) where the spec says the development services, a headless Chromium installed by Playwright in the temporary worktree, and free ports for the web app and the server; the development services and database are not used. The rows that stop Postgres (R7 of the spec of TOKI-008) stop the temporary cluster only. Owner: Thanh Truong (QA).
