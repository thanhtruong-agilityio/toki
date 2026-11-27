# QA of the destructive-action and unsaved-form patterns design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/destructive-patterns-qa.md (Thanh Truong)
Ticket: TOKI-131

## Goal
The builder, the QA and the BA need to know whether TOKI-093 (the destructive-action and unsaved-form patterns) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-093 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is ticket 11 of the 12 tickets of the Blueprint outcome I02 design-system; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of TOKI-008 (`docs/specs/2026-11-25-test-harness-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-093.md`, its checks script `docs/qa/TOKI-093.checks.sh` and its evidence file `docs/qa/TOKI-093.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-093, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-093 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-093; a row may point to a check that already runs.
  - What the spec of TOKI-093 itself leaves out: the call sites of the patterns, the connection state of TOKI-082, and TS-121 and TS-122 on the whole product. They are listed under `## Not covered` with that reason (R2).

## Requirements
- R1. `docs/qa/TOKI-093.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-093`, `Spec: docs/specs/2026-11-16-destructive-patterns-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-093` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-093 (R1 to R24) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-093` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-093.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-093.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. A row that runs the tests of TOKI-093 prints the number of test files and tests that passed and `Expected` names them, so a run that finds no test cannot pass. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with its own `pnpm install`, the Vitest runs of the packages `@toki/ui-web`, `@toki/web` and `@toki/i18n`, the Vite dev server of `apps/web` on a free port, and the headless Chromium installed by Playwright for the rows that need a browser. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. A row that cannot run for lack of a tool or a free port is `Blocked`. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-093, `420d129` (#151) (concern 1), and every row is judged at it. PR #151 delivered it; no later commit landed it again, and later commits only added to it. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it (the confirm row for the last member of a public channel of TOKI-035 and the row `restoreChannel` of TOKI-101, added to the table of actions, the tests moved by TOKI-015), without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I02. The record carries a result note that says which Success Criterion of I02 each row will feed (the `done` line: the Undo, the confirmation and the date-rule patterns exist), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-093 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-093, the files that TOKI-093 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-093 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-093 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-093 states. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior. The tests that TOKI-093 delivered are a source of evidence, not a verdict: a row runs them and also compares one fact of the spec with the code, so that a deleted test cannot make a row pass.

| TOKI-093 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1 | the folders hold the files the spec lists; `components/index.ts` and `examples.ts` gain one line each; `@toki/ui-web` exports `ConfirmDialog`, `ConfirmDialogProps`, `confirmVariants` and `confirmCancelReasons`; `patterns/index.ts` exports the thirteen names; the `ConfirmDialog` key is in `references.ts` | command | files |
| R2 | `apps/web` has a jsdom Vitest configuration and a setup file with the three things; its devDependencies use the `ui-web` versions; `pnpm --filter @toki/web test`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm i18n:check` exit 0, and `pnpm lint:boundaries` is run as the spec says (the script no longer exists on `main` and its absence at `V` is read from the commit) | command | install |
| R3, R8 | no source file of `ConfirmDialog` imports `@toki/i18n`, `@toki/platform` or `@toki/tokens`; with every text prop empty and a one-character target the `textContent` is that character; the CSS holds no colour literal, no custom property outside the 32 names and no `data-look`, `data-scheme`, `data-accent` or `data-density` selector (was `data-eff`); the CSS holds exactly the three rules of Table C | command | install, files |
| R4, R5, R6, R7 | the dialog is one `Modal` with the class `cfm`, no close button, one `.mbd` and one `.mft` as siblings, `aria-describedby`, `p.cfm-text` and `p.cfm-target strong`; a blank target throws under Vitest and renders nothing with a logged error when `DEV` is false; first focus on Cancel; the reasons `cancel`, `escape` and `outside`; confirm once; `busy` disables both buttons, ignores Esc and outside press, sets `aria-busy` and moves focus to the panel | command | install |
| R9 | the five examples `delete-message`, `archive-channel`, `notify-channel`, `busy` and `long-target` exist, each with its own return ref; the `ConfirmDialog` reference value starts with `none:` | command | install |
| R10, R11 | `actionPatterns` holds exactly the 18 rows of Table A (id, pattern, source, owner) at `V`; the three sets are disjoint and cover `ActionId`; a confirm id given to `run` and an undo id given to `ConfirmAction` are type errors found by `pnpm typecheck`; with the types cast away `run` throws synchronously and `ConfirmAction` throws in render, the message holding the id and the pattern; no file of `apps/web/src` outside `patterns/` imports `ConfirmDialog` | command | install |
| R12, R13, R14, R15, R16 | `useUndo().run` resolves `"done"`, `"failed"` or `"blocked"` in the order of the spec; the Undo toast is there 1 ms before 5000 ms and gone at 5000 ms with fake timers; `useUndo.ts` calls no timer function; a later call with the same key dismisses the earlier toast; 60 keys leave at most 50 entries; an Undo still works after the starting component unmounts; `run` keeps its identity; an offline Undo shows `common.offline.undoBlocked` and calls nothing | command | install |
| R17, R18 | `setConnectionCheck` with `true`, `false`, a throwing function and `null`; the default returns `false` only when `navigator.onLine` is `false`; `ensureOnline()` and `ensureOnline("undo")` show their own texts; offline `ConfirmAction` does not call `onConfirm`, keeps the dialog open and shows the toast | command | install |
| R19, R20, R21, R22, R23 | `hasFormContent` on the table of values of the spec; with no content every reason closes at once; with content an outside press does nothing, `close` and Esc ask (`GUARD_ESCAPE` is `"ask"`, and `"ignore"` does nothing); Keep editing returns focus to the last field, also when the `body` had focus; Discard calls `onClose("discard")` once; the first Esc closes the question and keeps the form; unmounting leaves no extra child and no `inert`; the guard keeps no timer and no storage | command | install |
| R24 | both `common` catalogues hold the ten keys with the texts of Table B and are listed in both `index.ts`; `pnpm i18n:check` exits 0 | command | install, files |
| R4 to R9 (look) | in Chromium at 360 px and at 1280 px on the preview page of the temporary worktree, each button of the dialog is at least 40 px tall at 719 px and below, the dialog fits the panel, and the 120-character target wraps without horizontal overflow | command | install, browser, runs Vite |
| R8 (look) | the dialog at 360 px in both looks, compared by eye with the look of the design system | manual | QA's eyes |

A requirement that is only a by-eye comparison with the prototype is a `manual` row for the QA and stays `Blocked` until the QA pastes the result; it is never `Pass` without it (concern 3). The prototype has no confirmation dialog (R9 of the spec), so the manual row compares the look with the neighbouring dialogs of the preview page, not with a prototype screen.

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1). Two are known to differ, and the rows still judge them at `V`: the table of actions has grown past 18 rows (R10), and `pnpm lint:boundaries` is not a script at `V`, because TOKI-002 dropped it on 2026-11-17 (R2); the spec of TOKI-093 still names it, so that row is expected to Fail at `V` and stays in the record (concern 4).

