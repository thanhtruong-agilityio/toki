# QA of the AppShell in three layouts design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/app-shell-qa.md (Thanh Truong)
Ticket: TOKI-127

## Goal
The builder, the QA and the BA need to know whether TOKI-015 (the AppShell in three layouts) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-015 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is ticket 7 of the 12 tickets of the Blueprint outcome I02 design-system; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of the web skeleton (`docs/specs/2026-11-25-web-skeleton-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-015.md`, its checks script `docs/qa/TOKI-015.checks.sh` and its evidence file `docs/qa/TOKI-015.evidence.txt` (R1 to R7).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-015, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-015 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-015; a row may point to a check that already runs.
  - A real phone (concern 16 of the spec of TOKI-015): the browser rows use headless Chromium.

## Requirements
- R1. `docs/qa/TOKI-015.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-015`, `Spec: docs/specs/2026-11-16-app-shell-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-015` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-015 (R1 to R36) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors (a width, a look, a key) is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-015` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-015.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool, a dev server or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, pixel values, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-015.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops (a width, a look, a section) prints how many items it checked and its `Expected` requires at least one. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. A requirement that only a person can judge by eye is a `manual` row: it is `Blocked` until the QA runs it and pastes the result (the table of twelve rows of the spec of TOKI-015, Testing, and the screen reader and keyboard pass), and Claude never marks it `Pass`. Check: no `Result` without `Approved`, as `qa-ready.sh` reports; no `manual` row is `Pass` without a pasted result.
- R5. The checks script uses only a temporary worktree of the commit with a fresh `pnpm install` in it, the Vite dev server of that worktree on a free port, and a headless Chromium driven with Playwright from the cached browsers, for every row that needs a browser (rectangles, computed styles, focus, toasts). The rows that run the ticket's own browser test `e2e/app-shell.spec.ts` or the root `pnpm test:e2e` run only when the ports that the Playwright configuration fixes (5173 for the web app) are free, and are `Blocked` otherwise; the script never stops a process it did not start. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-015, `2c3330ef` (#157) (concern 1), and every row is judged at it. PR #157 delivered the code (the AppShell and its parts under `packages/ui-web/src/layout`, the utilities, `applyAppearance`, `apps/web/src/routes/app-layout.tsx`, the fixture and `e2e/app-shell.spec.ts`); no later commit on `main` touches those files, and the spec's own pull requests (#41 and #141) carry the spec only. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it, without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I02. The record carries a result note that says which Success Criterion of I02 each row will feed, without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-015 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-015, the files that TOKI-015 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-015 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-015 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-015 states, with its tolerance of 1 px for a measurement. A browser row drives Chromium with Playwright against the dev app of the temporary worktree (the fixture page `shell-fixture.html`, as the spec's "the fixture") and prints the measured numbers. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior, width and look.

| TOKI-015 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R2, R34 | the export list of `@toki/ui-web` holds the 14 names and `applyAppearance`, and the `./utilities.css` export exists; no file of the shell imports `@toki/i18n`, `@toki/platform` or `@toki/client-core`; each component renders no text with empty text props; each of the seven components forwards `ref` to the root the spec names | command | files, install, runs the unit tests |
| R3, R4 | the root `div.app` holds sidebar, list, main and panel in the stated order and with the stated classes; `derivePane` returns the stated value for all 16 inputs; `data-section`, `data-pane`, `data-chat-open`, `data-panel` are set as stated | command | install |
| R5, R6, R7, R9 | one `a.ni` for each section in order; the Ctrl, Meta, Shift and Alt click and Enter and Space behave as stated; the bottom bar draws the `tab` sections and the More button only with `moreTab`; a badge shows for 1 and 100 and not for 0, -1, `NaN`, missing; the shell renders no dialog or sheet | command | install |
| R8 | `WorkspaceHeader` draws `span.wsl` with the first code point upper-cased, `div.wsn`, and `div.wss` only with `detail`; nothing with no `workspace`; in the browser the avatar and text widths match the spec | command | install, browser |
| R11, R12, R13, R14 | `SidePanel`, `SectionPage`, `TabList` and `Tab` render the stated markup and roles; both buttons of the panel call `onClose`; ArrowRight, ArrowLeft, Home, End move focus and wrap without selecting; Enter, Space and a click select; other keys do nothing | command | install |
| R15 | the pane bodies are flex columns with `min-height:0` and the stated overflow, and an `EmptyState` centres in the free area (rectangle test in the fixture) | command | install, browser |
| R16, R17, R24, R26, R27 | `shell.css`, `utilities.css` and `app.css` hold exactly the selectors and declarations of Tables C to I of the spec (the script parses the tables of the spec and the CSS and compares the sets); the four media conditions are the stated ones; no `@container`, `!important`, colour literal, unknown custom property or `--tabh` read outside `.app`; no `opacity:0` or `display:none` in a `:hover` rule; `utilities.css` is imported only by `main.tsx`, after the base CSS | command | files |
| R18 | Calm at 1100 and 720: sidebar 272 px, main starts at x 272, 12 px margins; Focus at 1100 and 720: rail 68 px, conversation column ends at 356; the 956 and 1400 widths as the spec's Table J states | command | install, browser |
| R19 | at 720, 800 and 1099 in both looks, opening the panel leaves the `.main` rectangle unchanged and `.side` is 360 px wide and ends where the spec says | command | install, browser |
| R20 | in windows 1100 by 560, 480 and 420, in Calm with six and eight sections, `.convs` is 240 px high and `.nav-items` scrolls with `overflow-y:auto` | command | install, browser |
| R21 | at 360 by 560 in both looks and with every section: no horizontal scroll, bar and panes inside the window, every `.nt`, `.tab`, `.ib` and `.btn` at least 40 px tall, five tabs side by side at least 64 px wide | command | install, browser |
| R22 | for `?pane=list`, `main` and `side` at 719 px: which panes are visible, the bottom bar hidden with a chat open or the panel; hidden panes have `visibility:hidden` after the transition and focus never lands in them over 40 presses of Tab | command | install, browser |
| R23, R25 | three toasts at each of the seven widths in both looks, with the bar shown and hidden: each toast's rectangle clears the bar, the stand-in composer, the sidebar, the rail and the panel as stated; the region comes after the shell's elements; a component that calls `useToastAvoid` inside `AppShell` moves the region | command | install, browser |
| R28, R29 | `applyAppearance` sets `data-eff`, `data-accent`, `data-density` for `calm`, `focus` and `device` (with `matchMedia` matching and not) and its returned function stops it; `useNarrow` follows `matchMedia`, and is `false` without it; focus moves to the shown pane on a change at 719 px and below, only when focus is not already inside it | command | install, browser |
| R10, R30, R31, R36 | `sections.ts` holds only the seven allowed ids and the paths of the Blueprint; `visibleSections` for Member, Admin and no role; `appLayoutRoute` has id `_app`, no path, parent root, component `AppShellRoute`; no file-based routing or router plugin; the shell words come from `useTranslation` and `nav.mainLabel` exists in `en` and `vi`; `pnpm --filter @toki/i18n check` exits 0 | command | files, install |
| R32 | the fixture is served by the dev server and not written to the production build; adding it to the build input makes `check:no-dev-pages` fail and name the file (done in the temporary worktree) | command | install, runs Vite |
| R33 | `e2e/app-shell.spec.ts` lists the checks the spec names, at the eight widths, with the 1 px tolerance; the suite is run and exits 0 | command | install, browser, port 5173 free |
| R35 | `typecheck`, `lint`, `lint:boundaries`, `format:check`, the `ui-web` tests, the web build and `test:e2e` exit 0; the initial JavaScript of `apps/web` is within the limit of TOKI-006 R10; no API banned by TOKI-002 R9 is used by the shell and `appearance.ts` | command | install, port 5173 free for `test:e2e` |
| Testing, "By eye" | the shell and the prototype side by side, Calm then Focus, at 360 by 560, 720, 800, 1099, 1100 and 1400, with home and with a panel open: twelve rows, each "matches" or naming the difference | manual | the QA, a browser |
| Testing, screen reader | Tab through the sidebar, rail and bottom bar; the landmarks; the current item; the tab row with arrow keys; opening a conversation at 360 px | manual | the QA, a screen reader |

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1). The pull request moved folders that the spec names; each row records the path at `V` and the note says when it differs from the spec (concern 5).

### Layout
```
docs/
  qa/TOKI-015.md  TOKI-015.checks.sh  TOKI-015.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file in the temporary worktree (a changed width in `shell.css`, a removed `visibility:hidden`) makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-015` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.
- The browser rows depend on a cached Chromium and free ports; if the machine lacks either, those rows are `Blocked` and the record says why.

## Data safety
- Evidence quotes counts, names, pixel values and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal. The fixture holds made-up names only. No screenshot of a real account is kept.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need installs, a dev server, a browser or free ports, and must not change the repository | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-015 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-015, or the current `main`? Answered: the merge commit, `2c3330ef` (#157) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree, a fresh install in it, the cached Chromium and Playwright, and free local ports, isolated from the repository? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The spec measures the shell in a fixture served on port 5173 and in a real browser, and some requirements are a comparison with the prototype by eye. What do the rows do? Answered: the measurements are command rows driving Chromium with Playwright against the dev app of the temporary worktree; the rows that run the ticket's own browser test run only when its fixed ports are free and are `Blocked` otherwise; the comparison with the prototype is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass` (R4, R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.
- The pull request moved folders that the spec names. Does a requirement that names an old path fail when its behavior holds at the new one? Answered: it fails. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 5.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-015 describe the repository when the ticket closed, and later tickets changed it. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `2c3330ef` (#157), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I02. No later commit on `main` changed the shell files at the time of writing; the result notes say so for each row. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree, run `pnpm install` there, and use the local tools, the cached Chromium and Playwright and the free ports that its rows need, isolated from the repository, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. Owner: Thanh Truong (QA).
3. Browser rows, the fixed port and the by-eye comparison. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: a requirement checked in a browser is a command row that drives Chromium with Playwright against the built or dev app of the temporary worktree; the rows that run the ticket's own `e2e/app-shell.spec.ts` need the fixed port 5173 free and are `Blocked` otherwise, and the script never stops another process; a requirement that is only a comparison with the prototype by eye, and the screen reader pass, are `manual` rows for the QA, `Blocked` until the QA pastes the result, never `Pass`. Owner: Thanh Truong (QA).
4. One person holds the roles and a failure stays in the record. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: one person holds Dev, QA and BA and the role is named in each record; a failed row stays in the record and the BA decides whether to reopen TOKI-015 or amend its spec (R10). No throwaway pull request is opened; if CI evidence is needed, the run history is read with read-only `gh`. Claude cannot read or create `.env`. Owner: Thanh Truong (BA).
5. Moved paths. The spec of TOKI-015 names `packages/ui-web/src/shell/`, `apps/web/src/shell/sections.ts`, unit tests beside the sources and `src/shell-fixture`; the delivering pull request renamed the first two to `layout`, moved the tests to `tests/` folders and moved the fixture code to `apps/web/scripts/shell-fixture`. Decided: such a requirement is `Fail`, because the path is in the spec; the row still compares the behavior at the path found at `V` and records the observed path and the spec's path in the result notes, and the BA decides whether to amend the spec or reopen the ticket. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
