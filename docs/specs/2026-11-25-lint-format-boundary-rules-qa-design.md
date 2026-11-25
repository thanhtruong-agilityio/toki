# QA of the lint, format and package boundary rules design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/lint-format-boundary-rules-qa.md (Thanh Truong)
Ticket: TOKI-113

## Goal
The builder, the QA and the BA need to know whether TOKI-002 (ESLint, Prettier and the package boundary rules) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-002 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is one of the eight QA tickets for the Blueprint outcome I01 repo-foundation; the acceptance of I01 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of TOKI-001 (`docs/specs/2026-11-25-monorepo-typescript-setup-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-002.md`, its checks script `docs/qa/TOKI-002.checks.sh` and its evidence file `docs/qa/TOKI-002.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I01 and the acceptance record of I01.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-002, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-002 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-002; a row may point to a check that already runs.

## Requirements
- R1. `docs/qa/TOKI-002.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-002`, `Spec: docs/specs/2026-11-12-lint-format-boundary-rules-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-002` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-002 (R1 to R17) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-002` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-002.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool, a service or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-002.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit, in which `pnpm install` and `pnpm lint` run; rows that add a violating file or an inline comment change that worktree only and restore it. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-002, `6e7f0fa` (#77) (concern 1), and every row is judged at it. PR #68 delivered the first version and PR #70 reverted it; PR #77 re-landed it, so the merge commit of the delivery that stands is `6e7f0fa`. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it, without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I01. The record carries a result note that says which Success Criterion of I01 each row will feed (the `done` line: `pnpm dev` runs, CI is green, lint blocks a package-boundary violation), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-002 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-002, the files that TOKI-002 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-002 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-002 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-002 states. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior.

| TOKI-002 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R13, R14 | `pnpm lint` exits 0 on the clean tree, ignores build output; every violation is an `error`, and a warning also fails the run; the ESLint config carries the comment about file picking | command | install |
| R2, R3, R4 | `pnpm format:check` exits 0 on the clean tree; a badly formatted covered file makes it exit non-zero and be named; `pnpm format` then makes it pass and `pnpm lint` reports no formatting error | command | install |
| R5 | each banned global (`window`, `document`, `localStorage`, `navigator`, `location`, `matchMedia`, and the access forms) in each of the five packages makes `pnpm lint` fail naming the rule; the allowed globals pass; the row prints how many cases fired out of how many were tried | command | install |
| R6 | each banned import (`react-dom` and its subpaths, `@toki/ui-web` and its subpaths, a relative path into `packages/ui-web`) in those packages fails | command | install |
| R7, R8, R17 | a server module importing a file of another module fails; each import form of another module's public entry passes; a file outside `modules/` importing a module's inner file fails | command | install |
| R9, R10 | `packages/ui-web` using a notification, storage, service worker or audio API directly (each form), or rendering `<audio>`, fails; the same features through `platform` pass | command | install |
| R15 | `eslint --print-config` for the listed paths shows the boundary rules | command | install |
| R16 | `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line`, `/* eslint ...: off */` and `/* global ... */` have no effect in a covered path and make `pnpm lint` fail naming the file and the line | command | install |
| R11 | Not a row of its own: it asks that each boundary rule be shown to fire once, by hand, when it was built; rows R5 to R9, R16 and R17 above do that again at the commit. Entry under `## Not covered` | - | - |
| R12 | Dropped in the spec; entry under `## Not covered` | - | - |

The spec of TOKI-002 was revised by PR #252, merged on 2026-11-25, long after the code; a requirement of the revised text that the code of `6e7f0fa` does not meet is a Fail with that note, and the BA decides.

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1).

### Layout
```
docs/
  qa/TOKI-002.md  TOKI-002.checks.sh  TOKI-002.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-002` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need installs, services, a browser or a database, and must not change the repository or the development data | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-002 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-002, or the current `main`? Answered: the merge commit, `6e7f0fa` (#77) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local services, browser and ports that the rows need, isolated from the development data? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The spec revision PR #252 was merged after the code, and PR #68 was reverted and re-landed as PR #77. Which commit is the delivery, and what if the revised spec asks for more than the code did? Answered: the delivery is the merge commit of PR #77, `6e7f0fa`; a requirement of the revised text that this commit does not meet is a Fail with the note, and the BA decides. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-002 describe the repository when the ticket closed, and later tickets changed it. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `6e7f0fa` (#77), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I01. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree and use the local services, browser and ports that its rows need, isolated from the development data, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. Owner: Thanh Truong (QA).
3. The delivery and the revised spec. TOKI-002 was merged (PR #68), reverted (PR #70) and re-landed (PR #77), and its spec was revised by PR #252 on 2026-11-25. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at `6e7f0fa` (PR #77); a requirement of the revised spec that the code of that commit does not meet fails with a note in the result notes, and the BA decides whether to reopen or to amend the spec. Owner: Thanh Truong (QA).
