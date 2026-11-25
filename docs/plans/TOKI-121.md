# TOKI-121 QA of the tokens package - implementation plan

**Goal:** TOKI-009 gets a QA record at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-tokens-package-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-121-tokens-package-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `1367785` (PR #129, 2026-11-18), decided in concern 1. Concerns 2 and 3 decided: a temporary worktree with its own install, the Chromium that Playwright has cached and a free local port; the rows that need a browser are commands, and no requirement is only a comparison by eye.

## Design

Same shape as the earlier QA tickets with their lessons built in from the start: every part of a sentence of a requirement is a printed number; a row names one requirement; a row prints `Blocked`, never a Pass, when it cannot be shown; a changed `Expected` is approved again; one `BASE` folder made in the current shell holds every temporary file (exported as `TMPDIR`); the last line shows that the worktree and the folder are gone, that no process is left and that the repository is unchanged; and the notes claim no more than the evidence.

- **Values come from the spec.** A small harness is run with `tsx` in the temporary worktree. It reads Tables A to E and the text of R1, R4, R10 and R15 of `docs/specs/2026-11-16-tokens-package-design.md` at `V`, and compares the package and `tokens.css` with them. The package is not the source of its own expected values; the one place `getTheme` is the reference is R16, as that requirement says.
- **Rows that loop print how many items they checked** (42 values, 32 values, 24 calls, 672 values, 87 colours, 30 states, 960 values) and their `Expected` requires the count the spec gives. A check that looks for something absent (R8 `var(`, R18, R19) prints a control: the same detector run on made-up text must flag every case.
- **The 30 states of R16** run in headless Chromium (`playwright-core` installed into the temporary folder, the cached browser) on a page of the worktree served on a free port found with python. The page loads `tokens.css`; the script sets the attributes and the device scheme and reads the computed value of the 32 properties. The 24 states with `data-eff` also run on a dark device (the requirement says the device makes no difference). Each row is paired with a run on a copy where one colour of `tokens.css` is changed; at least one value must differ.
- **Rows that must fail** change a file of the temporary worktree and restore it with `git checkout`: a type narrowing (R1), a hand edit of `tokens.css` repaired by `generate` (R17), a changed colour that the package test must report with the command's name (R17), a type error in the script and in the test file (R20), a link of `@toki/tokens` into `apps/web` for the resolution of R9 (no project depends on the package at the Version).
- Output is counts, exit codes and words; no tool output is kept and no `.env` is read or created.
- Rows are drafted by Claude and approved by the QA before any row is run. I debug the script on mutated copies first (one value of `tokens.ts`, one line of `tokens.css`, `package.json`, a source file); those runs are not evidence.

### Rows (one per requirement and behavior)

| Rows | TOKI-009 | What is compared |
| :-- | :-- | :-- |
| T1 | R1 | the three lists equal R1 in order; a type check of the three unions exits 0, and exits non-zero with `Look` narrowed |
| T2, T2B | R2 | 17 colours and 4 tints for each look; 42 values of Table A |
| T3, T3B | R3 | 8 pairs with exactly the four keys; 32 values of Table B |
| T4, T4B | R4 | 6 numbers of Table C; `lookDensity` equals the two entries |
| T5 | R5 | 4 numbers of Table D |
| T6, T6B | R6 | 6 layers and 30 fields of Table E; the empty list for no shadow |
| T7, T7B, T7C, T7D | R7 | 24 calls: the 32 keys; the accent values; the density when left out; the 28 other values |
| T8, T8B, T8C, T8D | R8 | lengths are numbers; colours have the two forms; tints are 0 to 100; no `var(`, `calc(` or unit (with a control) |
| T9, T9B, T9C, T9D | R9 | two `exports` entries; the files exist; resolution from another project through a temporary link; the package test |
| T10 | R10 | the 32 declared names against the 32 of the spec, both ways |
| T11, T11B, T11C, T11D | R11 | the two selectors; 32 properties in each block; 64 values; `color-scheme` |
| T12, T12B, T12C | R12 | one media block with one rule; the rule equals the Focus block; the package tests |
| T13, T13B, T13C | R13 | six selectors; 24 values and nothing else; no block for teal |
| T14, T14B, T14C | R14 | two blocks; 6 values and nothing else; both after every look block |
| T15, T15B, T15C, T15D, T15E | R15 | the text form of lengths, tints, colours and shadows; the five worked examples |
| T16, T16B, T16C, T16D | R16 | 30 states in Chromium (24, 6 and the 24 again on a dark device) against `getTheme`, each paired with a changed colour; the package tests |
| T17, T17B, T17C, T17D | R17 | `toCss()` equals the file; `generate` repairs a changed file; the leading comment; the test fails and names the command |
| T18 | R18 | the six names in no file of the package but the test (with a control) |
| T19, T19B, T19C, T19D | R19 | no DOM global, no Node API, no import of another package in `src` (with controls); no `dependencies` entry |
| T20, T20B, T20C | R20 | the package tests exit 0; `pnpm typecheck` exits 0; the type check covers `src` and `scripts` (a type error in each is caught) |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-009.checks.sh` | mutated copies (a value, a line, a selector, an exports entry, a source file) make the matching rows change; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-009.md` (unapproved, unrun) | `qa-ready.sh` reports only rows not run |
| R4, R6 | 3. QA approves rows; I run every row | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `1367785`, the Success Criteria of I02 each row feeds), `trace.sh` | the TOKI-009 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no process, worktree or folder left; no write to GitHub |

## What can break (riskiest first)

1. A check that passes because it finds nothing: each "none found" row prints a control, and the key rows are tried on mutated copies.
2. The browser: Chromium or `playwright-core` unavailable gives `Blocked` with the first error line, never a Pass.
3. A table of the spec read wrongly (a second "Table E" in R6): the harness anchors on the start of a line and the compared counts (42, 32, 6, 4) show a wrong read.
4. The temporary worktree, the server or the folder left behind: one `BASE` folder, the `EXIT` trap and the final line.
5. Install needs the network: the row is `Blocked` when `pnpm install` or the `playwright-core` install fails.
