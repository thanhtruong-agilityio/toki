# TOKI-126 QA of the overlays - implementation plan

**Goal:** TOKI-014 (the Menu, Modal and Sheet of `ui-web`) gets a QA record that tests each of its 34 requirements at the merge commit `71cb9085` (PR #145), with a checks script that prints one line for each row, ready for the QA to approve and for Claude to run.

**Spec:** `docs/specs/2026-11-25-overlays-qa-design.md` (R1 to R10), all four concerns decided. Spec under test: `docs/specs/2026-11-16-overlays-design.md`. Tier M. Branch `docs/toki-126-overlays-qa`. This plan covers the kit only: the plan, `docs/qa/TOKI-014.checks.sh` and the draft `docs/qa/TOKI-014.md`. The evidence file, `Approved`, `Result`, `Run`, the result notes and the regenerated `docs/traceability.md` come after the QA approves the rows.

## Design
- **Version.** Every row is judged at `V = 71cb9085`, the merge commit of PR #145 (concern 1). The script reads files with `git show $V:path`. Rows that run code use one temporary worktree of `V` under one `BASE` folder (made in the current shell, exported as `TMPDIR`, given to every child through `env -i`), with `corepack pnpm install --frozen-lockfile` under Node 22 (the default node is 24, which the repo refuses). An `EXIT` trap removes the worktree, the processes and `BASE`, and the last line is `CLEAN worktrees same status same processes 0 temporary-folder removed`.
- **Three probes of my own, so that a Pass does not rest only on the ticket's tests (QA spec R3).**
  1. A Vitest probe file written into the temporary worktree (`src/zz-qa/probe.test.tsx`): exports, DOM shape of the three components, `computeMenuPosition` with seven hand-computed cases, `useMenuTrigger`, the three CSS files parsed with PostCSS and compared with Tables A to D typed in the probe, the vocabulary of the CSS, a scan of the sources. It writes a JSON file; rows read numbers from it.
  2. A TypeScript probe (`types.tsx`, `errors.tsx`): the types of R1 compile, `triggerProps` spreads on three elements, and the 11 mistakes of R32 are each marked `@ts-expect-error`; removing one marker at a time must make `tsc` fail (11 of 11).
  3. A throw-away page (`apps/web/zz-qa.html`) served by Vite on a free loopback port and a Playwright script (`zz-browser.mjs`) that drives the Chromium cached by Playwright: Esc order, outside presses, focus in, the trap, focus return, scroll lock, `inert`, the Menu keys, the position, z-order with a real toast, the 13 examples, and the narrow-screen sizes at 360 x 560, 719, 720, 1099 and 1100 px in Calm and Focus. The preview page of TOKI-016 does not exist at `V`.
- **Pairs.** A check that must fail is paired with a changed run: a file of the temporary worktree is changed (`z-index`, `position: sticky`, `inert`, `data-layer-skip`, `markPressHandled`, the order of the stack, `removeLayer`, `+ 4` in `menuPlace.ts`, a colour, a `transition`, an `opacity: 0` on hover, a banned import and API, a `window.localStorage`, an unformatted line, a type error), the row's number is printed again after `mut`, and `git checkout` restores the file. The changed trees are run once each for the vitest probe and twice for the browser (one set of changes, and the stack order reversed).
- **Rows.** 79 rows in 12 groups (the groups of the QA spec Design table). A row names one requirement; a requirement with several behaviors is split. Each row prints counts, ids, exit codes and words, never tool output; a row that loops prints how many items it checked. `T66` is the one `manual` row (likeness to the prototype, concern 3): Blocked until the QA pastes the result.
- **Expected** is what the spec of TOKI-014 states. Where the output at `V` does not match, the row keeps the spec's value and the real run will Fail; the record says so in the result notes after the run, not before.

| Group | Requirements | Rows |
| :---- | :---- | :---- |
| Files and conventions | R1, R2, R3 | T1 to T9 |
| Cleanup and DOM | R4, R5, R6, R7 | T10 to T14 |
| Close requests, Esc, one press one layer | R8, R9, R10 | T15 to T19 |
| Focus in, trap, return | R11, R12, R13, R16 | T20 to T27, T30, T31 |
| Lock and isolation | R14, R15, R33, R34 | T28, T29, T78, T79 |
| Menu | R17 to R22, R24 | T32 to T48, T50 to T52 |
| Position | R23 | T49 |
| CSS | R25 to R28 | T53 to T60 |
| Narrow screens | R29 | T61 to T66 |
| Examples | R30 | T67, T68 |
| Boundaries and checks | R31 | T69 to T76 |
| Types | R32 | T77 |

## AC -> step -> test
| Req | Step | Test |
| :---- | :---- | :---- |
| QA R1, R2 | 1. Draft `docs/qa/TOKI-014.md` with a row for each requirement R1 to R34 | `bash .github/scripts/qa-ready.sh TOKI-014` prints only "has not been run" lines |
| QA R3, R5 | 2. Write `TOKI-014.checks.sh` | run at `V`: one line for each row, then `CLEAN ...`; `git worktree list` and `git status --porcelain` unchanged; no process left |
| QA R3 | 3. Mutated runs | each `mut` number differs from the unchanged number of its row |
| QA R3 | 4. Two full runs | identical lines |
| QA R4 | 5. QA approves the rows | later: `Approved` filled before any official run |
| QA R6 | 6. `Version:` is `71cb9085` | header of the record |
| QA R9 | 7. Only added files | `git diff main --stat` shows the three files (plan, script, record) |

## What can break (riskiest first)
1. A browser row that passes because it cannot fail: each state is read after an action that changes it, the listener probe shows non-zero counts while a layer is open, and a changed tree (stack, isolation, sticky header, hover, `markPressHandled`) makes the matching number change.
2. Timing in the browser rows (focus after a render): the driver waits for a ready flag and short fixed pauses; two identical runs are the check.
3. Chromium or Node 22 missing on the machine of a later run: the row prints `Blocked` and the first error line, never a pass.
4. A leftover worktree, Vite process or folder: one `BASE`, the `EXIT` trap, a process count and the `CLEAN` line.
5. Rows that depend on tool versions (pixel heights): only inequalities and sizes the spec states are compared (40 px, 8 px, 520 px, the window edge); font-dependent heights are not part of `Expected`.
6. Requirements that no longer match the repository (`pnpm lint:boundaries`, shared files that changed): the row keeps the spec's value and fails honestly; the BA decides what to amend.
