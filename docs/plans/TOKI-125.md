# TOKI-125 QA of the base components, group 2 - implementation plan

**Goal:** TOKI-013 (the Avatar, the presence dot, the empty state and the Toast of `ui-web`) gets a QA record at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-base-components-2-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-125-base-components-2-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `845725a` (PR #142, 2026-11-18), decided in concern 1. Concern 2 decided: a temporary worktree of `845725a` with `pnpm install` run in it, the unit tests of `ui-web`, the Vite dev server on a free loopback port and the Chromium that Playwright has cached; concern 3 decided: R17 and R29 are command rows driven by Playwright against a temporary page that exists only in the temporary worktree, and the by-eye, screen reader and phone checks are `manual` rows, Blocked until the QA pastes a result.

## Design

Same shape as the earlier QA tickets, with every lesson built in from the start: each part of a sentence of a requirement is a printed number; a row names one requirement; every check that must fail is paired with a run that must pass (a changed file of the temporary worktree, restored with `git checkout`, or a changed copy of the text held in memory for rows that only read files); a row prints `Blocked` and never a Pass when it cannot be shown; one `BASE` folder made in the current shell holds every temporary file (exported as `TMPDIR` and given to every child through `env -i`), so a worktree, a probe and a result file all live under it; the last line shows no process left, the folder removed and the repository unchanged; `grep -q` is never used under `pipefail`; empty arrays are expanded with `${a[@]+"${a[@]}"}`; `perl -0pi` replaces `sed -i ''`.

- **One temporary worktree of `845725a`** with `corepack pnpm install --frozen-lockfile` under Node 22 (the default Node 24 is refused by the repository). The probe (a Vitest file that renders the components and writes its measured values to a file), the type probe (a `.tsx` file of cases that `tsc` must refuse, run with and without `@ts-expect-error`), the temporary page, its Vite entry and the Playwright driver are written into the worktree, used, and deleted. Nothing is added to the repository; no `.env` is read or created.
- **The unit tests of the ticket** run once with the JSON reporter; a row reads the tests it relies on by name (the test file and the test names are in `Steps`) and prints how many passed and how many failed. A row that relies on a test is paired with a mutated copy (a constant, a line) that makes the named test fail.
- **The probe** gives independent values for the Avatar, `getInitials`, the dot, the empty state and the Toast markup, so a row does not rest only on the ticket's own tests.
- **The browser rows** start the Vite dev server of `apps/web` on a free port found with `python3`, open the temporary page with the cached Chromium in Calm and Focus at the widths of the spec, and read `getBoundingClientRect`. The run is paired with a changed `EmptyState.css` and a changed `toastPlace.ts`, and with a page that registers nothing.
- **The manual rows** (by eye against the prototype, a screen reader, a phone) print `Blocked`. `V=<commit> bash docs/qa/TOKI-013.checks.sh serve` starts a review page for them (the examples of the four components with a look, an accent and a density switch, and buttons that show toasts) and stops on the Enter key.
- Output is counts, exit codes and words. No tool output and no secret.
- Rows are drafted by Claude and approved by the QA before any row is run. Debug runs of the script are not evidence.

### Rows (ids follow the requirement numbers; a requirement with several behaviors is split with a letter)

| ID | TOKI-013 | Output compared with Expected |
| :-- | :-- | :-- |
| T1A to T1C | R1 | the four folders and their five files and helpers, with no other file; one `export *` line for each folder in `components/index.ts` and named exports in each `index.ts`; `src/index.ts` not changed by the delivering PR |
| T2A to T2C | R2 | the 15 runtime names are exported; the five types are imported by `tsc` without error; the ticket's export tests pass |
| T3A to T3C | R3 | no import of `@toki/i18n`, `@toki/tokens` or `@toki/platform` and no storage, notification, service worker or audio API in 12 source files; no colour literal and no custom property outside the 32 names of TOKI-009 R10 and `--h`, `--s` in the four `.css` files; each component rendered with no text prop has an empty `textContent` |
| T4A to T4F | R4 | `forwardRef` in the five components; `ref` reaches the root; `className` is appended and attributes pass; owned attributes survive a cast; `typecheck` exits 0 with the 14 `@ts-expect-error` lines in place and fails when an owned attribute is let through; the types refuse owned attributes |
| T5A to T5G | R5 | no dependency gained; `pnpm install`, `typecheck`, `lint`, `lint:boundaries`, `format:check` and `pnpm --filter @toki/ui-web test` each give their exit code |
| T6A to T6F | R6 | the markup of `<Avatar name="Lan Nguyễn" hue={172} />`; `--s`; `aria-label`, `aria-labelledby` and `title` removed; the props type refuses `title`, `src`, `alt` and children; merged `style`; `ref` on the root |
| T7A to T7E | R7 | the five examples of the spec, `"Ông Ba"` giving `ÔB` only after NFC, one word, empty and white-space names that never throw, runs of white space and an astral first letter |
| T8A, T8B | R8 | the hue modulo 360 and a non-finite hue giving 0; a `size` that is not a finite number above 0 gives no `--s` |
| T9, T13, T16, T20A, T20C, T20D, T21B, T32, T33, T10D | R9, R13, R16, R20, R21, R32, R33, R10 | the declaration list of each named rule read from the `.css` file at `845725a`, with a changed copy that must differ |
| T10A to T10E | R10 | wrapper and dot as second child; `className`, `style`, `ref` and attributes on the wrapper, `--h` and `--s` on `.av`; no wrapper without `presence`; the dot has no label unless one is given |
| T11, T12A, T12B | R11, R12 | `presenceStates`; the classes of each state; `state` is required |
| T14A to T14C | R14 | `role="img"` with a label; `aria-hidden` without; `presenceLabel` of `Avatar` reaches the dot |
| T15A to T15E | R15 | the order `div.eic`, `b`, `span`, action; the icon at 26; `filtered` and `role="status"`; the types; nothing follows the description |
| T17A to T17C | R17 | Chromium, Calm and Focus at 360, 720 and 1100 px: the centre of the content is within 1 px of the centre of a flex-column parent (horizontal and vertical); a block parent does not centre vertically; a changed `EmptyState.css` makes the vertical row fail |
| T18A to T18D | R18 | no text and no button of its own; the props type omits `children` and `role`; `ref` is `div.empty`; a caller's `role` is dropped |
| T19A to T19D | R19 | the Toast markup and no `role`; the button of type `button` after the span; no timer and no state; the props type |
| T21A, T22A to T22C, T23A to T23E, T24, T25A to T25C, T26 | R21 to R26 | the tests of the ticket by name, with fake timers, each paired with a mutated constant or line |
| T27, T28A to T28F, T31A to T31C, T34A, T34B | R27, R28, R31, R34 | the table of `computeToastBottom` and `computeToastExtent` from the probe and the tests of the ticket by name, each paired with a mutated copy |
| T29A to T29C | R29 | Chromium, Calm and Focus at 360, 720, 800, 1099 and 1100 px with a registered composer, a registered bar hidden by a transform, a sidebar and three toasts; paired with a changed `toastPlace.ts` and with a page that registers nothing |
| T30A to T30F | R30 | the examples of the four components hold the cases the spec lists; ids unique; four entries in order; the tests of TOKI-012 pass |
| T9M, T13M, T16M, T20M, T19M, T34M | R9, R13, R16, R20, R19, R34 | manual: the comparison with the prototype, VoiceOver and NVDA, a phone with its keyboard |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-013.checks.sh` | run on a mutated copy (initials function, a CSS declaration, a timer constant, a cap, an obstacle gap, the width share, the max of R34): the matching rows change; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-013.md` (unapproved, unrun) | `qa-ready.sh` reports only the rows that have not been run |
| R4, R6 | 3. QA approves rows; I run the rows in groups | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `845725a`), `trace.sh` | the TOKI-013 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no process, worktree or folder left; no write to GitHub |

## What can break (riskiest first)

1. A row that passes without measuring: every case that must fail is paired with one that must pass and the numbers are printed.
2. The browser rows: the Chromium revision that Playwright expects may not be in the cache (the rows are `Blocked` with the first error line); the page and the toasts timers (a toast leaves after 2.8 s, so the measures are taken within a second).
3. A requirement that names a script that does not exist at the Version (`pnpm lint:boundaries`): the row shows the exit code as it is.
4. R29 asks for a 272 px sidebar at every width, so at 360 px in Calm the anchor is 88 px wide; the row follows the spec as written and the result notes say what it shows.
5. Running time: a full run takes a few minutes; the script takes row ids so the rows can be run in groups.
6. Mutating files of the temporary worktree: each mutation is restored with `git checkout` and paired with an unmutated run.
