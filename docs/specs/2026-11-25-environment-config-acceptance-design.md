# QA and acceptance of the environment configuration design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/environment-config-acceptance.md (Thanh Truong)
Ticket: TOKI-111

## Goal
The builder, the QA and the BA need to know whether the outcome I17 environment-config was reached. TOKI-096 delivered the inventory of environment variables and `.env.example` and was closed as Done on merge, with no test by anyone but its author. After this work TOKI-096 has a QA record that tests each requirement of its spec against the repository at a named commit, and I17 has an acceptance record that judges its Success Criteria, confirmed before any test, against those results. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script.

## Scope
- In:
  - The QA record `docs/qa/TOKI-096.md`, its checks script `docs/qa/TOKI-096.checks.sh` and its evidence file `docs/qa/TOKI-096.evidence.txt` (R1 to R5).
  - The acceptance record `docs/acceptance/environment-config.md` for the Blueprint outcome I17 (R6, R7).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA and acceptance of I01 and I02 and the record of milestone M1; they are the next follow-up tickets (concern 9 of the parent spec).
  - Any change to the scripts `qa-ready.sh`, `acceptance-ready.sh` and `trace.sh`, to the record formats, to the intent and spec of TOKI-096, to `docs/environment-config.md` or to `.env.example`. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-096 on the tracker. The flow is visible and not binding (parent concern 8); the BA decides.
  - Tests of how the server or the compose scripts use the variables; those belong to the tickets that read them.

## Requirements
- R1. `docs/qa/TOKI-096.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-096`, `Spec: docs/specs/2026-11-12-environment-config-design.md`, `Version:` (the commit of `main` that the checks read) and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-096` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement R1 to R13 of the spec of TOKI-096 has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and its `Expected` is a concrete value. Check: `qa-ready.sh TOKI-096` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-096.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of one commit with `git show` and prints names, counts and booleans, never a value of a variable (R10). Its output is kept in `docs/qa/TOKI-096.evidence.txt`, and the `Evidence` of a Pass row points to the line. Check: a reader runs the script and gets the same lines.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in a result note, never `Pass`. A check that was wrong is corrected and rerun with both runs kept in the evidence file, as for TOKI-095. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. No row and no script of this work creates, reads or prints `.env`, `.env.local` or `apps/server/.env`. The requirement R5 of the spec of TOKI-096 (every required variable has a development value in hand) is a `manual` row that the QA runs in their own terminal, before the verdict is written, with a command given in `Steps` that lists the required variable names that are unset or empty and prints no value. Until the QA pastes that output (names only) the row is `Blocked`; if it is still Blocked when the verdict is written, SC3 is `Not accepted` with that reason (concern 2). Check: `git grep` of the records finds no variable value, and the row's `Evidence` is the pasted list of names or empty.
- R6. `docs/acceptance/environment-config.md` is an acceptance record in the format of the parent spec (R6 to R8): header `Outcome: I17`, `Milestone: M1`, `Tickets: TOKI-096`; `## Success Criteria` with SC1, SC2, ... taken from the Blueprint `done` line of I17 ("Every environment variable is listed; `.env.example` matches the list; each required value exists for development and has a named owner for production"), split into separate yes-or-no items without changing the meaning (concern 1); `## Confirmed` with the BA's name and date, written before any row of TOKI-096 is run; `## Results` with one row for each criterion citing QA rows as `TOKI-096:<ID>`; `## Verdict`. Check: `bash .github/scripts/acceptance-ready.sh environment-config` reports no gap.
- R7. The verdict is written after the run and is `Accepted` only when every criterion is Accepted and `qa-ready.sh TOKI-096` passes; otherwise `Not accepted` with the reason of each criterion. The verdict that Claude drafts is marked `By: BA, pending <name>` until the BA confirms it; confirming the criteria does not confirm the verdict. A failed criterion is not rewritten to pass (R9 of the parent spec). Check: `acceptance-ready.sh environment-config` exits 1 for an `Accepted` verdict over a ticket that does not pass QA.
- R8. `bash .github/scripts/trace.sh` is run after both records exist and `docs/traceability.md` is committed with them. Check: the TOKI-096 row shows the requirements covered, the rows passed over the rows and the verdict, and no other row of the file changes except where this work adds a record.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The merged intent and spec of TOKI-096, `docs/environment-config.md`, `.env.example`, the three scripts and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. Evidence holds no secret, token, real credential value or personal data. A command row quotes a count or a name list; a row about a value (for example the first admin email) says only whether it is on a reserved test domain. Check: review of the pull request, and the search of R3 over the record files.
- R11. The tracker is not changed by this work beyond the ticket's own status. TOKI-096 stays Done; if the verdict is `Not accepted` the record says so and the BA decides whether to reopen it or to amend its spec (parent concern 8). Check: the record names the decision as the BA's and the pull request holds no tracker action.

## Design
### How each requirement of TOKI-096 is tested
The checks read the files at the commit named in `Version:`. `Expected` values are those the spec of TOKI-096 states; where that spec leaves a value open, the row says what is compared.

