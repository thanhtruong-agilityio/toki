# QA of the base components, group 2 design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/base-components-2-qa.md (Thanh Truong)
Ticket: TOKI-125

## Goal
The builder, the QA and the BA need to know whether TOKI-013 (the Avatar, the presence dot, the empty state and the Toast of `ui-web`) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-013 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is the fifth of the twelve tickets of the Blueprint outcome I02 design-system; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of TOKI-008 (`docs/specs/2026-11-25-test-harness-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-013.md`, its checks script `docs/qa/TOKI-013.checks.sh` and its evidence file `docs/qa/TOKI-013.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-013, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-013 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-013; a row may point to a test that already exists at the commit and run it.

## Requirements
- R1. `docs/qa/TOKI-013.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-013`, `Spec: docs/specs/2026-11-16-base-components-2-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-013` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-013 (R1 to R34, 34 in all) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-013` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-013.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool, an install or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-013.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. A row that runs the tests of the ticket names the test file and the test names it relies on and prints how many passed. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with `pnpm install` run there, the unit tests of `ui-web`, the Vite dev server on a free port, and a headless Chromium driven by Playwright (from the cache or installed in the worktree) for the rows that need a browser. The temporary page that those rows need (a flex-column parent with an `EmptyState`; a test composer, bar and sidebar with the toasts, R29 of the spec) is written inside the temporary worktree only. The script prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-013, `845725a` (#142) (concern 1), and every row is judged at it. PR #142 delivered it: it adds the four component folders and no later commit re-landed them. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it (for example the unit tests were moved into a tests folder by TOKI-015, so the spec's "a test file next to each component" holds at `845725a` only), without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I02. The record carries a result note that says which Success Criterion of I02 each row will feed (every base component matches the prototype in Calm and Focus; the M1 exit check of the preview page), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-013 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-013, the files that TOKI-013 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-013 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-013 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-013 states. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior. All 34 requirements are in the table, so nothing is planned under `## Not covered`. A requirement that the spec itself says is checked by a person (the comparison with the prototype, the phone with its keyboard, the screen reader) is a `manual` row for the QA: Blocked until the QA records the result and its evidence, never Pass.

| TOKI-013 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R2 | each of the four folders under `packages/ui-web/src/components/` has its `.tsx`, `.css`, `.test.tsx`, `.examples.tsx` and `index.ts` and no other file than the named helpers; `components/index.ts` has one `export *` line for each folder; `src/index.ts` is not changed by the delivering PR; each of the 20 names of R2 is exported | command | files |
| R3 | the non-test, non-examples source files of the four folders import no `@toki/i18n`, `@toki/tokens` or `@toki/platform` and use no notification, storage, service worker or audio API; the four `.css` files hold no colour literal and no custom property outside the 32 names of TOKI-009 R10, `--h` and `--s`; each component rendered with no text props has an empty `textContent` | command | files, install |
| R4 | each of the five components uses `forwardRef`; the test of the owned attributes and of `ref` and `className` passes; `pnpm --filter @toki/ui-web typecheck` exits 0 with the `@ts-expect-error` lines in place | command | install |
| R5 | `package.json` of `ui-web` gains no dependency between the first parent of `845725a` and `845725a`; `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check` and `pnpm --filter @toki/ui-web test` each exit 0 | command | install |
| R6, R7, R8, R10 | the Avatar and `getInitials` tests: markup, `--h` and `--s`, the nine sample names of the spec including `"Ông Ba"` giving `ÔB`, hue modulo 360, size fallback, `presence` wrapper, merged `style`, removed `aria-label`, `ref` on the wrapper; each result is read from the run, and a mutated copy of `getInitials` makes the matching row fail | command | install |
| R11, R12, R14 | `presenceStates` is `["active","away","dnd"]`; the dot's classes for each state; `role="img"` and `aria-label` with a `label`, `aria-hidden="true"` without; `presenceLabel` of `Avatar` reaches the dot | command | install |
| R15, R18 | `EmptyState` renders `div.eic`, `b`, `span` and the `action` node in this order; `filtered` gives `role="status"` and no `filtered` gives none; a caller's `role` is dropped; the props omit `title` and `children`; `ref` is `div.empty`; no text and no button of its own | command | install |
| R19, R21, R22, R23, R24, R25, R26 | the Toast, provider and timer tests with fake timers: no `role` on a toast, `aria-live="polite"` on the region with no toast, `show` and `dismiss` stable and one render of a caller, the error naming `ToastProvider`, removal at 4999 and 5000 ms with a button and at 2799 and 2800 ms without, the pause on pointer and focus, removal before `onPress` and one call, the order, the cap of three and no `onPress` for the dropped toast, no warning after unmount | command | install |
| R27, R28, R31, R34 | the tests of `computeToastBottom`, `computeToastExtent` (331.2 at 360 px; 276 for an anchor of 300 px), the registered-element measuring (stubs for `getBoundingClientRect` and `ResizeObserver`, `transitionend`) and the `visualViewport` stub: larger of the two values, not their sum, in both orders | command | install |
| R30 | the examples of the four folders hold the cases the spec lists, the ids are unique within a component, `src/examples.ts` has the four entries in the order of the spec after group 1's, and the test of TOKI-012 for the examples passes | command | install |
| R9, R13, R16, R20, R21, R32, R33 | the declaration list of each named rule in `Avatar.css`, `PresenceDot.css`, `EmptyState.css` and `Toast.css` is read at `V` and compared with the list in the requirement, including the `@media (max-width: 719px)` block, the focus-visible rule and the `.toasts` declarations | command | files |
| R17, R29 | Chromium with Playwright, against the dev server of the temporary worktree with the temporary page, in Calm and Focus: at 360, 720 and 1100 px the centre of the `EmptyState` content is within 1 px of the centre of a flex-column parent of 600 px; at 360, 720, 800, 1099 and 1100 px with three toasts, no toast box intersects the composer, the bar or the sidebar, ends above their tops, and comes down after the bar is hidden by a transform | command | install, Chromium, free port |
| R9, R13, R16, R20 (by eye); R19 (screen reader); R34 (phone) | the QA compares each component with the prototype in Calm and Focus, at both densities and with the four accents; checks with VoiceOver and NVDA that a toast added later is announced once; checks on a phone or emulator with the keyboard open that the toasts stay above it. The QA pastes the result and the evidence | manual | the QA, a screen reader, a device |

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1).

### Layout
```
docs/
  qa/TOKI-013.md  TOKI-013.checks.sh  TOKI-013.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file (the initials function, a CSS declaration, the timer constant) makes the matching row fail, so a row is not vacuous. A row that relies on a test of the ticket also states how many tests ran, so a test file that is skipped or empty cannot give a Pass.
- The browser rows are run twice and compared; a row that fails once and passes once is reported as it is, with both lines kept.
- The worked run is the test: `qa-ready.sh TOKI-013` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record. The manual rows stay Blocked until the QA pastes a result.

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal. The names in the rows are the prototype's sample people, not real accounts.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need an install, a browser or local ports, and must not change the repository; the temporary page is never committed | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-013 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-013, or the current `main`? Answered: the merge commit, `845725a` (#142) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need, isolated from the development data? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- Which requirements are checked by a command and which only by a person? Answered: the browser requirements (R17, R29) are command rows that drive Chromium with Playwright against the dev app of the temporary worktree; a requirement that is only a comparison with the prototype by eye, a screen reader check or a phone check is a `manual` row for the QA, Blocked until the QA pastes the result, never Pass (Design). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-013 describe the repository when the ticket closed, and later tickets changed it. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `845725a` (#142), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree of `845725a`, run `pnpm install` there, and use the local tools, the cached Chromium and Playwright and free local ports, isolated from the development data, and removes them at the end (R5); a row that cannot run for lack of a tool or a port is `Blocked`. Owner: Thanh Truong (QA).
3. Browser rows and by-eye rows. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: R17 and R29 of the spec of TOKI-013 are command rows that drive Chromium with Playwright against the temporary page of the temporary worktree, with free ports; the comparison with the prototype, the screen reader check and the phone check are `manual` rows for the QA, Blocked until the QA pastes the result, never Pass. Owner: Thanh Truong (QA).
4. Who holds the roles and what a failure does. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: one person holds Dev, QA and BA and the role is named in each record; a failure stays in the record and the BA decides whether to reopen the ticket; Claude cannot read or create `.env`, and no throwaway pull request is opened, so CI evidence, if a row needs it, is read with read-only `gh` run history. Owner: Thanh Truong (BA).
