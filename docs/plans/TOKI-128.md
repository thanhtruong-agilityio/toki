# TOKI-128 QA of the component preview page - implementation plan

**Goal:** TOKI-016 gets a QA record, run on the real repository at the merge commit of the pull request that delivered it, with the results whatever they are. This plan covers the kit that exists before the run: the plan, the checks script and the draft record. The run, the evidence file and the regenerated traceability table come after the QA approves the rows.

**Spec:** `docs/specs/2026-11-25-component-preview-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-128-component-preview-qa`. Documents and one bash script (with two small Node helpers that the script writes into its temporary folder); no existing file changes except `docs/traceability.md` (regenerated at the end). `Version:` is `d8bd7f3` (PR #148), decided in concern 1.

## Design

Same shape as `docs/qa/TOKI-008.*` and the QA kits of TOKI-012 and TOKI-013, with their lessons built in: a row names one requirement; every part of a sentence of a requirement is a printed number; a row that loops prints how many items it checked; a check that must fail is paired with a run that must pass; a row that cannot run prints `Blocked` and the reason; every temporary file lives under one folder made in the current shell (`BASE`, exported as `TMPDIR`, given to every process through `env -i`) and the last line shows that no worktree of the script is left, the repository is unchanged, no process is left and the folder is removed; the notes claim no more than an output line shows.

- `docs/qa/TOKI-016.checks.sh` reads files of `V` with `git show`. Rows that run a tool use one temporary worktree of `V` (installed once with `pnpm install --frozen-lockfile`, removed by an `EXIT` trap). Node 22 from `~/.nvm` and `corepack pnpm`, because the default Node 24 is refused by the repository. No `.env` is read or created.
- **The ticket's own browser test** (`e2e/component-preview.spec.ts`) runs once, with Chromium and the Playwright config of `V`, which fixes the ports 5173 (Vite, `strictPort`) and 3000 (the server). If either port is busy the browser rows print `Blocked`; the script never stops another process. Each browser row reads the tests it names from the one JSON report, by title, and prints passed, failed and skipped counts. A `test.fixme` is counted as skipped, so a requirement whose test is skipped at `V` shows `0 0 1` and is `Fail`.
- **Static and tool rows** read the commit (`preview.html`, `main.tsx`, `vite.config.ts`, `package.json`, the delivering diff `V^1..V`) and run `pnpm --filter ./apps/web build`, `check:no-dev-pages`, `pnpm size`, the Vitest files of `apps/web`, `lint`, `format:check`, `typecheck` and the whole end-to-end run in the temporary worktree.
- **Paired runs.** The check script `check:no-dev-pages` exits 0, exits non-zero naming `preview.html` when the page is added to the build input, exits non-zero when a copy of the build folder holds the page, and exits 0 again after the restore (T5). The key browser rows are run again after one changed line in the temporary worktree and must fail: a token value (R11, R14, R15), the figures of an entry (R6), the icon list (R9), a wide `.pv-page` rule (R16), a line of `references.ts` (R17). R18 and R19 are paired with the same read of a text with one added line (a selector that is not `.pv-`, an import of `Button`), and R18 also with Vitest run on a changed `preview.css`.
- **Rows that fail on purpose** keep the spec's text as `Expected`: the fonts section and its line, the `fonts.css` link, `check:fonts`, the `.woff2` count and the screenshot test wait for TOKI-010 (concern 4), and `lint:boundaries` does not exist at `V`. They are expected to Fail; the record says so only after the run.
- **Blocked on purpose:** the whole of `pnpm test` needs a PostgreSQL test database (it also runs the server database project); the row prints the database-free numbers and says `Blocked`. The four by-eye rows of R21 are `manual`: `V=<commit> bash docs/qa/TOKI-016.checks.sh serve` starts the page and prints its addresses for the QA.
- Output is counts, exit codes and words. Rows are drafted by Claude and approved by the QA before any row is run. The script was debugged on mutated copies; a debug run is not evidence.

### Rows (one or more for each requirement)

| ID | TOKI-016 | What is compared |
| :-- | :-- | :-- |
| T1, T2 | R1 | the page: 200, `preview-root`, title, viewport meta; `/` still shows `app-root` |
| T3 to T7 | R2 | the build holds `index.html` only; no page in `vite.config.ts`; `check:no-dev-pages` (paired); the build script and CI; the size limit |
| T8 to T11 | R3 | the fonts link (waits for TOKI-010); the style order; no other file imports `fonts.css`; `check:fonts` |
| T12 to T17 | R4 | defaults; the address; an unknown value; the three controls and the storage; the dark setting; `readControls` and `applyControls` |
| T18, T19 | R5 | one section per entry, in order; the fonts section (waits for TOKI-010) |
| T20 | R6 | figures against `data-count` (paired) |
| T21, T22 | R7 | the error boundary; the two pinned `devDependencies` |
| T23 to T25 | R8 | Table B1; Table B2 reported; the 15 entries and the 13 ids of Table A2 |
| T26 | R9 | 43 icon cells and four sizes (paired) |
| T27 | R10 | the fonts section: seven rows, seven loaded faces (waits for TOKI-010) |
| T28, T29 | R11 | 32 token rows and the accent values (paired); the swatch |
| T30 to T33 | R12 | one provider and one live region; plain toast; toast with an action; three toasts |
| T34 | R13 | the first button of Menu, Modal and Sheet opens a layer; Escape closes it |
| T35 | R14 | Table C in Calm and Focus (paired) |
| T36 to T38 | R15 | indigo in both looks (paired); the default avatar width; an avatar with a size |
| T39 to T41 | R16 | six widths in both looks (paired); 40 px at 719; 34, 28, 34 and 28 px at 720 |
| T42, T43 | R17 | the lines of Table D (paired); the fonts line (waits for TOKI-010) |
| T44 | R18 | no `@toki/i18n`, only `.pv-` selectors (paired) |
| T45, T46 | R19 | no path under `packages/` in the delivery; the imports (paired) |
| T47, T48 | R20 | no console error and no other host; seven `.woff2` (waits for TOKI-010) |
| T49 to T52 | R21 | manual: components at six views; overlays; accents and densities; Safari and Firefox |
| T53 | R21 | the description of the pull request holds the four tables and a review by someone else |
| T54 to T58 | R22 | `lint`, `format:check`, `typecheck`, `build`; `lint:boundaries`; `pnpm test`; `pnpm test:e2e`; no inline `eslint-disable` |
| T59, T60 | R23 | the 13 overlay examples open and close; the panel stays inside the window |
| T61 | R24 | the screenshot spec and its six images (waits for TOKI-010) |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-016.checks.sh` | run on mutated copies (the changed rows above): the matching rows change; run twice: identical lines; `git status` and the worktree list are as before |
| R1, R2 | 2. Draft `docs/qa/TOKI-016.md` (unapproved, unrun) | `qa-ready.sh TOKI-016` reports only `has not been run` lines |
| R4, R6, R7 | 3. QA approves rows; Claude runs the command rows; the QA runs the manual rows | results and evidence in the record |
| R6, R7 | 4. Result notes (what changed since `d8bd7f3`; which Success Criterion each row feeds), `trace.sh` | the TOKI-016 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; no worktree, folder or process left |

## What can break (riskiest first)

1. A row that passes because it measured nothing: every count is printed and `Expected` names it, so a filter that matches no test prints `0 0 0` and differs.
2. A row that fails because the check is wrong and not because the ticket is: the paired runs show that each key row moves when one line changes.
3. The ports 5173 and 3000: another dev server on the machine makes every browser row `Blocked`; the script does not stop it.
4. The browser: the cached Chromium may not match the Playwright version; the browser rows then print `Blocked` with the first error line.
5. A leftover process or folder: the trap sweeps every process whose command line holds the temporary folder and removes the folder; the last line shows both.
6. Node 24 is the default and is refused by the repository; the script puts Node 22 first on `PATH` for every child process.
7. The row that reads the pull request (T53) needs `gh` and the network; it reads the live description, which can change after the delivery.
8. The full run takes about two minutes when the pnpm store is warm.

## Open for the lead
- `pnpm test` (T56) cannot pass or fail on this machine for lack of a PostgreSQL test database; the QA decides whether to run it where one exists or to keep the row Blocked.
- The rows that fail because TOKI-010 is not on the commit (T8, T11, T19, T27, T43, T48, T61) and `lint:boundaries` (T55) stay in the record as Fail; the BA decides whether to reopen TOKI-016.
