# TOKI-112 QA of the monorepo and TypeScript setup - implementation plan

**Goal:** TOKI-001 gets a QA record, run on the real repository at the merge commit of its pull request, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-monorepo-typescript-setup-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-112-monorepo-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `f011a9c` (PR #54), decided in concern 1.

## Design

Same shape as `docs/qa/TOKI-096.*`, with the lessons of that run built in (rows that loop print what they checked; a changed `Expected` is approved again; a wrong check is corrected and rerun with both runs kept).

- `docs/qa/TOKI-001.checks.sh` reads files of `V` with `git show`. Rows that run a tool (install, type check, `pnpm dev`) use one temporary worktree of `V` under `mktemp -d`, created on first use and removed by an `EXIT` trap; the rows that change a file (T7, T11) restore it with `git checkout -- .`. Node 22 is taken from `PATH` or, when the default is another major, from `~/.nvm/versions/node/v22*`; the row for another major uses the other installed one; neither found means the row prints `needs Node 22` and is `Blocked`. pnpm runs through `corepack pnpm` so the `packageManager` pin decides the version. The repository's `git status --porcelain` is checked before and after.
- Evidence prints counts, names, exit codes and words; install output is not kept except the first error line of a refusal.
- Rows are drafted by Claude and approved by the QA before any row is run. I test the script on a throwaway fixture first where I can, and say so if I run a real row to debug it.

### Rows

| ID | TOKI-001 | Output compared with Expected |
| :-- | :-- | :-- |
| T1 | R1 | `T1 1 0`: workspace file lists both globs, `pnpm install --frozen-lockfile` exit code |
| T2 | R2 | `T2 8 0`: workspace projects found, names missing or extra |
| T3 | R3 | `T3 0`: forbidden paths that exist |
| T4 | R4 | `T4 8 24 0`: projects, files tracked under apps and packages, projects or files not as specified |
| T5 | R5 | `T5 4 8 0`: base settings found, project configs that extend it, forbidden settings in project configs |
| T6 | R6 | `T6 0`: exit code of `pnpm typecheck` |
| T7 | R7 | `T7 8 8`: projects whose error makes the type check fail, of those that print the path |
| T8 | R8 (fields) | `T8 22.x 22.x error 22`: engines, devEngines version, onFail, `.nvmrc` |
| T9 | R8 (refusal) | `T9 1 1 0`: install under another Node major exits non-zero, names the version problem, installs nothing |
| T10 | R9 | `T10 1 1 1 0`: exact pin, version matches, lockfile tracked, other lockfiles |
| T11 | R10 | `T11 2 2`: apps declaring `@toki/shared` as `workspace:*`, apps whose import type-checks |
| T12 | R11 | `T12 1 2 0 0`: exact patterns, ignored `.env` paths, ignored example, files in `git status --porcelain` after install and type check |
| T13 | R12 | `T13 1 0 0`: exact `dev` script, projects with a `dev` script, exit code of `pnpm dev` |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-001.checks.sh` | run on a mutated copy (a `tsconfig.json` that sets `strict`, an extra project, a missing file): the matching row fails; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-001.md` (unapproved, unrun) | `qa-ready.sh` reports the true gaps |
| R4, R6 | 3. QA approves rows; I run T1 to T13 | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `f011a9c`), `trace.sh` | the TOKI-001 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository clean before and after; `git worktree list` has no new entry |

## What can break (riskiest first)

1. A row that passes because it looked at nothing; loop rows print the count and `Expected` requires it.
2. The temporary worktree left behind or the repository changed: `EXIT` trap, porcelain check before and after, `git worktree list` after.
3. `pnpm install` fails for a reason outside the ticket (registry, offline, store): that row is `Blocked` with the first error line, not Pass or Fail.
4. A check that is wrong, not the repository: first run kept, correction explained, rerun, and the QA approves a changed `Expected` again.
5. Running many installs and type checks takes minutes; the script runs them once in the shared worktree.
