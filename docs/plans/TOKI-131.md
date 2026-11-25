# TOKI-131 QA of the destructive-action and unsaved-form patterns - implementation plan

**Goal:** TOKI-093 gets a QA record, run on the real repository at the merge commit of the pull request that delivered it, with the results whatever they are. This plan covers the kit that exists before the run: the plan, the checks script and the draft record. The run, the evidence file and the regenerated traceability table come after the QA approves the rows.

**Spec:** `docs/specs/2026-11-25-destructive-patterns-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-131-destructive-patterns-qa`. Documents and one bash script (with a few throwaway test, type, page and script files that it writes into the temporary worktree); no existing file changes except `docs/traceability.md` (regenerated at the end). `Version:` is `420d129` (PR #151), decided in concern 1.

## Design

Same shape as `docs/qa/TOKI-002.*`, `TOKI-007.*` and `TOKI-008.*`, with their lessons built in: every part of a sentence of a requirement is a printed number; a row names one requirement; a row that loops prints how many items it checked; a check that must fail is paired with a run that must pass; a row that cannot run prints `Blocked` and the reason; the script keeps every temporary file under one folder made in the current shell (`BASE`, exported as `TMPDIR`, given to every process through `env -i`) and its last line shows that the worktree is gone, that no process is left, that the repository is unchanged and that the folder was removed; the notes claim no more than an output line shows.

- `docs/qa/TOKI-093.checks.sh` reads files of `V` with `git show`. Rows that run a tool use one temporary worktree of `V` (installed once with `pnpm install --frozen-lockfile`, removed by an `EXIT` trap). Node 22 from `~/.nvm` and `corepack pnpm`, because the default Node 24 is refused by the repository. No `.env` file is read or created.
- **Rows on text** (R1, R3 scans, R10 to R11 scans, R14, R16, R17, R21 and R23 scans, R24) compare files of `V` with the tables of the spec; a Node script reads Table A, Table B and Table C from the spec itself and the code from `V`. Each scan is paired with the same scan on a copy changed in memory (a banned import, a colour literal, a timer call, a second `let`).
- **Rows on behavior** use throwaway Vitest files written into the temporary worktree (`packages/ui-web/src/__qa__/` and `apps/web/src/__qa__/`), run with the Vitest of the package, and removed after the run. They record counts in a JSON file; they assert nothing, the script reads the counts. The code is rendered in jsdom with the Toast and Modal providers; timing rows use fake timers (4999 and 5000 ms, 2799 and 2800 ms).
- **Type rows** (R4, R5, R10, R11) add type cases to the temporary worktree: cases that must compile and cases that must be type errors, and read what `tsc` reports for each file. A wrong claim about the types is made on purpose in one file, so a check that cannot fail is caught.
- **Command rows of R2** run `pnpm --filter @toki/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm i18n:check` and `pnpm lint:boundaries`; typecheck, lint, format and the i18n check are each paired with the same command after a file that breaks it was added. `pnpm test` needs a PostgreSQL test database (the server database tests of TOKI-008) and the QA spec R5 lists none, so that row prints `Blocked` with the counts it can show.
- **Browser rows** use the `@playwright/test` 1.65.1 that `V` already has, the cached headless Chromium, and the Vite dev server of `apps/web` on a free loopback port. They open the preview page (`/preview.html`) in Calm and Focus at 360, 719, 720 and 1280 px, press the first button of the examples and measure the buttons, the panel and the 120-character target. The wrap row is paired with a name with no break opportunity: with the CSS it does not overflow; with the `overflow-wrap` rule taken out of the CSS in the worktree (restored after) it does. If the browser cannot start the three browser rows print `Blocked` with the reason.
- **Manual row** (the look at 360 px in both looks) is `Blocked` until the QA pastes the result. `V=<commit> bash docs/qa/TOKI-093.checks.sh SERVE` starts the preview page and prints the Calm and Focus addresses.
- The ticket under test differs from its spec in two places. `pnpm lint:boundaries` is not a script at `V` (TOKI-002 dropped it), so that row keeps what the spec says and is expected to Fail (decided, concern 4). The Vitest configuration of `apps/web` sets `environment: "node"` and each test that renders opts into jsdom with a docblock, where the spec says the configuration has the `jsdom` environment; that row keeps what the spec says and is expected to Fail, and the QA decides what it means. `pnpm test` is Blocked for the reason above.
- Output is counts, exit codes and words. Rows are drafted by Claude and approved by the QA before any row is run. The script is debugged on mutated copies (a dangling commit with one changed line); a debug run of a real row is not evidence.

### Rows (one or more for each requirement)

| ID | TOKI-093 | What is compared |
| :-- | :-- | :-- |
| T1 to T6 | R1 | the five files of the folder; the one line of `components/index.ts` and the import and entry of `examples.ts`, no other shared file changed; the four exports of `@toki/ui-web`; the eight files of `patterns/` with a test next to each; the twelve names of `patterns/index.ts`; the `ConfirmDialog` key of `references.ts` |
| T7 to T17 | R2 | the Vitest configuration and its environment; the setup file (three things, wired in); the five devDependencies against `ui-web`; the root `test.projects` glob; `pnpm --filter @toki/web test`; `pnpm test`; typecheck, lint, `lint:boundaries`, format and i18n check |
| T18 to T22 | R3 | no import of `@toki/i18n`, `@toki/platform` or `@toki/tokens`; empty texts give only the target; no colour literal; no custom property outside the 32 names; no look selector |
| T23 to T30 | R4 | one Modal with `cfm`, the title and no close button; one `.mbd` and one `.mft` as siblings; `aria-describedby`; the order of the children; one string for the description; the two buttons and the two variants; the dialog never closes itself; `onConfirm` and `onCancel` required |
| T31 to T36 | R5 | `target` required; the target in `p.cfm-target strong`; the target `An`; a title that holds the target; a blank target throws in test; a blank target renders nothing in production and logs |
| T37 to T39 | R6 | first focus on Cancel; the three reasons; confirm once and never by Esc or an outside press |
| T40 to T43 | R7 | buttons disabled and `aria-busy`; Esc and outside ignored; focus moves to the panel; a second press cannot confirm |
| T44 to T48 | R8 | the CSS holds exactly the three rules of Table C; no hover rule; buttons at least 40 px at 719 px and below (browser); the dialog fits (browser); the look at 360 px in both looks (manual) |
| T49 to T55 | R9 | the five ids and the entry; each demo opens and closes on each reason; focus returns to its own opener; the content of each demo; the examples test; the `references.ts` value; the 120-character target wraps (browser) |
| T56 to T59 | R10 | the 18 rows against Table A; the owner format; `ActionId`, `UndoActionId` and `ConfirmActionId` derived by the compiler; the test copy of the table |
| T60 to T64 | R11 | the three sets are disjoint and cover the ids; a wrong id is a type error; the runtime check of `run` and of `ConfirmAction`; no import of `ConfirmDialog` outside `patterns/` |
| T65 to T67 | R12 | `done` and the order; `failed`; `blocked`, and a check that throws |
| T68 to T71 | R13 | offline Undo; online Undo awaited; failing Undo; a good Undo is quiet |
| T72, T73 | R14 | no timer call in `useUndo.ts`; the toast at 4999 and gone at 5000 ms |
| T74 to T76 | R15 | the same key dismisses the earlier toast; other keys and no key; 60 keys leave 50 |
| T77 to T79 | R16 | `run` keeps its identity; an Undo outlives its component; no Pause or Focus |
| T80 to T84 | R17 | the check with `true`, `false`, a throw and `null`; the default and `navigator.onLine`; the two texts; the 2800 ms toast; the module holds one function of state |
| T85 to T88 | R18 | online confirm; offline confirm; `busy` and `returnFocusRef` forwarded; the 12 confirm ids show their target |
| T89 to T91 | R19 | the values that are content; the values that are not; it never throws |
| T92, T93 | R20 | the four members; `requestClose` |
| T94 to T98 | R21 | no content; outside press; close; Esc with `"ask"`; Esc with `"ignore"` |
| T99 to T103 | R22 | the six properties of the discard dialog; Keep editing, Esc and outside; focus when the body had focus; Discard; the first Esc |
| T104, T105 | R23 | unmounting with the question open; no timer, no storage, no read of the fields |
| T106 to T109 | R24 | both catalogues against Table B; the two `index.ts` lists; `pnpm i18n:check` (paired) |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-093.checks.sh` | run on dangling mutated copies (a pattern flipped in `actions.ts`, a timer added to `useUndo.ts`, the outside branch of the guard disabled, a colour literal in the CSS, a Vietnamese text changed, the offline check removed from `run`, the `key` handling removed): the matching rows change; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-093.md` (unapproved, unrun) | `qa-ready.sh` reports only `has not been run` lines |
| R4, R6, R7 | 3. QA approves rows; Claude runs the command rows; the QA runs the manual row | results and evidence in the record |
| R6, R8 | 4. Result notes (what changed since `420d129`), `trace.sh` | the TOKI-093 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no worktree, folder or process left |

## What can break (riskiest first)

1. A row that passes because it measured nothing: every item is a printed count and Expected names the count; scans and the overflow row are paired with a changed copy, so a check that looks at nothing prints a lower number.
2. A row that fails because the check is wrong and not because the ticket is: the mutated copies show that each key row moves when one line changes, and the differences between the spec and the code (the `jsdom` configuration, `lint:boundaries`) are listed for the lead before the run.
3. The twelve names of R1: the QA spec says thirteen; the spec of TOKI-093 lists twelve. The row compares the twelve of the spec.
4. `pnpm test` needs PostgreSQL: the row is Blocked unless the lead allows a temporary cluster as TOKI-008 does.
5. The browser: the cached Chromium may not match the Playwright version; the three browser rows then print `Blocked` with the first error line.
6. A leftover process or folder: the trap stops the Vite server and removes the folder; the last line shows both.
7. The two Node versions: Node 24 is the default and is refused by the repository; the script puts Node 22 first on `PATH` for every child process.
8. The full run takes about two minutes when the pnpm store is warm and longer with a cold store.
