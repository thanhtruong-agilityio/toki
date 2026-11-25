# QA of the overlays design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/overlays-qa.md (Thanh Truong)
Ticket: TOKI-126

## Goal
The builder, the QA and the BA need to know whether TOKI-014 (the overlays: Menu, Modal and Sheet of `ui-web`) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-014 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is ticket 6 of 12 of the Blueprint outcome I02 design-system; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of the test harness (`docs/specs/2026-11-25-test-harness-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-014.md`, its checks script `docs/qa/TOKI-014.checks.sh` and its evidence file `docs/qa/TOKI-014.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-014, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-014 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-014; a row may point to a test that already runs, by name.

## Requirements
- R1. `docs/qa/TOKI-014.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-014`, `Spec: docs/specs/2026-11-16-overlays-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-014` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-014 (R1 to R34) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-014` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-014.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-014.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. A row that runs the tests of the ticket names the test files and counts the tests it ran, and, where a small probe of its own can show the same behavior (a search of the files, a call of `computeMenuPosition`, a Chromium script), the row uses the probe, so that a Pass does not rest only on the ticket's own tests. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with an install made in it, a headless Chromium installed by Playwright in the worktree, a throw-away page in the worktree that imports the examples of the three components (the preview page of TOKI-016 does not exist at `V`), and a Vite server on a free port. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-014, `71cb9085` (#145) (concern 1), and every row is judged at it. PR #145 delivered it: it adds `Menu`, `Modal`, `Sheet` and `src/internal/overlays` to `packages/ui-web` and no later commit landed the same files again. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it (for example the move of the unit tests into a `tests` folder, TOKI-015), without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I02. The record carries a result note that says which Success Criterion of I02 each row will feed, without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-014 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-014, the files that TOKI-014 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-014 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-014 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-014 states. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior. The spec has 34 requirements; they fall into 12 groups.

| TOKI-014 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R2, R3, R31 | the 21 names are exported from `src/components/index.ts` and from the package; `ref` targets, `className` order and owned attributes; no source file of the three folders or of `src/internal/overlays` holds a word of its own or imports `@toki/i18n`, `@toki/platform`, `@toki/tokens`, `@toki/client-core` or `@toki/shared`; `pnpm --filter @toki/ui-web test`, `lint`, `lint:boundaries`, `format:check` and `typecheck` exit 0 | command | files, install |
| R4, R33 | an open then closed or unmounted layer leaves `document.body` with no new child, no scroll lock, no `inert`, no layer listener on `document`; the steps on open and close run in the order of R33 | command | install |
| R5, R6, R7 | the DOM of `Modal` in both forms (with `title`, with a label only) and of `Sheet` (classes `scrim sheet`, same behavior); the props `initialFocusRef`, `backdrop`, `returnFocus`, `returnFocusRef` and `footer` and their defaults | command | install |
| R8, R9, R10 | `onRequestClose` with `"escape"`, `"outside"` and `"close"`; a press that begins in the panel and ends on the scrim gives no request; with three layers three Esc presses ask Menu, then B, then A, and the event is stopped; one press closes one layer; Esc during composition is ignored | command | install |
| R11, R12, R13, R16 | first focus by `initialFocusRef`, then `data-autofocus`, then the first tabbable, then the panel; Tab and Shift+Tab wrap and a panel with no tabbable element keeps focus; focus returns to the opener or to `returnFocusRef`, not when `returnFocus` is `false` or the opener is gone; a dialog that cannot be dismissed stays open | command | install |
| R14, R15, R34 | `body.style.overflow` is `hidden` through two dialogs and restored after the last, and a Menu does not lock; `backdrop="opaque"` sets `inert` and `aria-hidden` on the other children of `body` and restores them, `dim` sets nothing; an element with `data-layer-skip` and its containers are not isolated | command | install |
| R17, R18, R19, R20, R21, R22, R24 | the Menu's DOM and roles; items and groups; first focus, arrow, Home, End and wrap keys with disabled items visited; `onClick` before `onClose("select")` and focus on the anchor; `preventDefault` keeps it open; `onClose` with `"escape"`, `"tab"`, `"outside"`; `useMenuTrigger` props and ArrowDown and ArrowUp | command | install |
| R23 | `computeMenuPosition` for below and right-aligned, left-aligned, flipped above, clamped left and right, taller than the window and a zero rectangle (`top` 4, `left` 8); the Menu's inline `left` and `top` change after a `resize` | command | install |
| R25, R26, R27, R28 | the three CSS files hold exactly the rules of Tables A to D; only `var(--…)` colours naming one of the 32 tokens, no `transition` or `animation`, `font-family` only in `.modal .mhd h2`; every `:hover` declares only `background`; the `z-index` values 20, 30 and, when `Toast.css` exists at `V`, 40 | command | files |
| R29 | in headless Chromium on the throw-away page, at 360 x 560, 719, 720, 1099 and 1100 px in Calm and Focus: Menu items and the close button at least 40 px tall at 719 px or less, a long Modal body scrolls inside the panel with the header in view, the panel is not taller than the window, the Sheet sits on the bottom edge at full width, the Menu stays inside the window. The likeness to the prototype is a `manual` row (concern 2) | command, manual | install, browser |
| R30 | the three examples files export 13 examples with the ids of R30, unique within a component; each opens with its button and, but for `opaque` and `no-close`, Esc returns focus to the button | command | install |
| R32 | `pnpm typecheck` passes with the 11 `// @ts-expect-error` lines, and removing one line of a copy makes it fail, so no line is vacuous | command | install |

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1). The prototype's CSS is not in the repository (spec of TOKI-014, concern 10), so a row proves the CSS equals the tables of the spec and not the prototype.

### Layout
```
docs/
  qa/TOKI-014.md  TOKI-014.checks.sh  TOKI-014.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file in the temporary worktree (a changed `z-index`, a removed `inert`) makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-014` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names, widths, rectangles and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal. The examples hold demo words only.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need an install, a browser and ports, and must not change the repository; a likeness by eye is not a command | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-014 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-014, or the current `main`? Answered: the merge commit, `71cb9085` (#145) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree, an install in it, the local Chromium and free ports, isolated from the repository? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The spec asks for a check in a browser at five widths and in two looks, and for a likeness to the prototype, which is not in the repository. Which of this is a command and which is a person's check? Answered: the sizes, the scrolling and the placement are a command that drives Chromium with Playwright against the dev app of the temporary worktree; a requirement that is only a comparison by eye with the prototype is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass`. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-014 describe the repository when the ticket closed, and later tickets changed it (TOKI-015 moved the unit tests into a `tests` folder; TOKI-016 added the preview page). Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `71cb9085` (#145), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree, make an install in it, and use the cached Chromium of Playwright and free local ports, isolated from the repository, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. One person holds Dev, QA and BA and the role is named in each record. Owner: Thanh Truong (QA).
3. Browser and visual requirements. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the check of R29 is a command row that drives Chromium with Playwright against the dev app of the temporary worktree, on a throw-away page that imports the examples because the preview page does not exist at `V`; a requirement that is only a by-eye comparison with the prototype (the look in Calm and Focus) is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass`. Owner: Thanh Truong (QA).
4. A failure stays in the record. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the record keeps a failing row and says why; the BA decides whether to reopen TOKI-014 or amend its spec (R10). No throw-away pull request is opened to get evidence; if a row needs the history of CI, it is read with read-only `gh`. Claude can neither read nor create `.env`. Owner: Thanh Truong (BA).
