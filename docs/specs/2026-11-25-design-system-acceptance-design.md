# Acceptance of the design system design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/design-system-acceptance.md (Thanh Truong)
Ticket: TOKI-133

## Goal
The builder, the QA and the BA need to know whether the outcome I02 design-system was reached. Its twelve tickets are Done and each is getting a QA record, but the QA rows are judged at each ticket's delivery commit and the outcome is judged on the repository as it stands. After this work I02 has an acceptance record that judges its Success Criteria, confirmed before any check is run, against the QA rows that still hold and new checks on one commit of `main`. The record uses the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds one record and its checks and changes no format and no script. It is the thirteenth ticket of the I02 series and follows the acceptance of I01 (`docs/specs/2026-11-25-repo-foundation-acceptance-design.md`), whose pattern it copies.

## Scope
- In:
  - The acceptance record `docs/acceptance/design-system.md` for the Blueprint outcome I02 (R1 to R3, R7, R8).
  - A read-only checks script `docs/acceptance/design-system.checks.sh` and its evidence file `docs/acceptance/design-system.evidence.txt` for the criteria the QA rows do not settle (R4 to R6).
  - The regenerated `docs/traceability.md` (R9).
- Out (not now):
  - The record of milestone M1; it follows (TOKI-134).
  - Any change to the twelve QA records and their specs, to the scripts of the flow, to the record formats or to a file the checks read. A defect found here is reported in the record (R10).
  - Reopening a ticket on the tracker; the BA decides (R12).
  - Fixing failed or Blocked QA rows.

## Requirements
- R1. `docs/acceptance/design-system.md` is an acceptance record in the format of the parent spec (R6 to R8): header `Outcome: I02`, `Milestone: M1` and `Tickets:` (concern 6); `## Success Criteria`; `## Confirmed`; `## Results` with the columns `SC`, `Tickets`, `Evidence`, `Verdict`, `Reason`, one row for each criterion; `## Verdict`. Check: `bash .github/scripts/acceptance-ready.sh design-system` reports no gap other than those the QA records cause (R8).
- R2. The Success Criteria are taken from the Blueprint `done` line of I02 ("The component preview page matches the prototype; the Undo, confirmation and date-rule patterns exist") and split into separate yes-or-no items without changing the meaning (concern 1). `## Confirmed` names the BA and a date that is not later than any run date of the checks. Check: `acceptance-ready.sh design-system` reports no `Confirmed` gap.
- R3. Each `Results` row cites its evidence: QA rows as `<KEY>:<ID>` where the requirement still holds at the commit named in the row, and new checks as lines of the evidence file. Every evidence cell names the commit it was read at (concern 2). A QA row judged at a delivery commit is cited only after its re-run at that commit shows the requirement still holds. Check: every cell of `Evidence` names a row or a line, and a commit.
- R4. The new checks are in `docs/acceptance/design-system.checks.sh`: each runs `C=<commit> bash docs/acceptance/design-system.checks.sh <ID>` and prints one line of counts, exit codes and words, never a secret. The script reads files of `C` with `git show` and runs tools in a temporary worktree of `C` outside the repository, removed before it ends even when a check fails; it reads and creates no `.env`, adds no file to the repository and leaves no process behind. Output is kept in the evidence file and run twice with identical lines; a check that must fail is paired with a run that must pass. Check: a reader runs the script and gets the same lines; `git status --porcelain` is the same before and after.
- R5. The checks for the three patterns (Undo, confirmation, date rules) run the ticket's own tests of the patterns at `C` (the `ui-web` and `shared` tests that cover them) and one probe of each pattern's public export in a temporary worktree: the export exists and the documented behavior holds on one example input. Each prints the number of tests that ran and passed and the result of the probe.
- R6. The check for "the component preview page matches the prototype" has two parts. The machine part runs the browser test of the preview page (`e2e/component-preview.spec.ts`) with Chromium and Playwright at `C` in a temporary worktree: it prints the tests that passed, failed and were skipped (a skipped test is not a pass). The by-eye part is the QA's own comparison with the prototype, recorded in the record as theirs (concern 4); until they paste it the by-eye part is `Blocked` and the criterion is `Not accepted` with that reason.
- R7. The record states, for each failed or Blocked row of the twelve QA records that bears on a criterion, whether it bears on it and why (concern 3); every failed or Blocked row appears once, as bearing on a criterion or as not bearing on one. No QA record is edited. Check: every failed or Blocked row of TOKI-009 to TOKI-018, TOKI-093 and TOKI-094 appears once in the record.
- R8. The verdict is written after the checks and is `Accepted` only when every criterion is Accepted and `acceptance-ready.sh design-system` passes, which needs every ticket of the header to pass `qa-ready.sh` (concern 6); otherwise `Not accepted` with the reason of each criterion. The verdict that Claude drafts is marked `By: BA, pending <name>` until the BA confirms it. A failed criterion is not rewritten to pass.
- R9. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the rows of the twelve tickets show the verdict, and no other row changes except where a spec merged since the last run adds one.
- R10. This work edits no existing file except `docs/traceability.md` (regenerated). Check: `git diff` of the pull request shows added files and the regenerated table only.
- R11. Evidence holds no secret, token or personal data. Check: review of the pull request.
- R12. The tracker is not changed by this work beyond the ticket's own status. The twelve tickets stay Done; if the verdict is `Not accepted` the BA decides whether to reopen a ticket or amend its spec.

