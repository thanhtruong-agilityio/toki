# TOKI-122 QA of the self-hosted fonts - implementation plan

**Goal:** TOKI-010 gets a QA record at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-self-hosted-fonts-qa-design.md` (R1 to R10), all four concerns decided. Tier M. Branch `docs/toki-122-self-hosted-fonts-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `5a8e7df` (PR #171, 2026-11-19), decided in concern 1. Concern 2 decided: a temporary worktree with its own install, the cached Chromium and free loopback ports. Concern 3 decided: browser rows are command rows; the by-eye rows are `manual`. Concern 4 decided: rows are judged against the spec as written, so the fonts folder `apps/web/src/fonts/` is expected to fail where the delivered files are in `apps/web/assets/fonts/`.

## Design

Same shape as the earlier QA tickets: each part of a sentence of a requirement is a printed number; a row names one requirement and one behavior; every row that must fail carries a control (a mutated copy, a restored worktree file, or a stand-in value) that the same check must flag; a row prints `Blocked` and never a Pass when it cannot be shown; one `BASE` folder made in the current shell holds every temporary file (exported as `TMPDIR` and given to every process through `env -i`); the last line shows the repository, no process and no folder left.

- **File rows** (R1, R2, R6, R7, R8, R14, R15, R18) read files of `V` with `git show`; no install. The path rows read the spec's folder and print, on a detail line, where the delivered file is and the same measure there.
- **Font rows** (R3, R4, R5) read the seven files with fontkit 2.0.4 from the worktree install (a code point counts only when it has a glyph; the cmap sentinel U+FFFF has none).
- **Build rows** (R9, R10, R11, R17) run `pnpm --filter ./apps/web build` once in the worktree and read `dist`.
- **Browser rows** (R12, R13): `vite preview` on a free port, the cached Chromium through Playwright, the rendered fonts read over the DevTools Protocol. A sample page and a control page are written into the worktree's `dist` (never into the repository). R13 is checked character by character (each distinct character of the sample line alone) and for the whole line, in each of the three families.
- **R16**: `check:fonts` on the built worktree, then each mutation of the spec's Testing (a removed file, a changed weight, a second preload, a changed SHA-256, no `dist`), each restored and rerun. The uncut-font mutation needs the uncut upstream font and is `Blocked` when none is available offline. Lint and format of the script are run with a made-up change as the control.
- **Manual rows** (R13): Safari, and the Bricolage Grotesque title against the prototype. `Blocked` until the QA pastes the result.
- The script takes row ids, so rows can run in groups; the evidence file keeps the output of each group.
- Output is counts, exit codes and words. No `.env`, no secret, no tool output.
- Rows are drafted by Claude and approved by the QA before any row is run. The debug runs of the script are not evidence.

### Rows (one for each behavior of a requirement)

| ID | TOKI-010 | What is compared |
| :-- | :-- | :-- |
| T1, T1B | R1 | seven WOFF2 files with the names of Table A in `apps/web/src/fonts/`; no other font file tracked under `apps/web` |
| T2, T2B, T2C | R2 | seven `@font-face` rules; each has family, normal, one weight, swap, one relative woff2 url; none has `local()` or `unicode-range` |
| T3, T3B, T3C | R3 | static (no axis); not italic; stored weight equals the row |
| T4, T4B | R4 | 241 code points in each of seven files; the record of missing code points is true |
| T5 | R5 | no glyph outside Table C |
| T6, T6B | R6 | each file at most 51,200 bytes; seven together at most 307,200 |
| T7, T7B | R7 | one `body` rule with the family list; `main.tsx` imports `fonts.css`, no other file does |
| T8, T8B, T8C | R8 | one font preload; it points at the 400 file; `type` and `crossorigin` |
| T9, T9B, T9C | R9 | seven hashed woff2 in `dist`, base `/`; seven urls with no scheme or host; no `data:font` |
| T10, T10B | R10 | preload href equals the built CSS url of the 400 file; the file exists |
| T11, T11B | R11 | no font service address in `index.html` and `src`; none in `dist` |
| T12, T12B, T12C | R12 | not-found text in Be Vietnam Pro; one font file, the preloaded one, once; no other host |
| T13, T13B, T13C, T13D, T13E | R13 | sample line in each family (Chromium); Safari and the Bricolage title (manual) |
| T14, T14B, T14C | R14 | seven complete entries; SHA-256 equals the file; recorded code points are allowed and true |
| T15, T15B | R15 | three licence files with the licence text; each entry names its family's file |
| T16, T16B to T16J | R16 | `check:fonts` exits 0; each mutation fails and names the file and requirement; lint; format; no global `process` |
| T17, T17B, T17C | R17 | build; typecheck; initial JavaScript under the limit |
| T18 | R18 | no file outside `apps/web` and the lock file in the delivering pull request |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R1, R2, R3 | 1. Write `TOKI-010.checks.sh` (file, font, build and browser rows) | run on `V`, and on a made-up commit with the fonts folder moved to the spec's folder and then six mutations: each matching row changes; two identical runs |
| R4 | 2. Draft `TOKI-010.md` (header, role, one row per behavior, Not covered) | `bash .github/scripts/qa-ready.sh TOKI-010` reports only `has not been run` lines |
| R5, R6 | 3. QA approves the rows; Claude runs them at `V` in groups; evidence file; the QA pastes the manual rows | no `Result` without `Approved`; every Pass names `V` and a line of the evidence file |
| R7 | 4. Result notes | each note has an evidence line; the notes say what `main` would change, without judging; the criteria of I02 are named, not judged |
| R8, R9, R10 | 5. `bash .github/scripts/trace.sh` and the checks | `git diff` shows added files and `docs/traceability.md` only; `docs/acceptance/` gains nothing |

## What can break (riskiest first)
1. A row that cannot fail: each carries a control; the made-up commit changes the matching rows.
2. The browser rows read a page that is blank at `V` (the guard waits for the session): T12 is expected to fail with its detail line, which is a finding, not a script fault.
3. A temporary worktree, process or port left behind: one `BASE` folder, the `EXIT` trap and the `CLEAN` line.
4. A different Chromium revision: the browser rows are `Blocked` with the first error line.
5. The uncut font for T16G is not available offline: `Blocked`, said in the notes.
6. The spec's folder is absent at `V`: the rows of R1, R2, R7, R14, R15 fail by design (concern 4); detail lines show the same measures on the delivered folder so the QA and the BA can decide.