### Not covered
- TS-121 and TS-122 on the whole product, the end-to-end behaviour of a real call site and D-079 on a network that is up but cut off from the server: the spec of TOKI-093 says these are tested by the call-site tickets and by TOKI-082 ("Not tested here"). The record lists them with that reason.
- What a screen reader announces for the confirmation: the spec leaves it open (its concern 12).

### Layout
```
docs/
  qa/TOKI-093.md  TOKI-093.checks.sh  TOKI-093.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file (a pattern flipped in `actions.ts`, a timer added to `useUndo.ts`) makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-093` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal. TOKI-093 stores nothing, so the rows touch no development data.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concerns 1 and 4 |
| Rows need an install, a browser or a free port, and must not change the repository | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; a by-eye requirement is a manual row; no secret or personal data | R3, R4, R10, Design (manual row), Data safety |
| The merged intent and spec of TOKI-093 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-093, or the current `main`? Answered: the merge commit, `420d129` (#151) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The spec asks for a look at 360 px against the prototype and for behaviour in a browser. Which rows can a command decide, and which are left to the QA? Answered: a command row drives Chromium with Playwright against the dev app of the temporary worktree for what can be measured (button height, overflow, fit); a requirement that is only a by-eye comparison is a `manual` row for the QA, Blocked until the QA pastes the result, never Pass. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-093 describe the repository when the ticket closed, and later tickets changed it: TOKI-035 and TOKI-101 added rows to the table of actions, and TOKI-015 moved the tests. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `420d129` (#151), so the record proves the ticket as delivered; later changes are reported in the result notes and not judged; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree of `V`, run `pnpm install` there, and use the local tools, the cached Chromium of Playwright and free ports that its rows need, isolated from the repository, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. Owner: Thanh Truong (QA).
3. Browser and by-eye rows. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: where the spec states a measurable fact (a button of at least 40 px at 719 px and below, a long target that wraps without overflow) the row is a `command` row that drives Chromium with Playwright against the dev app of the temporary worktree; a requirement that is only a by-eye comparison (the look at 360 px in both looks) is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass`. Owner: Thanh Truong (QA).
4. A requirement that no longer holds at the commit. The spec of TOKI-093 R2 asks for `pnpm lint:boundaries` to exit 0; the script was dropped by TOKI-002 on 2026-11-17, before the delivery of TOKI-093, and the spec was not amended. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the row compares what the spec states and Fails at `V`; the failure stays in the record, and the BA decides whether to reopen the ticket or amend its spec. Owner: Thanh Truong (BA).