## Design
### How each criterion is judged
The record judges the repository on one commit `C` of `main`, named in each evidence cell. QA rows are evidence only where the requirement they test still holds at `C`.

| Criterion (draft, concern 1) | QA rows that feed it (delivery commits) | New check on `C` |
| :---- | :---- | :---- |
| SC1. The component preview page matches the prototype | TOKI-016 (the browser test rows), TOKI-009, TOKI-010, TOKI-012 to TOKI-015 for the tokens, fonts and components it shows; the `manual` rows of the QA specs | R6 |
| SC2. The Undo pattern exists | TOKI-093 rows for the Undo action | R5 |
| SC3. The confirmation pattern exists | TOKI-093 rows for confirmation and unsaved forms | R5 |
| SC4. The date-rule pattern exists | TOKI-094 rows | R5 |

### Layout
```
docs/
  acceptance/design-system.md  design-system.checks.sh  design-system.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests; this work runs them before and after and changes none.
- The checks script is run twice on the same commit with identical lines; a mutated copy of a pattern or of the preview page makes the matching line change.
- The worked run is the test: `acceptance-ready.sh design-system` and `trace.sh` are run on the real files and what they print is read.

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` is read or created.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and the record format are those of the merged spec; no script or format changes | R1, R10 |
| Success Criteria are confirmed before any check is run | R2 |
| Claude cannot read or create `.env`; a comparison only the person can make is theirs and Blocked until pasted | R4, R6, R11 |
| The QA records and specs are not edited | R3, R7, R10 |
| A criterion is Accepted only with evidence at a named commit; a check that cannot be run is Blocked | R3, R6, R8 |
| Nothing merges a pull request or pushes to `main` | Scope; a person merges |

## Open questions from the intent
- Is the `done` line split into four criteria or fewer? Answered: as drafted in concern 1. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- At which commit are the criteria judged: `main` as it stands, as for I01? Answered: as drafted in concern 2. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- Do the failed and Blocked QA rows stop a criterion, or only those that bear on its statement, and who decides which bear on it? Answered: as drafted in concern 3. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.
- Does the QA make the by-eye comparison with the prototype in their own browser and paste it, or is the criterion Blocked and not accepted until then? Answered: as drafted in concern 4. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 4.
- Does the acceptance run the browser test of the preview page at `C` or rely on the QA row of TOKI-016? Answered: as drafted in concern 5. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 5.

## Areas of concern
1. The split of the Success Criteria. The `done` line has two statements and the second names three patterns; the draft takes four criteria (SC1 the preview page matches the prototype, SC2 the Undo pattern exists, SC3 the confirmation pattern exists, SC4 the date-rule pattern exists). Decided: as drafted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
2. The commit at which the criteria are judged. The draft takes one commit `C` of `main` named in each evidence cell, as decided for I01. Decided: as drafted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
3. Which failed or Blocked QA rows bear on the outcome. The draft: only a row that bears on a criterion's statement stops that criterion; the BA confirms the readings in the record, as decided for I01. Decided: as drafted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
4. The by-eye comparison. The prototype file is not in the repository, so only the QA can compare the preview page with the prototype they hold. The draft: the QA pastes the result; until then the by-eye part is Blocked and SC1 is not accepted. Decided: as drafted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (QA).
5. The browser test of the preview page. The draft: the acceptance runs `e2e/component-preview.spec.ts` at `C` itself (R6), because the QA row of TOKI-016 was judged at its delivery commit. Decided: as drafted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
6. The `Tickets:` header and the QA rule. `acceptance-ready.sh` accepts a verdict of Accepted only when every ticket of the header passes `qa-ready.sh`. The draft lists all twelve tickets; the verdict is then expected to be Not accepted while any of them has a failed or Blocked row, as decided for I01. Decided: as drafted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
