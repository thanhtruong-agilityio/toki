# Acceptance of the repository foundation design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/repo-foundation-acceptance.md (Thanh Truong)
Ticket: TOKI-120

## Goal
The builder, the QA and the BA need to know whether the outcome I01 repo-foundation was reached. Its eight tickets (TOKI-001 to TOKI-008) are Done and each has a QA record, but the QA rows were judged at each ticket's delivery commit and several results no longer hold on `main`. After this work I01 has an acceptance record that judges its Success Criteria, confirmed before any check is run, against the evidence the QA records give where it still holds and against new checks on the repository as it stands, each at a named commit. The record uses the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds one record and its checks and changes no format and no script.

## Scope
- In:
  - The acceptance record `docs/acceptance/repo-foundation.md` for the Blueprint outcome I01 (R1 to R3, R8, R9).
  - A read-only checks script `docs/acceptance/repo-foundation.checks.sh` and its evidence file `docs/acceptance/repo-foundation.evidence.txt` for the criteria that the QA rows do not settle (R4 to R7).
  - The regenerated `docs/traceability.md` (R10).
- Out (not now):
  - The record of milestone M1 (`docs/acceptance/milestone-m1.md`); it follows after the acceptance of I01 and I02.
  - Any change to the eight QA records and their specs, to `acceptance-ready.sh`, `qa-ready.sh`, `trace.sh` or the record formats, or to a file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R11).
  - Reopening a ticket on the tracker; the flow is visible and not binding and the BA decides (R13).
  - Fixing the failed or Blocked QA rows; that is work for the tickets the BA reopens or amends.

## Requirements
- R1. `docs/acceptance/repo-foundation.md` is an acceptance record in the format of the parent spec (R6 to R8): header `Outcome: I01`, `Milestone: M1` and `Tickets:` (concern 6); `## Success Criteria` with SC1, SC2, ... ; `## Confirmed` with the BA's name and date; `## Results` with the columns `SC`, `Tickets`, `Evidence`, `Verdict`, `Reason`, one row for each criterion; `## Verdict`. Check: `bash .github/scripts/acceptance-ready.sh repo-foundation` reports no gap other than those the QA records cause (R9).
- R2. The Success Criteria are taken from the Blueprint `done` line of I01 ("`pnpm dev` runs, CI is green, and lint blocks a package-boundary violation") and split into separate yes-or-no items without changing the meaning (concern 1). `## Confirmed` names the BA and a date that is not later than any run date of the checks, so the criteria are confirmed before any check is run. A criterion added later is shown beside the first ones, marked with its date. Check: `acceptance-ready.sh repo-foundation` reports no `Confirmed` gap.
- R3. Each `Results` row cites its evidence: QA rows as `<KEY>:<ID>` where that row still holds at the commit named in the row, and new checks as `repo-foundation:<ID>` with their line in the evidence file. Every evidence cell names the commit it was read at (concern 2). A QA row that was judged at a delivery commit is cited only after the record says whether the requirement still holds on that commit. Check: every cell of `Evidence` names a row or a line, and a commit.
- R4. The new checks are in `docs/acceptance/repo-foundation.checks.sh`: each runs `C=<commit> bash docs/acceptance/repo-foundation.checks.sh <ID>` and prints one line of counts, exit codes and words, never a secret. The script reads the files of `C` with `git show` and runs tools in a temporary worktree of `C` outside the repository, which it removes before it ends, even when a check fails; it starts no service, reads and creates no `.env`, adds no file to the repository and leaves no process behind. Its output is kept in the evidence file and run twice with identical lines. A check that must fail is paired with a run that must pass. Check: a reader runs the script and gets the same lines; `git status --porcelain` is the same before and after.
- R5. The check for "`pnpm dev` runs" follows concern 4: what runs, where, and who runs it. The QA runs `pnpm dev` in their own terminal on their own `.env` and pastes the result (the processes that started, the ports they listen on, the exit code after stopping) without any value; until the QA has pasted it the check is `Blocked`, SC1 is `Not accepted` with that reason, and a `Blocked` check never makes a criterion `Accepted`. Claude gives the command and does not read or create `.env`.
- R6. The check for "CI is green" reads the runs of the CI workflow on `main` and on pull requests with read-only `gh api` requests (nothing is written to GitHub): the latest completed run on `main` at the commit `C` and the jobs that ran in it, with their conclusions. It does not rely on a delivery commit. Check: the line prints the commit, the number of jobs and the number that concluded `success`.
- R7. The check for "lint blocks a package-boundary violation" runs the repository's own lint in a temporary worktree of `C` on a made-up file that breaks one boundary rule (one violation of each kind the rule set names), and on the unchanged tree: the first exits non-zero and names the rule, the second exits 0. A throwaway pull request carrying one violation is also opened, as decided in concern 5, and the CI lint check on it is read with `gh`: it must be red and name the rule; the pull request is closed without merging and its branch stays until the lead says to delete it. Check: the line prints the exit codes and the number of rules named.
- R8. The record states, for each failed or Blocked QA row listed in the intent (TOKI-007 T3, T11, T19; TOKI-003 T17, T18; TOKI-008 T22) and for every other failed or Blocked row of the eight records that bears on a criterion, whether it bears on the criterion and why (concern 3). A row is not counted twice: it is cited in the criterion it bears on and listed once under `## Result notes` for the others. No QA record is edited. Check: every failed or Blocked row of TOKI-001 to TOKI-008 appears once in the record, as bearing on a criterion or as not bearing on one.
- R9. The verdict is written after the checks and is `Accepted` only when every criterion is Accepted and `acceptance-ready.sh repo-foundation` passes, which needs every ticket of the header to pass `qa-ready.sh` (concern 6); otherwise it is `Not accepted` with the reason of each criterion. The verdict that Claude drafts is marked `By: BA, pending <name>` until the BA confirms it; confirming the criteria does not confirm the verdict. A failed criterion is not rewritten to pass. Check: `acceptance-ready.sh repo-foundation` exits 1 for an `Accepted` verdict over a ticket that does not pass QA.
- R10. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the rows of TOKI-001 to TOKI-008 show the verdict, and no other row of the file changes except where a spec merged since the last run adds one.
- R11. This work edits no existing file except `docs/traceability.md` (regenerated). The eight QA records, their specs, the files the QA records read, the three scripts and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R12. Evidence holds no secret, token, real credential value or personal data. A check quotes counts, names, exit codes and ids. Check: review of the pull request, and a search of the new files for credential-like strings.
- R13. The tracker is not changed by this work beyond the ticket's own status. The eight tickets stay Done; if the verdict is `Not accepted` the record says so, and the BA decides whether to reopen a ticket or to amend its spec. Check: the record names the decision as the BA's and the pull request holds no tracker action.

