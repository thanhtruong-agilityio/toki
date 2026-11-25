# QA record: TOKI-007
Ticket: TOKI-007
Spec: docs/specs/2026-11-12-ci-pipeline-design.md
Version: 48d285e
Environment: static rows read `.github/workflows/ci.yml` and the files it calls at the Version with `git show`; the behavior of the bundle size script runs in a temporary worktree of the Version under Node 22 (`~/.nvm`) and in a made-up root; the history rows read the real runs of the workflow `ci.yml` of this repository with read-only `gh api` requests; nothing is written to GitHub and no pull request is opened; the repository itself is not changed

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafts the rows; the QA approves them before any row is run. Claude runs the command rows.

Each row runs `V=48d285e bash docs/qa/TOKI-007.checks.sh <ID>` (called `checks` below) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-007.evidence.txt`. `48d285e` is the merge commit of PR #107, decided in concern 1 of the spec of this record. Requirements R1 to R18 are read as they stood at the Version (five checks, `git show 48d285e:docs/specs/2026-11-12-ci-pipeline-design.md`); the spec on `main` speaks of seven checks and has R19, added after the delivery, which has its own row T19. The history rows read the runs of `ci.yml` from the first commit of the pull request that delivered the ticket onward; the workflow changed after the delivery (end-to-end and i18n jobs, path filtering), so a history row shows how CI behaved, not the file at the Version; a row whose evidence is not in the history is Blocked, not guessed. No log text and no token is kept.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 1 1 1 1`: the workflow file exists; it triggers on `pull_request`; it triggers on `push` to `main`; the history holds a run for each of the two events |  | P1 |  |  |  |
| T2 | R2 | command | `checks T2` | `T2 2 1 1`: the lint job runs `pnpm lint` and `pnpm format:check`; a real run failed at `pnpm lint`; a real run failed at `pnpm format:check` |  | P1 |  |  |  |
| T3 | R3 | command | `checks T3` | `T3 1 1`: the boundary rules are enforced by the same lint job (it runs `pnpm lint`); the log of a real failed lint run names a boundary rule |  | P1 |  |  |  |
| T4 | R4 | command | `checks T4` | `T4 1 1`: the type check job runs `pnpm typecheck`; a real run failed at that step |  | P1 |  |  |  |
| T5 | R5 | command | `checks T5` | `T5 1 1`: the tests job runs `pnpm test`; a real run failed at that step |  | P1 |  |  |  |
| T6 | R6 | command | `checks T6` | `T6 1 1 1`: the build job runs `pnpm build`; the root `build` script is `pnpm -r --if-present run build`; a real run failed at `pnpm build` |  | P1 |  |  |  |
| T7 | R7 | command | `checks T7` | `T7 200000 1 0 1 1 1 1 1`: the limit file holds 200000; the check script reads `apps/web/dist`; no bundle-size tool among the dependencies; the `size` script builds `apps/web` and measures; static chunks count and dynamic ones do not; at or over the limit the verdict fails; in a made-up root with the real script the real limit passes and a lowered limit fails and prints size, limit and difference; on the real tree at the Version, where `apps/web` has no build script yet, the check passes and says there is no bundle to measure |  | P1 |  |  |  |
| T8 | R8 | command | `checks T8` | `T8 5 1 1`: the five job names are exactly `lint`, `type check`, `tests`, `build`, `bundle size`; there are five jobs; a real pull request run lists them as separate jobs |  | P1 |  |  |  |
| T9 | R9 | command | `checks T9` | `T9 N N 0`, N at least 1: failed runs in the history; of them, runs with a failed job; runs that concluded success with a failed job |  | P1 |  |  |  |
| T10 | R10 | command | `checks T10` | `T10 6 0`: root scripts for the six commands; `run:` lines of the workflow outside the allowed set |  | P2 |  |  |  |
| T11 | R11 | command | `checks T11` | `T11 0 0 1 0`: `secrets` references in `ci.yml`; `secrets` references in all workflows (the spec's own command); `contents: read` lines in `ci.yml`; tracked `.env` files other than the example |  | P1 |  |  |  |
| T12 | R12 | command | `checks T12` | `T12 0 0 1 1`: literal Node versions; literal pnpm versions; the log of a real run prints a Node 22 line; its pnpm version equals the `packageManager` value |  | P2 |  |  |  |
| T13 | R13 | command | `checks T13` | `T13 N`, N at least 1: real pull request runs in which all five checks passed |  | P1 |  |  |  |
| T14 | R14 | command | `checks T14` | `T14 3 0`: workflow files at the Version; matches of `e2e` or `playwright` in them |  | P2 |  |  |  |
| T15 | R15 | command | `checks T15` | `T15 17 1 0 1`: the Postgres service major version of the tests job; `TEST_DATABASE_URL` is written in the workflow with a name ending in `_test`; `secrets` references in the tests job; the log of a real run reports the database test files as passed and nothing skipped |  | P1 |  |  |  |
| T16 | R16 | command | `checks T16` | `T16 5 5 5 0 0 1`: five jobs; each with its own checkout, toolchain setup and install; `needs` in the workflow; `continue-on-error`; a real run in which two checks failed and the other checks were reported, none skipped or cancelled |  | P1 |  |  |  |
| T17 | R17 | command | `checks T17` | `T17 1`: a real run in which all five checks failed at the install step |  | P2 |  |  |  |
| T18 | R18 | command | `checks T18` | `T18 1 1 5 1 1`: the concurrency group per pull request; `cancel-in-progress` only for pull requests; five jobs cache pnpm; a real pull request run was cancelled by a newer one; a real run reports a cache hit |  | P2 |  |  |  |
| T19 | R19 | command | `checks T19` | `T19 1`: the workflow at the Version skips a check's steps when no file it depends on changed (requirement R19 of the spec on `main`, added after the delivery; expected to fail at the Version) |  | P3 |  |  |  |

## Not covered
- None: every requirement R1 to R19 has a row. The sentence of R1 about a pull request with a merge conflict (GitHub starts no run) is not checked: it describes GitHub, not the workflow.
