# QA of the shared date and time rules design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/date-time-rules-qa.md (Thanh Truong)
Ticket: TOKI-132

## Goal
The builder, the QA and the BA need to know whether TOKI-094 (the shared date and time rules) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-094 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is the last of the twelve QA tickets of the Blueprint outcome I02 design-system, whose done line says the Undo, confirmation and date-rule patterns exist; TOKI-094 is the date-rule pattern. The acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of TOKI-008 (`docs/specs/2026-11-25-test-harness-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-094.md`, its checks script `docs/qa/TOKI-094.checks.sh` and its evidence file `docs/qa/TOKI-094.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-094, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-094 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-094; a row may point to a check that already runs.

## Requirements
- R1. `docs/qa/TOKI-094.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-094`, `Spec: docs/specs/2026-11-16-date-time-rules-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-094` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-094 (R1 to R18) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-094` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-094.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a runtime runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). A row that calls a function of the module runs a small throwaway script in that worktree with fixed instants and zones, and prints the result, a count or the word `ok`; it never prints a secret. Its output is kept in `docs/qa/TOKI-094.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. A requirement that is only a by-eye comparison with the prototype would be a `manual` row for the QA, Blocked until the QA pastes the result, never Pass; the spec of TOKI-094 has none (Design). Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit, a `pnpm install` in it, and the Node and Vitest that the worktree pins. TOKI-094 is a module of pure functions, so no row needs a database, a server, a port or a browser. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree and folder it created, even when a row fails. A row that cannot run for lack of a tool (for example no network for the install) is `Blocked`. If a later row of this series needs Chromium with Playwright against the built or dev app, it is a command row in the temporary worktree on a free port; none of the rows here does. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-094, `73036185` (#152) (concern 1), and every row is judged at it. PR #152 delivered it: it adds the seven source files and six test files of `packages/shared/src/datetime/` and the export line of `packages/shared/src/index.ts`. No later commit re-landed the module; later commits changed around it (`0945b4e1`, TOKI-015, moved the tests of the module from `src/datetime/` to `packages/shared/tests/datetime/`). The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it, without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I02. The record carries a result note that says which Success Criterion of I02 each row will feed (the done line: the date-rule pattern exists), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-094 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-094, the files that TOKI-094 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-094 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-094 is tested
The checks read files of one commit `V`; rows that call the module use a temporary worktree of `V` (R5) and fixed instants, so no row reads the real time. `Expected` is what the spec of TOKI-094 states, including its examples. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior (eleven groups). The delivered Vitest suite is not the evidence: a row calls the function itself, and one extra row runs the delivered suite for the record.

| TOKI-094 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R6 | `formatTime` gives `15:05` for 2026-11-10T08:05:00Z in `Asia/Ho_Chi_Minh`, `00:00` at midnight, `23:59`, a half-hour offset in `Asia/Kolkata`, and no result holds `AM`, `PM` or `24:`; `formatCountdown` gives `01:05` for 65 000, `1:02:05` for 3 725 000, `00:00` for 0 and a negative value, `null` for `NaN` and `-Infinity` | command | install |
| R2, R3 | `formatDate` gives `Tue 10 Nov`, `10 Nov` with `weekday: false`, `Thu 31 Dec 2026` seen from 2027, `Fri 1 Jan 2027` seen from 2026, no year in the same year, the year in every case with `year: "always"`, and the year change is read in the zone, not in UTC | command | install |
| R4, R5 | `formatDay` returns the three day words around midnight in the zone, Tomorrow for 23:30 plus 40 minutes, and the date text for any other day; `formatDateTime` gives the five examples of R5 | command | install |
| R7 | each function of R7 called with `NaN`, `Infinity`, `-Infinity`, an ISO string and a missing value in each instant place, and with `""` and `Mars/Phobos` in each zone place, gives `null`; `formatCountdown` gets the numeric values only; no string result contains `Invalid Date`, `NaN` or `undefined` | command | install |
| R8 | with the day words `T1`, `T2`, `T3` every result of R2 to R5 holds only those words, names of the table, digits, spaces and colons; the table has 7 weekday and 12 month names for every language it lists; `'vi'` and `'fr'` give the English results | command | install |
| R9, R10 | `zonedParts` returns the seven parts for a fixed instant; `utcOffsetMinutes` gives 420, 330, -300 (January) and -240 (July); `isValidTimeZone` is `true` for `Asia/Ho_Chi_Minh` and `false` for `""` and `Mars/Phobos` without throwing; `atLocalTime` gives 09:00 today and tomorrow, the first instant after a gap (02:30 on the spring-forward day in `America/New_York`), the earlier instant on an overlap (01:30 on the fall-back day) and `null` for a bad `time` | command | install |
| R11, R12, R13 | `validateDateTime` returns `required` with the first empty `field`, `invalid` for `2026-02-30`, `2026-13-01`, `24:00`, `9:5`, `tomorrow` and for a time in a gap (`field: "time"`), `past` for a time before and equal to `now`, and `{ ok: true, at }` one minute after; an overlapping time resolves to the earlier instant | command | install |
| R14, R15 | `validateFutureInstant` for `null`, `undefined`, `NaN`, `now - 1`, `now` and `now + 1`; `validateDateNotPast` for yesterday, today and tomorrow in the zone at an instant where the UTC date and the zone date differ, `2026-02-30` and `""` | command | install |
| R16 | `quickTimeChoices` at 10:42, 14:59:59, 15:00:00 and 23:30 in `Asia/Ho_Chi_Minh` returns three entries in the order `in1Hour`, `today1500`, `tomorrow0900`, with `in3Hours` in place of `today1500` from 15:00:00, and every `at` later than `now` | command | install |
| R17 | the delivered suite run with `TZ=UTC` and again with `TZ=Pacific/Auckland` passes and a fixed set of results is identical; `grep` finds no `Date.now` and no `new Date()` without an argument in the source files of the module | command | install, files |
| R18 | every name of R1 to R16 is exported from `@toki/shared`; `pnpm typecheck` and `pnpm lint` exit 0; `packages/shared/package.json` gains no entry in `dependencies` for the module | command | install, files |

None of the requirements is a by-eye comparison with the prototype, so the record has no `manual` row. The spec also holds two statements that are not requirements: the import form of the Layout (extensionless) and its `src/` placement of the tests. The delivered code uses `.js` import paths, as the plan of the ticket records, and the tests moved later; the result notes report both for the BA, without a row (concern 3).

### Layout
```
docs/
  qa/TOKI-094.md  TOKI-094.checks.sh  TOKI-094.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a source file in the temporary worktree (for example `15:05` changed to `03:05`) makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-094` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names, fixed instants and results only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need an install and a runtime, and must not change the repository | R3, R5, concern 2 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-094 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-094, or the current `main`? Answered: the merge commit, `73036185` (#152) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local tools they need, isolated from the repository? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The spec asks for the same results under two values of `TZ`. How does the QA run that without touching the machine's own settings? Answered: the environment variable is set for the one command in the temporary worktree (R17 of the spec of TOKI-094, row R17 above); the machine's settings are not changed. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-094 describe the repository when the ticket closed, and later tickets changed it (the tests moved to `packages/shared/tests/datetime/` in `0945b4e1`). Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `73036185` (#152), so the record proves the ticket as delivered; later changes are reported in result notes and not judged; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree and use the local tools it needs, with a `pnpm install` there, isolated from the repository, and removes them at the end (R5); the `TZ` runs of R17 set the variable for one command only; a row that cannot run for lack of a tool is `Blocked`. One person holds Dev, QA and BA and the role is named in each record. A failure stays in the record and the BA decides whether to reopen. Claude cannot read or create `.env` and no row needs it. No throwaway pull request is opened; if CI evidence is wanted, run history is read with read-only `gh`. Owner: Thanh Truong (QA).
3. Deviations of the delivered code from statements of the spec that are not requirements: the import paths end in `.js` where the Layout says extensionless (the plan of TOKI-094 records the choice and `pnpm typecheck` passes under `Bundler`), and the plan adds a limit on the range of an instant (plus or minus 8 640 000 000 000 000) that R7 does not name. Decided: the rows judge the requirements as written; the two points are reported in the result notes for the BA and give no row, and a row fails only if a requirement is not met. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
