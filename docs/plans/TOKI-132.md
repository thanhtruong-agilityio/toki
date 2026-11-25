# TOKI-132 QA of shared date and time rules - implementation plan

**Goal:** TOKI-094 gets a QA record, run on the real repository at the merge commit of the pull request that delivered it, with the results whatever they are. This plan covers the kit that exists before the run: the plan, the checks script and the draft record. The run, the evidence file and the regenerated traceability table come after the QA approves the rows.

**Spec:** `docs/specs/2026-11-25-date-time-rules-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-132-date-time-rules-qa`. Documents and one bash script (with one throwaway TypeScript harness and a few throwaway files that it writes into the temporary worktree); no existing file changes except `docs/traceability.md` (regenerated at the end). `Version:` is `73036185` (PR #152), decided in concern 1.

## Design

Same shape as `docs/qa/TOKI-002.*`, `TOKI-007.*` and `TOKI-008.*`, with their lessons built in: every part of a sentence of a requirement is a printed number; a row names one requirement; a row that loops prints how many items it checked; a check that must fail is paired with a run that must pass; a row that cannot run prints `Blocked` and the reason; the script keeps every temporary file under one folder made in the current shell (`BASE`, exported as `TMPDIR`, given to every process through `env -i`) and its last line shows that the folder was removed, that no worktree of the script is left and that the repository is unchanged; the notes claim no more than an output line shows.

- `docs/qa/TOKI-094.checks.sh` reads files of `V` with `git show`. Rows that run code use one temporary worktree of `V` (installed once with `pnpm install --frozen-lockfile`, removed by an `EXIT` trap). Node 22 from `~/.nvm` and `corepack pnpm`, because the default Node 24 is refused by the repository. No `.env` is read or created. No database, server, port or browser: the module is pure functions.
- **One harness.** A TypeScript file (run with `tsx`, which `apps/server` already has) imports the real exports of `@toki/shared`, calls them with fixed instants and zones and prints, for each row, a list of numbers. It reads no clock. It is written into the worktree for one run and deleted after it, so lint and typecheck rows never see it. The expected values come from the spec of TOKI-094 (its examples and its rules), not from the delivered tests; the delivered suite has one row of its own.
- **Pairing in the script.** Each harness row is paired with a mutated copy: one line of a source file in the temporary worktree is changed (for example `15:05` becomes `18:05` by shifting the hour), the harness runs again, the file is restored, and the last number of the row is 1 when the results of the row changed. A mutation that does not apply prints `Blocked`. The key rows are also tried on dangling commits made with `git commit-tree` (`V=<mutant>`), where the matching row prints other numbers than Expected.
- **Time zones.** `TZ=UTC` and `TZ=Pacific/Auckland` are set for one command each (the delivered suite, T45, and the harness, T46); a third run adds `TZ=America/Los_Angeles` with a Vietnamese locale. The machine's own settings are not changed. T46 is paired with a copy that drops the `timeZone` option of the `Intl` call, and the two runs of that copy differ.
- **No manual rows.** None of the requirements is a by-eye comparison with the prototype.
- Two points are not rows (concern 3 of the QA spec): the `.js` import paths where the Layout says extensionless, and the range limit on instants that R7 does not name. They go into the result notes of the run.
- Output is counts, exit codes and words. Rows are drafted by Claude and approved by the QA before any row is run. A debug run of a real row is not evidence.

### Rows (one or more for each requirement)

| ID | TOKI-094 | What is compared |
| :-- | :-- | :-- |
| T1, T2 | R1 | the four examples of `formatTime`; 576 results over six zones never hold `AM`, `PM` or `24:` |
| T3 to T6 | R2, R3 | the date text and its names (Table B of the spec); the year when it differs, with `year: "always"`, and read in the zone and not in UTC |
| T7 to T9 | R4 | the three day words at the edges of the day; the 23:30 case and the 24-hour trap; any other day gives the date |
| T10, T11 | R5 | the five examples; the day, a space, the time over 40 instants |
| T12 to T14 | R6 | the two examples and the whole seconds; zero and below; values that are not finite |
| T15 to T18 | R7 | bad instants in each instant place; bad zones in each zone place; `formatCountdown`; no string holds `Invalid Date`, `NaN` or `undefined` |
| T19 to T21 | R8 | only the day words, names, digits, spaces and colons; 7 and 12 names; `vi` and `fr` give English |
| T22 to T24 | R9 | the seven parts; the four offsets; `isValidTimeZone` |
| T25 to T28 | R10 | today and tomorrow in the zone; the gap; the overlap; a bad `time` |
| T29 to T35 | R11, R12, R13 | `required` and its `field`; `invalid`; a time in a gap; `past` at before, equal and after; an overlap |
| T36 | R14 | the six cases |
| T37 to T39 | R15 | `required` and `invalid`; the zone day against the UTC day; today accepted |
| T40 to T42 | R16 | the order; the instants and the swap at 15:00:00; every `at` later than `now` over 576 instants |
| T43 to T46 | R17 | no clock call; no ambient setting; the delivered suite under two `TZ` values; the same results under three environments |
| T47 to T52 | R18 | 13 names exported and the export line; the two types; `pnpm typecheck`; `pnpm lint`; the allow list of globals; no new dependency |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-094.checks.sh` | run on dangling mutated copies (the hour shifted, `Math.min` turned into `Math.max`, a `Date.now()` added, the `timeZone` option dropped): the matching rows print other numbers; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-094.md` (unapproved, unrun) | `qa-ready.sh` reports only `has not been run` lines |
| R4, R6, R7 | 3. QA approves rows; Claude runs the command rows | results and evidence in the record |
| R6, R8 | 4. Result notes (what changed since `73036185`), `trace.sh` | the TOKI-094 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no worktree or folder left |

## What can break (riskiest first)

1. A row that passes because it measured nothing: every item is a printed count and Expected names the count; the last number of each harness row shows that a changed source line changes the row.
2. A row that fails because the check is wrong and not because the ticket is: the expected values are taken from the examples and rules of the spec, and checked by hand against the calendar (days of the week, the changes of the clock in New York and Auckland).
3. A mutation that stops applying when the source changes: the row prints `Blocked` with the reason and its numbers, never a pass.
4. The two Node versions: Node 24 is the default and is refused by the repository; the script puts Node 22 first on `PATH` for every child process.
5. The machine's own time zone leaking into a row: every child runs under `env -i`, and the two `TZ` rows set it on purpose.
6. The full run takes about one minute when the pnpm store is warm and longer with a cold store.
