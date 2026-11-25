# TOKI-130 QA of the platform package - implementation plan

**Goal:** TOKI-018 gets a QA record, run on the real repository at the merge commit of the pull request that delivered it, with the results whatever they are. This plan covers the kit that exists before the run: the plan, the checks script and the draft record. The run, the evidence file and the regenerated traceability table come after the QA approves the rows.

**Spec:** `docs/specs/2026-11-25-platform-package-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-130-platform-package-qa`. Documents and one bash script (with a few throwaway files that it writes into the temporary worktree); no existing file changes except `docs/traceability.md` (regenerated at the end). `Version:` is `f9aa289` (PR #144), decided in concern 1. `Expected` is the text of the spec of TOKI-018 as it stood at `f9aa289` (concern 3).

## Design

Same shape as `docs/qa/TOKI-008.*` and `TOKI-012.*`, with their lessons built in: every part of a sentence of a requirement is a printed number; a row names one requirement and one behavior; a row that loops prints how many items it checked; a check that must fail is paired with a run that must pass; a row that cannot run prints `Blocked` and the reason; the script keeps every temporary file under one folder made in the current shell (`BASE`, exported as `TMPDIR`, given to every process through `env -i`) and its last line shows that no worktree of the script is left, that the repository is unchanged, how many processes are alive and that the folder was removed; the notes claim no more than an output line shows.

- `docs/qa/TOKI-018.checks.sh` reads files of `V` with `git show`. Rows that run a tool use one temporary worktree of `V` (installed once with `pnpm install --frozen-lockfile`, removed by an `EXIT` trap, restored with `git checkout` and `git clean` after each row that changes it). Node 22 from `~/.nvm` and `corepack pnpm`, because the default Node 24 is refused by the repository. No `.env` is read or created.
- **Types** (T1 to T9): the TypeScript compiler API over the real package lists the exports, the members of `Platform` and the methods of each; made-up files in `apps/web/src` import `@toki/platform` and `@toki/platform/web` through the real `exports` and assign the result of `createWebPlatform()` to `Platform`, each paired with a file that must fail. A Node process with no DOM (`tsx`) runs R2 and R4; ESLint runs on the files the interface entry loads, paired with a `window` use.
- **Browser rows** (T10 to T47, T66): `@playwright/test` of `V`, the Chromium it has cached (new headless mode) and the Vite dev server of `apps/web` on a free loopback port. The page is made up and served at the origin of the dev server; it loads the web implementation from the dev server. One browser run feeds all rows; each row prints the values the run saw and, where the check is a zero (R5), a positive control from the same page. Storage uses persistent profiles in `BASE` (closed and opened again for R7); a real quota is filled to `QuotaExceededError` (R9); site data is blocked in a profile so that reading `localStorage` throws `SecurityError` (R9); the permission is granted by Playwright or denied by the headless browser; the file dialog is answered with `setFiles` after a real press, `cancel` is sent as an event because Playwright cannot press Cancel; a call with no press is made by a page script at load; the sound is a made-up two-second wav and autoplay is blocked until a press.
- **Lint rows** (T48 to T61): one `pnpm lint -f json` run on made-up files, one for each case, under the four packages, `platform` and `ui-web`; one run with only the allowed import. The test `tools/lint-rules/platform-boundary.test.mjs` runs as it is and with one change to `eslint.config.js` (the ban removed, rule 1 covering `src/web`, rule 1 not covering the interface files, the ban removed from rule 3), which must make it fail and name the case.
- **R27** (T69 to T73): the five commands at the root of an unchanged worktree; `pnpm test` runs with a temporary PostgreSQL made with `initdb` on a loopback port.
- **Manual row** (T74): Chrome, Safari and Firefox by hand (the dialog, the prompt, the sound, a `device` value after the browser is closed). `Blocked` until the QA pastes the result.
- The Testing section of the spec says a search of the repository for `@toki/platform/web` finds three kinds of file; the search at `V` also finds `eslint.config.js`, where the string is the ban itself. T68 searches for imports, which is what R26 states.
- Output is counts, exit codes and words. Rows are drafted by Claude and approved by the QA before any row is run. The script is debugged on mutated copies (a dangling commit with one changed line); a debug run of a real row is not evidence.

### Rows (one or more for each requirement)

| ID | TOKI-018 | What is compared |
| :-- | :-- | :-- |
| T1 to T3 | R1 | five type and two function exports and nothing else; the four members; the methods of each member and of `StorageArea` |
| T4, T5 | R2 | `getPlatform()` throws and names `setPlatform`; it returns `p`, then `q` |
| T6, T7 | R3 | `createWebPlatform` is the one value export of `./web` and its result is a `Platform`; exactly the two `exports` entries |
| T8, T9 | R4 | import in Node with no DOM; the loaded files pass rule 1 (paired with `window`) |
| T10 to T13 | R5 | no prompt, no storage write, no audio object or request, no element (each with a positive control) |
| T14 to T16 | R6 | four methods on each area; `set` then `get`; `null` for an unset or removed key |
| T17 to T19 | R7 | `device` in a second instance, another tab and after a restart; `tab` after a reload and not in another tab; the two stores |
| T20, T21 | R8 | the `toki:` prefix; `clear()` removes only prefixed keys |
| T22, T23 | R9 | storage the browser refuses to read; a real quota |
| T24, T25 | R10 | the four values; `unsupported` without `Notification`, otherwise the browser's own |
| T26, T27 | R11 | the answer after the person answered; only `requestPermission` asks |
| T28, T29 | R12 | `unsupported` without `Notification`; a throwing and a rejecting request |
| T30 to T33 | R13 | the dialog opens; the result shape and order; `multiple`; at most one without it |
| T34, T35 | R14 | `accept` reaches the dialog; none without it |
| T36, T37 | R15 | cancel gives an empty list; `pick` does not reject |
| T38, T39 | R16 | a second call resolves the first with an empty list; a call with no press stays unanswered |
| T40, T41 | R17 | 200 MB and 13 files; no element left once resolved |
| T42 | R18 | the given address, played once, `true` |
| T43 to T45 | R19 | blocked before any interaction; a file that cannot be loaded; no address or an unknown name |
| T46, T47 | R20 | no request before the first `play`; a second `play` restarts the same element |
| T48, T49 | R21, R22 | 20 banned imports and four test files in the four packages; the allowed import on a clean tree |
| T50 to T53 | R23 | the test file and the scripts; both scripts name it; `pnpm test:lint-rules`; the ban removed fails the test |
| T54 to T57 | R24 | rule 1 over the interface files; `src/web` and test files outside; two changes to the block fail the test |
| T58 to T61 | R28 | five banned forms in `ui-web`; the allowed import; a test file; the ban removed from rule 3 fails the test |
| T62 to T64 | R25 | no `dependencies`; no import of `@toki/i18n`; no text sink in the sources |
| T65 to T68 | R26 | the call before the mount; the app mounts with the platform set; `workspace:*`; the only importer |
| T69 to T73 | R27 | `typecheck`, `lint`, `test:lint-rules`, `format:check`, `test` |
| T74 | R13 (and R7, R10, R18, R19) | manual: the by-hand checks in Chrome, Safari and Firefox |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-018.checks.sh` | run on dangling mutated copies (the prefix dropped, `setPlatform` left out of the message, `window` in the interface entry, the call in `main.tsx` removed, an `Audio` or a prompt at creation, `pick` not resolving the earlier call, `play` not restarting, the ban removed from the lint configuration, a `dependencies` entry, a throwing `set`, `unsupported` removed): the matching rows change; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-018.md` (unapproved, unrun) | `qa-ready.sh` reports only `has not been run` lines |
| R4, R6, R7 | 3. QA approves rows; Claude runs the command rows; the QA runs the manual row | results and evidence in the record |
| R6, R8 | 4. Result notes (what changed since `f9aa289`), `trace.sh` | the TOKI-018 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no worktree, folder or process left |

## What can break (riskiest first)

1. A row that passes because it measured nothing: every item is a printed count and Expected names the count; the R5 zeros print a positive control from the same page; the lint rows print how many files they linted.
2. A row that fails because the check is wrong and not because the ticket is: the mutated copies show that each key row moves when one line changes, and the places where the spec and the code differ are listed for the lead before the run (T51: the `test` script runs the file through `test:lint-rules` and does not name it).
3. The browser: the Playwright of `V` needs a Chromium that is cached; the browser rows then print `Blocked` with the first error line. Autoplay and user activation: Playwright's own calls (`evaluate`, `waitForFunction`) count as a press, so the rows that need no press use a page script at load and wait on a console message.
4. A leftover process or folder: the trap stops the Vite server, the PostgreSQL and the worktree and removes the folder; the last line shows each.
5. The two Node versions: Node 24 is the default and is refused by the repository; the script puts Node 22 first on `PATH` for every child process.
6. Safari and Firefox are not run by command: T74 stays `Blocked` until the QA pastes the result.