## Design
### How each criterion is judged
The record judges the repository as it stands on one commit `C` of `main`, named in each evidence cell (concern 2). QA rows are evidence only where the requirement they test still holds at `C`; the result notes of the eight records say where it does not (for example `apps` and `packages` hold many more files than at the delivery of TOKI-001, the `dev` scripts exist, the server has six modules and `process.env` is read in two more files).

| Criterion (draft, concern 1) | QA rows that feed it (delivery commits) | New check on `C` |
| :---- | :---- | :---- |
| SC1. `pnpm dev` runs | TOKI-001 T13; TOKI-004 T1, T5, T6, T14, T15 | R5 (concern 4) |
| SC2. CI is green | TOKI-007 T1, T8, T9, T13 | R6 |
| SC3. Lint blocks a package-boundary violation | TOKI-002 T6 to T13, T16; TOKI-007 T3 (Blocked at the delivery) | R7 |

Failed and Blocked rows and what they touch (concern 3): TOKI-007 T3 is Blocked because no real failed lint run names a boundary rule, which bears on SC3; T11 (a `secrets` reference in `pr-review.yml`) and T19 (path filtering added after the delivery) concern the CI workflow and not whether it is green; TOKI-003 T17 and T18 concern `.env.example` and Compose reading `.env`, which `pnpm dev` does not start; TOKI-008 T22 concerns a seeded end-to-end flow. These are readings for the BA to confirm, not decisions.

### What `acceptance-ready.sh` requires
Accepted needs every ticket of the header `Tickets:` to pass `qa-ready.sh`. At the date of this spec TOKI-001, TOKI-004 and TOKI-006 pass; TOKI-002, TOKI-003, TOKI-005, TOKI-007 and TOKI-008 have Fail or Blocked rows. So with all eight tickets in the header the verdict cannot be Accepted whatever the three criteria show, unless the QA records are amended, which this work does not do (concern 6).

