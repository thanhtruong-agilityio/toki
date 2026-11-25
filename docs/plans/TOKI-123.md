# TOKI-123 QA of the icon set - implementation plan

**Goal:** TOKI-011 gets a QA record at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-icon-set-qa-design.md` (R1 to R10), all four concerns decided. Tier M. Branch `docs/toki-123-icon-set-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `5d8f49a` (PR #133, 2026-11-18), decided in concern 1. Concern 2 decided: a temporary worktree with its own install, the Chromium that Playwright has cached, a free port. Concern 4 decided: R8 is Blocked (the prototype file is not in the tree at the Version) and the look is a manual row.

## Design

Same shape as the QA of TOKI-008, with its lessons built in: each part of a sentence of a requirement is a printed number; a row names one requirement; every check that must fail is paired with a run that must pass; a row prints `Blocked` and never a Pass when it cannot be shown; one `BASE` folder made in the current shell holds every temporary file (exported as `TMPDIR` and given to every process through `env -i`); the last line shows no worktree of the run, no process and no folder left and the repository unchanged.

- **The oracle is the spec of TOKI-011 at `V`.** The script reads Table A (43 names, components, paths) and Table B plus the seven never-drawn names (the 32 left-out names) from `git show V:docs/specs/2026-11-16-icon-set-design.md`, so no list is typed twice.
- **One Vitest harness** (`zz-qa.test.tsx`, added to the temporary worktree and removed after the run) imports the package and renders each of the 43 names with `renderToStaticMarkup`. It prints counts for the rows that read markup and exports: T1 to T5 (S, W, C, P, O), T7, T9, T16. The TypeScript API reads the exports with their types (T1X) and the top-level statements of `icons.tsx` (T11M, paired with a planted `console.log`).
- **Type rows** (T2T, T3T, T7T, T15) write one valid file, one file of bad lines and the same bad lines with `@ts-expect-error`, and run `tsc --noEmit` of `ui-web` three times. Each row prints the exit code of the valid file, the number of bad lines, the number that gave an error, and the exit code of the directive file. A bad line differs from a valid line only by the prop under test.
- **Tool rows:** T10 adds an icon the way the spec says (green) and then breaks it three ways in the temporary worktree (a name in `iconNames` without an export, an export that is not in `iconNames`, a left-out name that appears); T12 and T13 run the repository's own install, typecheck, test, lint and format commands; the banned-API and format checks are paired with a planted file that must fail.
- **Browser rows** (T5B, T6B): the Vite dev server of `apps/web` of the worktree on a free port, a scratch page that draws the 43 icons in Calm and Focus (`data-eff`), the cached Chromium through `playwright-core` 1.65.1 installed into `BASE`. They compare the computed `stroke` of each icon with the colour of its parent and measure the boxes; the two looks must give different parent colours.
- **Manual and Blocked:** T4M (the look next to the prototype) and T8 (the paths against the prototype's table) print `Blocked` and the reason; `GALLERY` mode starts the dev app and prints the two addresses for the QA.
- Output is counts, exit codes and words. No `.env` is read or created. Rows are drafted by Claude and approved by the QA before any row is run. Debug runs on mutated commits are not evidence.

### Rows (one requirement each; split rows carry a letter)

| ID | TOKI-011 | What is compared |
| :-- | :-- | :-- |
| T1 | R1 | the 43 components of Table A exist; none of the 45 expected names is missing |
| T1X | R1 | the exports with their types are exactly the 47 names (43, `Icon`, `iconNames`, `IconName`, `IconProps`) |
| T2 | R2 | `iconNames` has 43 entries, equal to Table A in order |
| T2T | R2 | `IconName` is exactly the 43 names; a name outside, or a left-out one, is a type error |
| T2N | R2 | no non-test source of `src/icons` checks a name at run time (no throw) |
| T3 | R3 | `<Icon name>` and the named component give the same markup, 43 of 43 |
| T3T | R3 | `name` is required |
| T4 | R4 | one `svg` with exactly the ten attributes and one `path`, 43 of 43 |
| T4D | R4 | the `d` of each path equals Table A |
| T4M | R4 | by eye: the look next to the prototype (manual, Blocked) |
| T5S, T5W, T5C, T5P, T5O | R5 | `size`; `strokeWidth`; `className`; pass-through attributes; the attributes the icon owns win over a cast |
| T5B | R5 | in Chromium: 18 by 18 by default and 30 by 30 with `size={30}`, in both looks |
| T6 | R6 | no colour literal and no tokens import in the non-test sources; detectors proven on a planted text |
| T6B | R6 | in Chromium the stroke of every icon is the colour of its parent, in Calm and Focus |
| T7, T7T | R7 | `aria-hidden="true"` always; `aria-label`, `aria-labelledby`, `aria-hidden`, `title`, `children` are type errors |
| T8 | R8 | Blocked: the prototype's icon table is not in the tree at `V` |
| T9 | R9 | none of the 32 left-out names in `iconNames`, exports or `paths.ts`; control with the 43 |
| T10 | R10 | adding an icon turns the tests green only with all edits; each wrong edit turns the named test red |
| T11S, T11E, T11M | R11 | `sideEffects` and `exports`; `src/index.ts` re-exports `./icons`; the top-level statements of `icons.tsx` |
| T12I, T12T, T12U | R12 | install and declared dependencies; typecheck and where `jsx` and `DOM` are set; the package's tests |
| T13L, T13F, T13B, T13A | R13 | lint; format check; `lint:boundaries`; no banned platform API |
| T14 | R14 | no import or dependency of `@toki/ui-web` in `apps/web`, and the delivery did not touch `apps/web` |
| T15 | R15 | every owned attribute and `ref` is a type error on a named icon and on `Icon` |
| T16 | R16 | every drawing export is `Icon` or ends in `Icon`; no other export ends in `Icon` |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R1, R2, R3 | 1. Write the checks script with the harness and the type rows | run on mutated commits (a path changed, an export added, a name left out, the order swapped): the matching row changes; two identical runs |
| R3, R5 | 2. Add the tool rows and the browser rows | a stroke colour changed, a default size changed: T4, T5, T6B and T5B change |
| R2, R4, R6 | 3. Draft the record, one row per requirement, from the Design table of the spec | `qa-ready.sh TOKI-011` lists only rows that have not been run |
| R4 | 4. The QA approves the rows, then Claude runs them and keeps the evidence | no `Result` without `Approved` |
| R5, R6 | 5. The script is run for the evidence | the `CLEAN` line shows no worktree, process or folder left and the repository unchanged |
| R7, R9, R10 | 6. Result notes (which Success Criterion of I02 each row feeds, what changed since `V`), `trace.sh` | `docs/acceptance/` gains no file; `git diff` shows added files and `traceability.md` only |

## What can break (riskiest first)

1. A check that cannot fail: each row is shown to change on a mutated commit; the checks that must fail (type errors, banned API, format, the three wrong icon edits, the colour detectors) are paired with a run that must pass.
2. The browser: the Chromium revision may not match `playwright-core`; the row is then Blocked with the first error line, never Pass. The runner closes the browser and exits on any error.
3. Requirements that describe the repository when the ticket closed: `lint:boundaries` named by R13 is absent at `V`, so T13B is expected to Fail and the notes say what changed.
4. A worktree, a Vite process or a folder left behind: one `BASE`, the `EXIT` trap, the process tree kill and the `CLEAN` line.
5. Other sessions on the machine add and remove worktrees: the `CLEAN` line checks only the worktrees of this run.
