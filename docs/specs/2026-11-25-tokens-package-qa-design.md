# QA of the tokens package design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/tokens-package-qa.md (Thanh Truong)
Ticket: TOKI-121

## Goal
The builder, the QA and the BA need to know whether TOKI-009 (the tokens package: the Calm and Focus palettes, the four accents, the two densities, the radii, the shadows and the generated `tokens.css`) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-009 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is the first of the twelve QA tickets for the Blueprint outcome I02 design-system; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of the test harness (`docs/specs/2026-11-25-test-harness-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-009.md`, its checks script `docs/qa/TOKI-009.checks.sh` and its evidence file `docs/qa/TOKI-009.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-009, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-009 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-009; a row may point to a check that already runs.

## Requirements
- R1. `docs/qa/TOKI-009.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-009`, `Spec: docs/specs/2026-11-16-tokens-package-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-009` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-009 (R1 to R20) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-009` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-009.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-009.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops (the 6 value tables, the 32 names, the 30 states) prints how many items it checked and its `Expected` requires the count the spec gives. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. A requirement that is only a comparison by eye with the prototype is a `manual` row: it stays `Blocked` until the QA pastes the result, never `Pass`. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with its own `pnpm install`, and for the 30 states of R16 a headless Chromium driven by Playwright (the cached browser, or the one installed in the worktree) against a page of the temporary worktree that loads `tokens.css` (built or served by the dev server on a free port). It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-009, `1367785` (#129) (concern 1), and every row is judged at it. PR #129 delivered it: it adds `tokens.ts`, `theme.ts`, `css.ts`, `index.ts`, `tokens.css`, the generator script and the test file in `packages/tokens`; no later commit re-landed the package. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it, without judging it (for example the move of the unit test file from `src/` to `tests/` by TOKI-015, #158). Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I02. The record carries a result note that says which Success Criterion of I02 each row will feed (the values of the prototype held once and offered as CSS variables and as objects), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-009 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-009, the files that TOKI-009 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-009 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-009 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-009 states. Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior. All 20 requirements are covered; none is left out. No requirement of TOKI-009 is only a by-eye comparison: the values are those of its Tables A to E, which a command compares. A `manual` row is added only if the QA asks to compare a look with the prototype, and it stays Blocked until the QA pastes the result.

| TOKI-009 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1 | the exports `looks`, `accents` and `densities` hold exactly the listed values in order, and the three types exist | command | install, files |
| R2, R3, R4, R5, R6 | `palettes`, `accentColors`, `densityValues`, `lookDensity`, `radii` and `shadows` are compared with Tables A to E of the spec of TOKI-009: the key counts (17 colours and 4 tints for each look, 4 accent values for each of 8 pairs, 3 density numbers for each of 2, 2 radii for each look, 2 shadows for each look) and each value | command | install, files |
| R7, R8 | `getTheme(look, accent, density?)` returns exactly 32 keys, takes the accent values of the given look and accent, uses `lookDensity` when the density is left out; every exported length is a number, every colour is `#RRGGBB` or `rgba(r,g,b,a)`, every tint is 0 to 100, and no value holds `var(`, `calc(` or a unit | command | install |
| R9 | the `exports` of `packages/tokens/package.json` hold exactly `"."` and `"./tokens.css"`, each names an existing file, and `@toki/tokens/tokens.css` resolves from another workspace project | command | install |
| R10, R11, R12, R13, R14, R15 | `tokens.css` declares exactly the 32 names of R10; has the look blocks, the `prefers-color-scheme` block equal to the Focus block, the six accent blocks with no teal block, the two density blocks after the look blocks, `color-scheme` in each look block, and the text forms and the five literal examples of R15 | command | files |
| R16 | in each of the 30 states (24 with `data-eff`, 6 without) a headless Chromium loads `tokens.css`, sets the attributes and the device colour scheme, and the computed value of the 32 properties on the root equals `getTheme` after the conversion of R15; the row prints 30 states and 960 values compared | command | install, Chromium via Playwright |
| R17 | `toCss()` and `pnpm --filter @toki/tokens generate` give the committed file character for character; the file starts with a comment that names the command; a changed copy in the worktree makes the package test fail and name the command | command | install |
| R18 | the six names `--stage`, `--stage-bar`, `--stage-ink`, `--stage-line`, `--stage-muted` and `--tile` appear nowhere in the package except in its test | command | files |
| R19 | no source file under `packages/tokens/src` other than the test uses a browser or DOM global, a Node API or an import from another package, and `package.json` has no `dependencies` entry | command | files |
| R20 | `pnpm --filter @toki/tokens test` and `pnpm typecheck` exit 0, and the type check covers `src/` (the test included) and `scripts/` | command | install |

Requirements that describe the repository when the ticket closed may no longer hold on `main` (the test file moved to `tests/`); the commit at which the rows are judged decides (concern 1).

### Layout
```
docs/
  qa/TOKI-009.md  TOKI-009.checks.sh  TOKI-009.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file (one value in `tokens.ts`, one line of `tokens.css`) makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-009` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal. The package holds colour values only.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need an install or a browser and must not change the repository | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-009 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-009, or the current `main`? Answered: the merge commit, `1367785` (#129) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need, isolated from the repository? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- R16 of the spec (30 states of the page) and the look of the tokens are about what a browser shows. Which rows are commands and which are a comparison by eye? Answered: R16 is a command row that drives Chromium with Playwright against a page of the temporary worktree and compares computed values with `getTheme`; a requirement that is only a comparison by eye with the prototype is a `manual` row, Blocked until the QA pastes the result, never Pass (R4, R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-009 describe the repository when the ticket closed, and later tickets changed it (the test file moved from `src/` to `tests/`). Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `1367785` (#129), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree with its own `pnpm install`, and use the local tools, the cached Chromium and Playwright and free local ports that its rows need, isolated from the repository, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. Owner: Thanh Truong (QA).
3. Browser rows and the rows by eye. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the check of R16 is a command row driving Chromium with Playwright against the built or dev app of the temporary worktree; a requirement that is only a by-eye comparison with the prototype is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass`. Owner: Thanh Truong (QA).
4. One person, three roles, and failures. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: one person holds Dev, QA and BA and the record names the role next to each name; a failure stays in the record and the BA decides whether to reopen TOKI-009 (R10); the checks read no `.env` file and create none; no throwaway pull request is opened, and CI evidence, if a row needs it, is read from the run history with read-only `gh`. Owner: Thanh Truong (BA).
