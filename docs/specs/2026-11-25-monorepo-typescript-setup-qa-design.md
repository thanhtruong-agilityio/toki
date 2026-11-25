# QA of the monorepo and TypeScript setup design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/monorepo-typescript-setup-qa.md (Thanh Truong)
Ticket: TOKI-112

## Goal
The builder, the QA and the BA need to know whether TOKI-001 (the pnpm monorepo, the eight projects, the shared TypeScript config, the Node and pnpm pins, the `.gitignore` and the root `dev` script) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-001 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is the first of eight QA tickets for the Blueprint outcome I01 repo-foundation; the acceptance of I01 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script.

## Scope
- In:
  - The QA record `docs/qa/TOKI-001.md`, its checks script `docs/qa/TOKI-001.checks.sh` and its evidence file `docs/qa/TOKI-001.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of TOKI-002 to TOKI-008 and the acceptance record of I01; they are the next tickets of this series.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-001, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-001 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-001; a row may point to a check that already runs.

## Requirements
- R1. `docs/qa/TOKI-001.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-001`, `Spec: docs/specs/2026-11-12-monorepo-typescript-setup-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-001` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement R1 to R12 of the spec of TOKI-001 has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, so R8 (the fields, and the refusal of another Node major) and R10 (the two apps) are split as the Design table shows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-001` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-001.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs an install or a type check runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names and words, never a secret. Its output is kept in `docs/qa/TOKI-001.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is empty before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The script that runs a temporary worktree requires Node 22 on its `PATH` and says "needs Node 22" for the row otherwise. It uses the package registry only through `pnpm install --frozen-lockfile`, adds no file to the repository, and removes the worktree and its folder at the end even when a row fails. The row for another Node major runs `pnpm install` under the machine's default Node when that is not 22, and is `Blocked` when only Node 22 is available. Check: after the script, `git worktree list` shows no new entry.
- R6. The record's `Version:` is the merge commit of the pull request of TOKI-001, `f011a9c` (concern 1), and every row is judged at it. The result notes say, for a row that would give a different answer on the current `main` (for example R4 and R12), what changed since and which later ticket changed it, without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I01. The record carries a result note that says which Success Criterion of I01 each row will feed (the `done` line: `pnpm dev` runs, CI is green, lint blocks a package-boundary violation), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-001 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-001, the root `package.json`, the workspace files, `.gitignore`, the three scripts and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-001 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-001 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-001 states.

| TOKI-001 | Row and what it compares | Needs install |
| :---- | :---- | :---- |
| R1 | `pnpm-workspace.yaml` lists `apps/*` and `packages/*`; `pnpm install --frozen-lockfile` exits 0 | yes |
| R2 | `pnpm ls -r --depth -1` lists exactly the eight package names | yes |
| R3 | `apps/mobile`, `apps/desktop`, `packages/ui-native` do not exist | no |
| R4 | each of the eight projects has `package.json`, `tsconfig.json`, `src/index.ts` and the required fields; `src/index.ts` is `export {};` | no |
| R5 | `tsconfig.base.json` has the four settings; no project `tsconfig.json` sets `strict`, `target`, `module` or `moduleResolution` | no |
| R6 | `pnpm typecheck` exits 0 | yes |
| R7 | a type error added to the `src/index.ts` of each project makes `pnpm typecheck` exit non-zero and print that path (eight runs) | yes |
| R8 (fields) | `engines.node` is `22.x`, `devEngines.runtime` is Node `22.x` with `onFail: error`, `.nvmrc` is `22` | no |
| R8 (refusal) | with another Node major version `pnpm install` exits non-zero with a runtime version error and installs nothing | yes |
| R9 | `packageManager` is `pnpm@<exact version>`, equal to `pnpm --version`; `pnpm-lock.yaml` is tracked, `package-lock.json` and `yarn.lock` are not | yes |
| R10 | each of the two apps declares `@toki/shared` as `workspace:*` and an import of it passes `pnpm typecheck` | yes |
| R11 | `.gitignore` has exactly the three environment patterns; `git check-ignore` behaves as stated; `git status --porcelain` is empty after install and type check | yes |
| R12 | the root `dev` script is exactly `pnpm -r --parallel --if-present run dev`; at the close of the ticket no project has a `dev` script and `pnpm dev` exits 0 | yes |

R4, R12 and part of R2 describe the repository when the ticket closed; later tickets added files, packages and `dev` scripts. The commit at which these rows are judged decides whether they can pass (concern 1).

### Layout
```
docs/
  qa/TOKI-001.md  TOKI-001.checks.sh  TOKI-001.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file (for example a `tsconfig.json` that sets `strict`) makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-001` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names and exit codes only. The install output is not kept; only whether it exited 0 and the first error line for a refusal. No `.env` file is read or created.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Install and type check write to disk and need Node 22 and the registry, and must not change the repository | R3, R5 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-001 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the TOKI-001 pull request, or the current `main`? Answered: the merge commit of the pull request of TOKI-001, `f011a9c` (PR #54, 2026-11-16) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks create a temporary worktree outside the repository, run `pnpm install` and `pnpm typecheck` there, and remove it? Answered: yes (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.

## Areas of concern
1. The commit at which the rows are judged. The requirements R2 (eight projects), R4 (three files each) and R12 (no `dev` script) describe the repository when the ticket closed, and later tickets changed it. Judged at the merge commit, the rows prove the ticket as delivered; judged at the current `main`, they show the repository as it stands, and R4 and R12 fail for reasons that are not a defect of TOKI-001. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request of TOKI-001, `f011a9c` (PR #54), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I01. The spec of TOKI-001 was revised by PR #53, merged after PR #54 (it added the `devEngines` pin of R8); if a requirement of the revised text is not in `f011a9c`, that row fails with this note in the result notes and the BA decides. Owner: Thanh Truong (QA).
2. The temporary worktree. Rows that install and type check need one; the script removes it and the repository is unchanged (R3, R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create the temporary worktree, install and type check there and remove it, with the repository unchanged. Owner: Thanh Truong (QA).
3. The row for another Node major version. It needs a Node that is not 22 on the machine; the default Node here is 24. Accepted in this spec: the row uses the default Node when it is not 22 and is `Blocked` otherwise (R5); it is a design choice, not a product decision. Owner: Thanh Truong.
