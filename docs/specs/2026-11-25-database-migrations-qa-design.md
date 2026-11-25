# QA of the database connection, migrations and the workspaces table design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/database-migrations-qa.md (Thanh Truong)
Ticket: TOKI-116

## Goal
The builder, the QA and the BA need to know whether TOKI-005 (the database client, the migration commands and the `workspaces` table) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-005 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is one of the eight QA tickets for the Blueprint outcome I01 repo-foundation; the acceptance of I01 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of TOKI-001 (`docs/specs/2026-11-25-monorepo-typescript-setup-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-005.md`, its checks script `docs/qa/TOKI-005.checks.sh` and its evidence file `docs/qa/TOKI-005.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I01 and the acceptance record of I01.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-005, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-005 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-005; a row may point to a check that already runs.

## Requirements
- R1. `docs/qa/TOKI-005.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-005`, `Spec: docs/specs/2026-11-12-database-migrations-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-005` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-005 (R1 to R16) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-005` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-005.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool, a service or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-005.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit and a temporary PostgreSQL cluster created with `initdb` in a temporary folder on its own unix socket and port, removed at the end; the Postgres on this machine may be a different major version than the 17 that Compose uses, and the record states which. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-005, `b304159` (#128) (concern 1), and every row is judged at it. PR #128 delivered it. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it, without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I01. The record carries a result note that says which Success Criterion of I01 each row will feed (the `done` line: `pnpm dev` runs, CI is green, lint blocks a package-boundary violation), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-005 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-005, the files that TOKI-005 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-005 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-005 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-005 states. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior.

| TOKI-005 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R2, R14, R16 | the client is built from `DATABASE_URL` and connects at first use; the server without the variable exits non-zero naming it; `db:migrate` reports a missing variable and an unreachable Postgres; the server still starts with Postgres unreachable | command | install, temporary Postgres |
| R3 | changing a table definition and running the generate command adds a SQL file and `meta/` files | command | install |
| R4, R5, R6, R7 | the apply command creates `workspaces` on an empty database, a second run succeeds with the schema unchanged, it runs from the root as one script, and a failing migration leaves the database as it was | command | install, temporary Postgres |
| R8, R9, R15 | `workspaces.id` is a `uuid` primary key with a UUIDv7 default made in the server; `name` is not null with a check of 1 to 100 characters; `created_at` is `timestamptz` not null set by the database, no `updated_at`, more than one row allowed, no other column | command | install, temporary Postgres |
| R10 | no connection string with a password in the files of the change | command | files |
| R11 | `apps/server/src/db/README.md` exists and lists the steps | command | files |
| R12 | `dev:reset:db` on a development database that holds data wipes it and applies the migrations; it wipes the development database, so the QA runs it by hand | manual | docker services, wipes data |
| R13 | no automated test writes to the development database: each test reads `TEST_DATABASE_URL` and makes its own throwaway database | command | files |

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1).

### Layout
```
docs/
  qa/TOKI-005.md  TOKI-005.checks.sh  TOKI-005.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-005` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need installs, services, a browser or a database, and must not change the repository or the development data | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-005 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-005, or the current `main`? Answered: the merge commit, `b304159` (#128) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local services, browser and ports that the rows need, isolated from the development data? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The rows need a PostgreSQL, and the development database must not be touched. Which one do they use? Answered: a temporary cluster made with `initdb`, which may be an older major version than Compose's 17 (the record says which), and removed afterwards. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-005 describe the repository when the ticket closed, and later tickets changed it. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `b304159` (#128), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I01. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree and use the local services, browser and ports that its rows need, isolated from the development data, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. Owner: Thanh Truong (QA).
3. The PostgreSQL used by the rows. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: a temporary cluster made with `initdb` in a temporary folder, on its own socket and port, removed at the end; the development database is never touched. The Postgres major version on this machine may differ from the 17 of Compose; the `Environment:` of the record states it, and a row whose result depends on the version is `Blocked` with that note instead of guessed. The row that runs `dev:reset:db` on a development database that holds data (R12 of the spec of TOKI-005) wipes the development database and is run by the QA by hand, not by Claude. Owner: Thanh Truong (QA).