### Layout
```
docs/
  acceptance/repo-foundation.md  repo-foundation.checks.sh  repo-foundation.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of the lint rule or of the workflow makes the matching check fail, so a check is not vacuous.
- The worked run is the test: `acceptance-ready.sh repo-foundation` and `trace.sh` are run on the real files and what they print is read, not assumed.

## Data safety
- Evidence quotes counts, names and exit codes only (R12). No `.env` is read or created; a result that needs the QA's own `.env` is pasted without values.
- The GitHub reads are `GET` requests; no token is printed.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and the record format are those of the merged spec; no script or format changes | R1, R11 |
| Success Criteria are confirmed before any check is run; a later criterion is shown beside the first | R2 |
| Claude cannot read or create `.env`; no secret in a record | R4, R5, R12, Data safety |
| The eight QA records and specs are not edited; an out-of-date result is reported | R3, R8, R11 |
| A criterion is Accepted only with evidence at a named commit; a check that cannot be run is Blocked | R3, R4, R5, R9 |
| Nothing merges a pull request or pushes to `main` | Scope; a person merges |

## Open questions from the intent
- Is the `done` line split into three criteria or more? Answered: three criteria. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- At which commit are the criteria judged: `main` as it stands, or each ticket's delivery commit? Answered: one commit `C` of `main`. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- Do the failed and Blocked QA rows stop a criterion from being accepted, or only those that bear on the three statements, and who decides which bear on it? Answered: only the rows that bear on a statement stop its criterion. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.
- Does the QA run "`pnpm dev` runs" in their own terminal on their own `.env`, or is it Blocked? Answered: the QA runs it in their own terminal and pastes the result without values; Blocked until then. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 4.
- May the acceptance open a throwaway pull request for the violation, or rely on the lint rule's own checks and the history of CI runs? Answered: one throwaway pull request is opened and closed unmerged. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 5.

## Areas of concern
1. The split of the Success Criteria. The `done` line has three statements; the draft in Design takes three criteria (SC1 `pnpm dev` runs, SC2 CI is green, SC3 lint blocks a package-boundary violation). Decided: three criteria. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
2. The commit at which the criteria are judged. The QA records judged each ticket at its delivery commit and left the repository as it stands to this acceptance; the draft takes one commit `C` of `main`, named in each evidence cell. Decided: one commit `C` of `main`, named in each evidence cell; a QA row is used only where its requirement still holds at `C`. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
3. Which failed or Blocked QA rows bear on the outcome. The draft in Design lists a reading for each row; the BA confirms which rows stop a criterion and which are only noted. Decided: only a failed or Blocked row that bears on one of the three statements stops its criterion; the others are listed under `## Result notes`, and the readings in Design are the BA's to confirm in the record. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
4. What "`pnpm dev` runs" means and who runs it. The server reads the environment and a database, so the check needs the QA's own `.env` and the development services, which Claude cannot create; options are the QA running the command in their own terminal and pasting the result without values, or a Blocked check. Decided: the QA runs the command in their own terminal on their own `.env` and pastes the result without values; until then the check is Blocked and SC1 is not accepted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (QA).
5. Real pull requests as evidence. A throwaway pull request with a boundary violation would show that the lint check fails in CI, but it opens a pull request on the real repository; the alternative is the rule's own checks in a temporary worktree and the history of CI runs, as the QA of TOKI-007 did. Decided: one throwaway pull request with a boundary violation is opened for the check, in addition to the worktree check of R7, and is closed without merging; it holds no secret, its branch is deleted only after the lead says so, and the pull request is opened only when the checks are run, after the BA has confirmed the criteria. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (lead).
6. The `Tickets:` header and the QA rule. `acceptance-ready.sh` accepts a verdict of Accepted only when every ticket of the header passes `qa-ready.sh`; five of the eight tickets do not. Listing all eight makes Accepted impossible until the BA reopens or amends tickets; listing only the tickets whose rows feed the criteria changes what the record covers. Decided: all eight tickets are listed; the verdict is expected to be Not accepted until the BA reopens or amends tickets. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
