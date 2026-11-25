# QA of the local development environment design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/local-dev-environment-qa.md (Thanh Truong)
Ticket: TOKI-114

## Goal
The builder, the QA and the BA need to know whether TOKI-003 (the development Compose file and the `dev:*` scripts) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-003 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is one of the eight QA tickets for the Blueprint outcome I01 repo-foundation; the acceptance of I01 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of TOKI-001 (`docs/specs/2026-11-25-monorepo-typescript-setup-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-003.md`, its checks script `docs/qa/TOKI-003.checks.sh` and its evidence file `docs/qa/TOKI-003.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I01 and the acceptance record of I01.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-003, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-003 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-003; a row may point to a check that already runs.

## Requirements
- R1. `docs/qa/TOKI-003.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-003`, `Spec: docs/specs/2026-11-12-local-dev-environment-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-003` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-003 (R1 to R30) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-003` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-003.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool, a service or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-003.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only Docker and the real development Compose project `toki-dev` for the rows that start services or reset data (concern 3), a temporary worktree of the commit for the rows that only read files, and `docker compose config` for the static rows. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-003, `e6e2c96` (#78) (concern 1), and every row is judged at it. PR #78 delivered it. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it, without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I01. The record carries a result note that says which Success Criterion of I01 each row will feed (the `done` line: `pnpm dev` runs, CI is green, lint blocks a package-boundary violation), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-003 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-003, the files that TOKI-003 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-003 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-003 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-003 states. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior.

| TOKI-003 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R14, R15, R17 to R20, R25, R26 | static: `docker compose config` lists exactly three services, a Postgres 17 image, `name: toki-dev`, exact image tags and no `latest`, only `127.0.0.1` ports; no relay setting; every credential is a `${VAR:?message}` form and `grep ':-'` finds nothing; every name read is in the inventory; `--env-file .env` from the root | command | docker config |
| R16 | the root `package.json` holds the six scripts and no `dev:seed` | command | files |
| R2, R3, R4, R27 | `dev:up` leaves all three healthy and exits 0, a second run exits 0 and keeps data, `dev:down` then `dev:up` keeps a row, a file and a mail, the bucket is created once | command | docker services |
| R5, R6, R7, R8 | each reset empties only its own store (database, bucket, inbox) and `dev:reset` calls the three entry points with no step of its own | command | docker services, wipes data |
| R9, R22, R23, R24 | `dev:reset` exits non-zero and names the failed step while the rest still run; refuses when a service is down; `dev:reset:db` works with an open session; refuses when the development and test names are equal, system, or the test name is empty | command | docker services, wipes data |
| R10, R11, R12, R21, R28 | the guard refuses unless the environment name is `development` (shell and `.env`); `.env` is unchanged by a reset; the test database is untouched; resets act only through the containers of `toki-dev`; no reset asks for confirmation | command | docker services, wipes data |
| R13 | a mail sent to the Mailpit SMTP port appears in the inbox | command | docker services |
| R29 | with a Docker host that does not exist, each of the six scripts exits non-zero and its message names Docker | command | files |
| R30 | the smoke test in `infra/dev/` passes | command | docker services, wipes data |

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1).

### Layout
```
docs/
  qa/TOKI-003.md  TOKI-003.checks.sh  TOKI-003.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-003` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need installs, services, a browser or a database, and must not change the repository or the development data | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-003 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-003, or the current `main`? Answered: the merge commit, `e6e2c96` (#78) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local services, browser and ports that the rows need, isolated from the development data? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- Many requirements start the real development services and wipe their data (`dev:reset`, `dev:reset:db`). Does the QA run them, and what happens to the development data of the project `toki-dev`? Answered: Claude runs them, and the development data of the Compose project `toki-dev` on this machine is lost. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-003 describe the repository when the ticket closed, and later tickets changed it. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `e6e2c96` (#78), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I01. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree and use the local services, browser and ports that its rows need, isolated from the development data, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. Owner: Thanh Truong (QA).
3. Starting services and wiping data. The rows for `dev:up`, `dev:down` and the four resets (R2 to R9, R11, R12, R21 to R24, R27, R28, R30) start the real services of the Compose project `toki-dev` and `dev:reset` wipes its development data. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: Claude runs them and the development data of that project on this machine is lost; Docker must be running and the host ports free. Rows that cannot run for lack of Docker or a free port are `Blocked`. The row for Docker not running (R29) uses a Docker host that does not exist, not a stopped Docker. Owner: Thanh Truong (QA).
