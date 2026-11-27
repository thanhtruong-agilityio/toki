# QA of the component preview page design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/component-preview-qa.md (Thanh Truong)
Ticket: TOKI-128

## Goal
The builder, the QA and the BA need to know whether TOKI-016 (the component preview page) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-016 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is one of the twelve QA tickets for the Blueprint outcome I02 design-system (ticket 8 of 12), and it carries the browser test that the I02 done line and the M1 exit check name; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of the test harness (`docs/specs/2026-11-25-test-harness-qa-design.md`) and of the web app skeleton (`docs/specs/2026-11-25-web-skeleton-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-016.md`, its checks script `docs/qa/TOKI-016.checks.sh` and its evidence file `docs/qa/TOKI-016.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-016, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-016 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-016; a row may point to a check that already runs (the browser test `e2e/component-preview.spec.ts` and the Vitest files of `apps/web/src/preview/`).

## Requirements
- R1. `docs/qa/TOKI-016.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-016`, `Spec: docs/specs/2026-11-16-component-preview-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-016` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-016 (R1 to R24) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-016` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-016.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool, a service or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-016.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. A browser row is a command row that drives Chromium with Playwright against the dev server of the temporary worktree (or its built app, for the build rows) and prints the numbers it measured: it may run the ticket's own browser test filtered to one requirement, or its own Playwright probe, and its line states passed, failed and skipped counts; a test that is skipped or marked `fixme` is not a pass, so a requirement whose test is skipped at `V` is `Fail`, not `Pass`. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. A requirement that is only a by-eye comparison with the prototype (R21 of TOKI-016, and the by-eye part of the others) is a `manual` row for the QA: it is `Blocked` until the QA pastes the result, never `Pass`. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with its own `pnpm install`, the Vite dev server on port 5173 (the spec of TOKI-016 and TOKI-006 fix it with `strictPort`, so the rows that start the server run only when 5173 is free), a headless Chromium installed or cached by Playwright, and free local ports for anything else. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-016, `d8bd7f3` (#148) (concern 1), and every row is judged at it. PR #148 delivered the page and its tests; no later commit re-landed it, and later tickets changed the files (TOKI-023, TOKI-033, TOKI-034, TOKI-093 touched the browser test or the examples). The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it, without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I02. The record carries a result note that says which Success Criterion of I02 each row will feed (the `done` line and the exit check of M1: the component preview page, the browser test, the build without the page), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-016 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-016, the files that TOKI-016 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-016 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-016 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-016 states. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior (about 16 groups for the 24 requirements).

| TOKI-016 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1 | `/preview.html` returns 200, shows `data-testid="preview-root"`, has the title `Toki component preview` and the viewport meta of the spec; `/` still shows `app-root` | command | install, dev server, browser |
| R2 | `pnpm --filter ./apps/web build` leaves one `.html` file in `dist`, no file holds `preview-root` or `preview.html`, `vite.config.ts` lists no other input; `check:no-dev-pages` exits 0, and exits non-zero naming the setting when a copy of `vite.config.ts` in the temporary worktree adds the page | command | install, build |
| R3 | `preview.html` links `fonts.css`, `main.tsx` imports tokens, base and `preview.css` in the order given, and no `.ts` or `.tsx` of `apps/web/src` other than `main.tsx` imports `fonts.css`; `check:fonts` exits 0. The fonts files do not exist at `V` (the ticket marks the check a `test.todo`), so the row reports it | command | files, install |
| R4 | the three native selects hold the values of `looks`, `accents` and `densities`; the root carries `data-look`, `data-scheme`, `data-accent` and `data-density` as chosen (`data-scheme` follows the look: `light` for `calm`, `dark` for `focus`; was `data-eff` without `data-scheme`; TOKI-142), an unknown value gives the default, "the look's own" sets no `data-density`; `readControls` passes in `preview.test.ts` | command | install, dev server, browser, Vitest |
| R5, R6 | the sections come in the order of the spec, one `data-component` section for each entry of `componentExamples`, and the number of figures of each entry equals its `data-count` and its examples; the fonts section is expected between tokens and icons | command | install, dev server, browser |
| R7 | `ExampleFigure.test.tsx` passes: a throwing example shows its message with `data-failed="true"` and the rest renders; the two `devDependencies` pin the same version as `packages/ui-web` | command | install, Vitest |
| R8 | every selector of Table B1 matches inside a figure in Calm and in Focus, the 15 required entries exist, and the B2 selectors that match nothing are listed | command | install, dev server, browser |
| R9, R11 | 43 icon cells and the four sizes; 32 token rows with a non-empty value; `--accent` is `#0F766E`, `#4F46E5` and `#A5B4FC` in the three cases of the spec | command | install, dev server, browser |
| R10, R20 | the fonts section: seven rows, seven `FontFace` entries all `loaded`, seven `.woff2` responses (these are `test.fixme` at `V`); no console error or warning and no request to another host in each look | command | install, dev server, browser |
| R12, R13, R23 | the three toast buttons (plain toast gone within 4 s, action toast gone within 7 s or on press, counter 1, three in order); the first button of each Menu, Modal and Sheet figure opens a `menu` or `dialog`, Escape closes it and returns focus; the 13 overlay examples of Table A2 open and close, and the panel lies inside the window at the five widths | command | install, dev server, browser |
| R14, R15 | the 13 rows of Table C in Calm and in Focus; accent and density reach `.btn.primary`, the chip and `.av` as listed | command | install, dev server, browser |
| R16 | at 360 by 560, 719, 720, 1099, 1100 and 1400 px in both looks: no horizontal scroll, no figure wider than the window; the 40 px and the 34, 28 and 28 px heights at 719 and 720 px | command | install, dev server, browser |
| R17, R18, R19 | each section shows its `data-prototype-ref` line equal to Table D and none reads `No prototype reference recorded`; the files of `src/preview/` import nothing from `@toki/i18n` and have only `.pv-` selectors, `body` and `:root`; the delivering pull request adds no path under `packages/` and the imports are the ones listed | command | files, `git show`, browser |
| R21 | the four by-eye tables of the pull request, signed by a reviewer other than the builder: Calm and Focus against the prototype at the widths of the spec, the overlays, the accents and densities, Safari and Firefox | manual | the QA, the prototype |
| R22 | `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` and `pnpm --filter ./apps/web build` each exit 0 (the end-to-end run needs 5173 free) | command | install, dev server, browser |
| R24 | `e2e/component-preview-screenshots.spec.ts` and its six committed images exist and pass; at `V` the spec marks R24 `test.fixme` and the file is not in the pull request, so the row reports what is there | command | files, browser |

Several requirements describe the repository when the ticket closed, and the pull request itself leaves some of them unbuilt (the fonts section, R3's fonts link, R20's `.woff2` count and R24 wait for TOKI-010, which is not on the commit). Those rows are judged at `V` as written: a requirement that the commit does not meet is `Fail` and stays in the record (R6, concern 1, concern 4).

### Layout
```
docs/
  qa/TOKI-016.md  TOKI-016.checks.sh  TOKI-016.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file in the temporary worktree (a page added to the build input, a changed token value, a removed `figure`) makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-016` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.
- If CI evidence is needed, the run history is read with read-only `gh`; no throwaway pull request is opened.

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal. The page holds no personal data (spec of TOKI-016, Data safety).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need an install, a browser or a port, and must not change the repository | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-016 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-016, or the current `main`? Answered: the merge commit, `d8bd7f3` (#148) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree with its own install, the local tools, a headless Chromium and free ports, isolated from the repository? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The spec asks for a by-eye comparison with the prototype in Calm and Focus (R21), which no command can run. What do the rows do? Answered: the by-eye requirement is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass`; what a machine can check is a command row that drives Chromium with Playwright (R3, R4). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-016 describe the repository when the ticket closed, and later tickets changed the files. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `d8bd7f3` (#148), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree with its own `pnpm install` and use the local tools, the cached Chromium and Playwright and free local ports that its rows need, isolated from the repository, and removes them at the end (R5); a row that cannot run for lack of a tool or a port is `Blocked`. Owner: Thanh Truong (QA).
3. By-eye rows and the browser. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: a requirement that a machine can check in a browser is a command row driving Chromium with Playwright against the dev server of the temporary worktree; a requirement that is only a by-eye comparison with the prototype (R21, and the look comparison inside R14 to R16) is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass`. The rows that start the dev server run only when port 5173 is free and are `Blocked` otherwise; the script never stops another process. Owner: Thanh Truong (QA).
4. Requirements not met at the delivering commit. At `d8bd7f3` the fonts section, the fonts link of R3, the `.woff2` count of R20 and the screenshot test of R24 are marked `test.fixme` or `test.todo` because TOKI-010 was not on `main`, and the screenshot file and its images are absent. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: such rows are judged as written and are `Fail` (a skipped test is not a pass), the failure stays in the record with its cause and the later ticket that changed it, and the BA decides whether to reopen TOKI-016 or amend its spec; this work does not fix it. Owner: Thanh Truong (BA).
