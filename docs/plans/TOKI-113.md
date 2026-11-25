# TOKI-113 QA of the lint, format and package boundary rules - implementation plan

**Goal:** TOKI-002 gets a QA record, run on the real repository at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-lint-format-boundary-rules-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-113-lint-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `6e7f0fa` (PR #77, the re-landing after #68 was reverted by #70), decided in concern 1.

## Design

Same shape as `docs/qa/TOKI-001.*` with its lessons built in (a row that loops prints how many it checked; a wrong check is corrected and rerun with both runs kept; a changed `Expected` is approved again; no row passes by looking at nothing).

- `docs/qa/TOKI-002.checks.sh` reads files of `V` with `git show`. Rows that run ESLint or Prettier use one temporary worktree of `V` (created on first use, installed once, removed by an `EXIT` trap, restored with `git checkout -- .` and `git clean -fdq` after each mutating row). Node 22 and `corepack pnpm` as in `TOKI-001.checks.sh`.
- A boundary row writes all its violating files into the temporary worktree at once, one file per case, runs `eslint -f json` once on those files, and counts the files that have at least one error from a boundary rule (`toki/*`, `no-restricted-imports`, `no-restricted-syntax`, `@typescript-eslint/no-restricted-imports`) and whose message names the file. It prints `fired tried`. A case that must pass is counted separately. The `Expected` is a fixed list of cases, so zero cases cannot pass.
- The commit's `eslint.config.js` covers four packages with rule 1 (`client-core`, `shared`, `i18n`, `tokens`), so the cases for `platform` (R5, R6 as revised by PR #252) are separate rows (T7, T9): they are expected to show whether the delivered code meets the revised spec.
- Output is counts, exit codes and words. ESLint output is not kept except the first error line of a refusal.
- Rows are drafted by Claude and approved by the QA before any row is run. I debug the script on a mutated copy first; if I run a real row to debug it, I say so.

### Rows

| ID | TOKI-002 | Output compared with Expected |
| :-- | :-- | :-- |
| T1 | R1 | `T1 0 1`: `pnpm lint` exit code on the clean tree; a violating file under `dist/` is ignored |
| T2 | R13 | `T2 3 1`: boundary rules at severity `error` in the computed config, a warning makes `pnpm lint` fail |
| T3 | R14 | `T3 1`: the config file carries the comment that file picking in `ui-web` is not checked by lint |
| T4 | R2 | `T4 0 1 1`: `pnpm format:check` exit code on the clean tree, a badly formatted file makes it exit non-zero, and it is named |
| T5 | R3, R4 | `T5 0 0`: after `pnpm format` on a badly formatted file, `pnpm format:check` and `pnpm lint` both exit 0 |
| T6 | R5 | `T6 60 60 4`: 15 cases fire in each of the four packages (six bare globals, three access forms, one destructuring, five DOM type names); the allowed globals pass in each package |
| T7 | R5 (`platform`) | `T7 15 15`: the same 15 cases fire in `packages/platform` |
| T8 | R6 | `T8 24 24`: six import cases (`react-dom`, `react-dom/client`, `@toki/ui-web`, `@toki/ui-web/button`, a relative path into `ui-web`, a dynamic `import()`) fire in each of the four packages |
| T9 | R6 (`platform/web`) | `T9 12 12`: `@toki/platform/web`, its subpath and a relative path into `platform/src/web` fire in each of the four packages |
| T10 | R7 | `T10 2 2 1`: another module's inner file and its nested `index.ts` fail; an import inside the same module at any depth passes |
| T11 | R8 | `T11 3 3`: `../b`, `../b/index` and `../b/index.js` all pass |
| T12 | R17 | `T12 1 1 1`: a file outside `modules/` importing a module's inner file fails; its `index.ts` passes |
| T13 | R9 | `T13 15 15`: seven bare globals, `navigator.serviceWorker`, `document.cookie`, three `window`/`globalThis`/`self` forms, one nested form, one destructuring and `<audio>` fire in `packages/ui-web` |
| T14 | R10 | `T14 0`: importing the same features from `@toki/platform` in `ui-web` passes `pnpm lint` |
| T15 | R15 | `T15 7 7 4`: for the seven paths the computed config holds the boundary rules at `error` with inline config off; for the four packages the globals are exactly the allow list |
| T16 | R16 | `T16 5 5 5`: each of the five inline comment forms, in a covered path, makes `pnpm lint` fail, names file and line, and the violation is still reported |

`## Not covered`: R11 (asks that each rule be shown to fire by hand when built; rows T6 to T13 and T16 do it again at the commit) and R12 (dropped in the spec).

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-002.checks.sh` | run on a mutated copy (a rule removed from the config, a global removed from the allow list): the matching rows fail; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-002.md` (unapproved, unrun) | `qa-ready.sh` reports the true gaps |
| R4, R6 | 3. QA approves rows; I run T1 to T16 | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `6e7f0fa`, where the revised spec asks for more), `trace.sh` | the TOKI-002 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no worktree left |

## What can break (riskiest first)

1. A row that passes because it looked at nothing: the case lists are fixed and printed, and a row needs both sides (fired and tried).
2. A case that fails for the wrong reason (a syntax error in the generated file, a path outside the rule's block): the row counts only errors from boundary rules, and the mutation test shows each case can pass and fail.
3. Rows that disagree with the revised spec (`platform`, R17) are real findings, not script bugs; a first run that fails is checked against the config before it is recorded as a Fail.
4. The temporary worktree left behind or the repository changed: `EXIT` trap and before and after checks.
5. Lint over a worktree takes time; one `eslint` run per row group, not per case.