| TOKI-096 | What the row compares | Layer |
| :---- | :---- | :---- |
| R1 | The inventory table in `docs/environment-config.md` has the eight columns of R1 | command |
| R2 | Every category of "Categories to cover" has a row or a stated reason; SMTP has rows; "first admin email" and "first admin name" each have a row | command |
| R3 | The sorted name list of the inventory equals the sorted name list of `.env.example`; each non-secret value equals the Development value | command |
| R4 | Every row that production reads with Required = yes has a non-empty Supplied by | command |
| R5 | Every required development variable has a value in the QA's own `.env` (names of the gaps only) | manual |
| R6 | The external values list has rows for domain, mail account and VPS with the four columns; no backup row | command |
| R7 | A "How secrets are kept" section with one development and one production entry | command |
| R8 | `git check-ignore` prints the three `.env` paths and nothing for `.env.example` | command |
| R9 | Every Secret = yes row is empty in `.env.example`; a search of the committed files for credential-like values finds none; the first admin email is on a reserved test domain or empty | command |
| R10 | The merge of TOKI-096 is earlier than the first commit of TOKI-003, TOKI-004, TOKI-005, TOKI-006 and TOKI-008 (git history) | command |
| R11 | `DATABASE_URL` and `TEST_DATABASE_URL` rows exist with Secret = yes; no app-connection parts rows | command |
| R12 | The server and port rows exist with the stated Defaults | command |
| R13 | The CI workflow holds `TEST_DATABASE_URL` with no `secrets.` reference and a name ending in `_test` | command |

R8 and R13 were "pending" in the spec of TOKI-096 until TOKI-001 and TOKI-008 merged; both exist on `main` now, so both rows are run.

### Success Criteria of I17 (draft for the BA)
Proposed split of the Blueprint line, for the BA to confirm or change (concern 1): SC1 every environment variable is listed (TOKI-096 R1, R2, R10, R11, R12); SC2 `.env.example` matches the list (R3, R9); SC3 each required value exists for development (R5); SC4 each required value has a named owner for production (R4, R6).

### Variables added after TOKI-096
If the QA finds a variable that code reads and the inventory lacks, the record lists it under `## Result notes` as a note for the ticket that added it. It does not fail a row of TOKI-096 (concern 4).

### Layout
```
docs/
  qa/TOKI-096.md  TOKI-096.checks.sh  TOKI-096.evidence.txt
  acceptance/environment-config.md
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow already have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is read-only and is itself checked by running it twice on the same commit: the lines are identical.
- The worked run is the test: `qa-ready.sh TOKI-096`, `acceptance-ready.sh environment-config` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes names and counts only (R10). The QA's `.env` is never read by Claude and no value of it is pasted anywhere.
- The first admin email is personal data: a row says whether it is on a reserved test domain and does not copy it.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R6, R9 |
| Success Criteria are confirmed before any row is run; a later criterion is shown beside the first | R6 (`## Confirmed` before the run), R7 |
| Claude cannot read or create `.env`; no secret or credential value in a record | R3, R5, R10, Data safety |
| The existing intent and spec of TOKI-096 are not edited; an out-of-date requirement is a Fail with the reason | R9, R11 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked | R3, R4 |
| Nothing merges a pull request or pushes to `main` | Scope; a person merges |

## Open questions from the intent
- The Blueprint `done` line has three statements joined by semicolons: three criteria or four? Answered: four (R6, Design). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- "Each required value exists for development" needs a filled `.env` that Claude must not read: does the QA run that row, or is it Blocked? Answered: the QA runs it before the verdict (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- Is a role accepted as "a named owner" for production, or must every value name a person? Answered: a role is accepted (concern 3). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.
- Where the inventory and the code differ because later tickets added variables, is that a Fail of TOKI-096 or a follow-up for the ticket that added the variable? Answered: a note, not a Fail (Design). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 4.

## Areas of concern
1. The split of the Success Criteria. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: four items, as drafted in Design (every variable listed; `.env.example` matches; each required value exists for development; each required value has a named owner for production). Owner: Thanh Truong (BA).
2. The development-value row (TOKI-096 R5). Only the QA can run it, on their own `.env`; Claude gives the command and the row stays Blocked until the QA pastes the names of the gaps. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the QA runs the row before the verdict is written; if it has not been run when the verdict is written, SC3 is Not accepted with that reason. Owner: Thanh Truong (QA).
3. What counts as "a named owner for production". The spec of TOKI-096 (R4) accepts a person for first-installation values and a role for per-installation values. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: a role counts as a named owner for SC4, as R4 of that spec allows; a row with no owner at all is a Fail. Owner: Thanh Truong (BA).
4. Variables added after TOKI-096 merged. The inventory is a living file; the checks read it at one commit. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: a variable that code reads and the inventory lacks is a note for the ticket that added it (R10 of the spec of TOKI-096 gives that ticket the job of adding the row), listed under `## Result notes` of the QA record; it does not make a row of TOKI-096 Fail. Owner: Thanh Truong (BA).
5. Rows that were pending in the spec of TOKI-096. R8 waited for TOKI-001 and R13 for TOKI-008; both are on `main`. Accepted in this spec: both rows are run, not recorded as pending. Owner: Thanh Truong.
