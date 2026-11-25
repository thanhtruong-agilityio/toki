# TOKI-124 QA of base components, group 1 - implementation plan

**Goal:** TOKI-012 gets a QA record, run on the real repository at the merge commit of the pull request that delivered it, with the results whatever they are. This plan covers the kit that exists before the run: the plan, the checks script and the draft record. The run, the evidence file and the regenerated traceability table come after the QA approves the rows.

**Spec:** `docs/specs/2026-11-25-base-components-1-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-124-base-components-1-qa`. Documents and one bash script (with a few throwaway test, page and script files that it writes into the temporary worktree); no existing file changes except `docs/traceability.md` (regenerated at the end). `Version:` is `80b962b` (PR #136), decided in concern 1.

## Design

Same shape as `docs/qa/TOKI-002.*`, `TOKI-007.*` and `TOKI-008.*`, with their lessons built in: every part of a sentence of a requirement is a printed number; a row names one requirement; a row that loops prints how many items it checked; a case that must fail is paired with one that must pass; a row that cannot run prints `Blocked` and the reason; the script keeps every temporary file under one folder made in the current shell (`BASE`, exported as `TMPDIR`, given to every process through `env -i`) and its last line shows that the folder was removed, that no process is left and that the repository is unchanged; the notes claim no more than an output line shows.

- `docs/qa/TOKI-012.checks.sh` reads files of `V` with `git show`. Rows that run a tool use one temporary worktree of `V` (installed once with `pnpm install --frozen-lockfile`, removed by an `EXIT` trap). Node 22 from `~/.nvm` and `corepack pnpm`, because the default Node 24 is refused by the repository. No `.env` is read or created.
- **Throwaway files** exist only in the temporary worktree: a Vitest test that renders the components and records counts in a JSON file (it asserts nothing; the script reads the counts), a Node script that reads the tables of the spec at `V` and the CSS files with `postcss`, an ESLint script with the 36 cases of Table K, TypeScript files with the cases that must be type errors and the same kind of cases that must not, a page that renders `componentExamples` with the tokens and `base.css`, and a Playwright script. The tables are read from the spec itself, so the CSS rows do not depend on the CSS tests of the ticket.
- **Browser rows** use `@playwright/test` 1.65.1 added to the temporary worktree (`pnpm add -Dw`, served from the store) and the headless Chromium that Playwright has cached, the Vite dev server of `apps/web` on a free loopback port, and widths of 719, 720 and 1280 px. If the browser cannot start the three browser rows print `Blocked` with the first line of the error.
- **Paired runs.** `pnpm lint` fails with a bad button added and passes without it (T53); the test set-up fails when `cleanup` is removed and passes with it (T64); `order.test.ts` fails when a non-CSS import is put first (T71); the folder test of R31 fails for each of three missing parts and passes with all of them (T77); the 40 px rows are paired with the same controls at 720 px (T28, T29).
- **Manual rows** (look against the prototype, 360 px look, screen reader, tables against the prototype's lines) are `Blocked` until the QA pastes the result. `V=<commit> bash docs/qa/TOKI-012.checks.sh SERVE` starts the examples page in Calm and Focus and prints its two addresses.
- The ticket under test differs from its spec in the places where the spec names `tools/eslint-rules/`, `tools/lint-fixtures/` and `pnpm lint:boundaries`. Those rows keep what the spec says and are expected to fail; the lint behavior itself (36 cases, block, `pnpm lint`) has its own passing rows.
- Output is counts, exit codes and words. Rows are drafted by Claude and approved by the QA before any row is run. The script is debugged on mutated copies (a dangling commit with one changed line); a debug run of a real row is not evidence.

### Rows (one or more for each requirement)

| ID | TOKI-012 | What is compared |
| :-- | :-- | :-- |
| T1, T2 | R1 | nine names, six constants and no `Icon` export; the five files of each folder with the two exceptions |
| T3 to T6 | R2 | the six lists in order; `className` after the own classes and `ref` on the element of Table B; owned attributes after the spread and the omitted props; the nine props types |
| T7, T8 | R3 | empty `textContent` with no text; no import of `@toki/i18n` |
| T9 to T16 | R4 | element, classes in order and attributes of Table B for Button, IconButton, Chip with ChipGroup, Switch, Field, Select, Tag, Badge |
| T17 to T20 | R5 | selectors and declarations of Tables C to F, G and H against the tables typed in the spec; each component imports its own CSS; `sideEffects` |
| T21 to T24 | R6 | colour literals; `var()` names against the 32 properties of `tokens.css`; density variables and look selectors; `font-family` |
| T25, T26 | R7 | hover rules and hidden declarations; `title` and `onMouseEnter` |
| T27 to T29 | R8 | the media blocks of Table I; heights in Chromium at 719 and 720 px; the two limits (Switch touch area, link button) |
| T30 to T32 | R9 | `base.css` against Table J; the three `exports`; no CSS imported but the component's own |
| T33 to T45 | R10 to R20 | one row for each requirement: Button, link button, IconButton, Chip, Switch, Field (three rows), Select, error, disabled and read-only, Tag, Badge |
| T46 to T49 | R21 | native controls and Tab order; Space and Enter; `tabindex` and `outline`; Tab in Chromium |
| T50 to T57 | R22 to R25 | the 36 lint cases (17 + 12, 4 + 3), the block and the disable comment, `pnpm lint` with a bad button, the plugin path, the fixtures, `pnpm lint:boundaries` |
| T58 to T61 | R26 | exports and unique ids; every value and state has an example; the nine selectors; order and imports |
| T62 to T66 | R27 | `pnpm --filter @toki/ui-web test`; config and set-up; cleanup (paired); `readCss`; pinned versions |
| T67 to T69 | R28 | imports and banned APIs; `lint`, `format:check`, `typecheck`; `lint:boundaries` |
| T70 to T74 | R29 | dependencies; import order (paired); build and both sheets; typecheck and size; the two files changed in `apps/web` |
| T75, T76 | R30 | the 12 type errors and 12 valid cases; the `@ts-expect-error` count |
| T77 | R31 | add a component with its folder, one line and one entry; remove each part |
| T78 to T81 | R4, R5, R8, R21 | manual: look in Calm and Focus, tables against the prototype, 360 px, screen reader |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-012.checks.sh` | run on dangling mutated copies (a CSS value, a colour literal, an unknown `var()`, a removed `aria-label`, a removed `role="alert"`, a changed `onChange`, a lint block narrowed or set to `warn`, a media block renamed, a `tabIndex` added, an example removed, an `exports` entry removed): the matching rows change; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-012.md` (unapproved, unrun) | `qa-ready.sh` reports only `has not been run` lines |
| R4, R6, R7 | 3. QA approves rows; Claude runs the command rows; the QA runs the manual rows | results and evidence in the record |
| R6, R8 | 4. Result notes (what changed since `80b962b`), `trace.sh` | the TOKI-012 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no worktree, folder or process left |

## What can break (riskiest first)

1. A row that passes because it measured nothing: every item is a printed count and Expected names the count, so a check that loops over nothing prints a lower number.
2. A row that fails because the check is wrong and not because the ticket is: the mutated copies show that each key row moves when one line changes, and the differences between the spec and the code (the lint layout) are listed for the lead before the run.
3. The browser: the cached Chromium may not match the Playwright version; the rows then print `Blocked` with the first error line.
4. A leftover process or folder: the trap stops the Vite server and removes the folder; the last line shows both.
5. The two Node versions: Node 24 is the default and is refused by the repository; the script puts Node 22 first on `PATH` for every child process.
6. The full run takes about 40 seconds when the pnpm store is warm and longer with a cold store.
