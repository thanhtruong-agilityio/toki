# QA of the icon set design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/icon-set-qa.md (Thanh Truong)
Ticket: TOKI-123

## Goal
The builder, the QA and the BA need to know whether TOKI-011 (the 43 icon components of `@toki/ui-web`) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-011 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is the third of the twelve tickets of the Blueprint outcome I02 design-system; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of TOKI-008 (`docs/specs/2026-11-25-test-harness-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-011.md`, its checks script `docs/qa/TOKI-011.checks.sh` and its evidence file `docs/qa/TOKI-011.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-011, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-011 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-011; a row may point to a check that already runs.

## Requirements
- R1. `docs/qa/TOKI-011.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-011`, `Spec: docs/specs/2026-11-16-icon-set-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-011` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-011 (R1 to R16) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-011` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-011.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-011.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked (for example 43 names) and its `Expected` requires at least one. A requirement that only a person can judge by eye, the look of the icons next to the prototype, is a `manual` row for the QA: it is `Blocked` until the QA pastes the result, never `Pass`. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with its own `pnpm install`, and, for the row that draws the icons in a browser, a headless Chromium driven by Playwright (the cached one, or installed in the temporary worktree) against the dev app of the temporary worktree on a free port. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. A row that cannot run for lack of a tool or a free port is `Blocked`. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-011, `5d8f49a` (#133) (concern 1), and every row is judged at it. PR #133 delivered it: it adds `packages/ui-web/src/icons/` (`paths.ts`, `icon-base.tsx`, `icons.tsx`, `index.ts`, `icons.test.tsx`), the dependencies and test script of `packages/ui-web/package.json`, its `tsconfig.json`, and the export in `src/index.ts`. No later commit re-landed it. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it (for example the tests moved to a tests folder in TOKI-015, and TOKI-012 and later tickets add exports to `ui-web`), without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I02. The record carries a result note that says which Success Criterion of I02 each row will feed, without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-011 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-011, the files that TOKI-011 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-011 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-011 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-011 states. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior. The nine groups cover all 16 requirements of TOKI-011.

| TOKI-011 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R2, R9, R10, R16 | the icons module exports exactly the 43 `<Name>Icon` components of Table A plus `Icon`, `iconNames` and the types; `iconNames` holds the 43 names in the order of Table A; none of the 32 left-out names has an export or an entry in `paths.ts`; every export other than `iconNames` is named `Icon` or ends in `Icon`, and no other export ends in `Icon`; the count printed is 43 and 32 | command | install, files |
| R3, R4, R5 | rendering with `renderToStaticMarkup` for each of the 43 names gives one `svg` with exactly the ten attributes of R4 and one `path`; `<Icon name=... />` equals the named component; `size`, `strokeWidth`, `className` and `data-testid` are applied and a cast `stroke`, `fill`, `viewBox` or `role` does not override the owned attributes | command | install |
| R6 | no non-test source file of `src/icons` has `#`, `rgb(`, `hsl(` or an import of `@toki/tokens` | command | files |
| R7, R15 | `aria-hidden="true"` always; passing `aria-label`, `title`, `children`, `aria-hidden`, `stroke`, `viewBox` or `role` is a type error at `pnpm typecheck` (a copy of the file with one such prop must fail), and `size`, `strokeWidth`, `className` and `data-testid` typecheck | command | install, typecheck |
| R8 | every path in `paths.ts` equals the path of the same name in the prototype's icon table (the later entry for `left`, `right` and `play`), 43 compared; the prototype file is not in the repository at `V` (concern 4), so the row is `Blocked` until the QA supplies it | command | the prototype file |
| R11 | `package.json` has `"sideEffects": ["**/*.css"]` and `exports` is the single entry `".": "./src/index.ts"`; `src/index.ts` re-exports `./icons`; the top-level statements of `icons.tsx` are imports and `export const` only | command | files |
| R12, R13 | `pnpm install`, root `pnpm typecheck`, `pnpm --filter @toki/ui-web test`, `pnpm lint` and `pnpm format:check` exit 0 and no file of `packages/ui-web/src` uses a banned platform API; `pnpm lint:boundaries` is named by R13 but the script was dropped by a spec change of TOKI-002 and is absent at `V`, so the row reports the exit code of the command that exists and the result notes say what changed, without judging it | command | install |
| R14 | no `@toki/ui-web` in `apps/web/package.json` and no import of it in `apps/web/src` | command | files |
| R4, R5, R6 (the look) | the 43 icons drawn in Chromium by Playwright, in Calm and Focus, take the colour of their parent and the size of the prop; the comparison with the prototype's look is by eye (the preview page of TOKI-016 does not exist at `V`) and is a `manual` row | command and manual | install, browser, free port, the prototype |

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1).

### Layout
```
docs/
  qa/TOKI-011.md  TOKI-011.checks.sh  TOKI-011.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file (one path changed, one export added, one colour literal added) makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-011` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names and exit codes only. The icons use no data, names or addresses. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need an install, a browser or a port, and must not change the repository | R3, R5, concern 2 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; a by-eye comparison is a manual row; no secret or personal data | R3, R4, R10, Data safety, concern 4 |
| The merged intent and spec of TOKI-011 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-011, or the current `main`? Answered: the merge commit, `5d8f49a` (#133) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need, isolated from the repository? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- R8 of TOKI-011 compares the paths with the prototype's icon table, and the look is compared with the prototype. The prototype file is not in the repository at the delivery commit or on `main`. Where do the rows read it, and who judges the look? Answered: the look is a manual row for the QA (R3) and R8 is `Blocked`, because the prototype is not a file of the tree. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 4.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-011 describe the repository when the ticket closed, and later tickets changed it. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `5d8f49a` (#133), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree, run `pnpm install` there and use the local tools, the cached Chromium with Playwright and free local ports that its rows need, isolated, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. Owner: Thanh Truong (QA).
3. Roles and failures. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: one person holds Dev, QA and BA and the record names the role in each place; a failure stays in the record and the BA decides whether to reopen the ticket or amend its spec (R10). No throwaway pull request is opened, and Claude reads no `.env` file; CI evidence, if a row needs it, is read from the run history with read-only `gh`. Owner: Thanh Truong (QA).
4. The prototype file and the look. R8 and the comparison of the look need the prototype's HTML (`docs/blueprint/prototype/index.html` in the spec of TOKI-011). That file was added and then removed from the repository before `5d8f49a`, so it is not in the tree at `V` and not on `main`. Decided: the look is a manual row for the QA, `Blocked` until the QA pastes the result, never `Pass`. Decided: the R8 row stays `Blocked`; it is not run with a file supplied from outside the commit, so it is not judged at `V`, and it never becomes `Pass` without a prototype at `V`. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (QA).
