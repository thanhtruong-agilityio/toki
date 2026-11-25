# TOKI-118 QA of the CI pipeline - implementation plan

**Goal:** TOKI-007 gets a QA record at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-ci-pipeline-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-118-ci-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `48d285e` (PR #107), decided in concern 1. Concern 3 decided that no pull request is opened: static rows read the workflow at the Version; rows that need a fault read the history of real runs with read-only `gh` commands.

## Design

Same shape as the earlier QA tickets with their lessons built in from the start: every part of a sentence of a requirement is a printed number; a row names one requirement; a row prints `Blocked`, never a Pass, when it cannot be shown; a changed `Expected` is approved again; one `BASE` folder made in the current shell holds every temporary file (exported as `TMPDIR`); the last line shows that it is removed, that nothing is left and that the repository is unchanged; and the notes claim no more than the evidence.

- **Which text of the spec is judged.** The requirements R1 to R18 are read as they stood at the Version (`git show 48d285e:docs/specs/2026-11-12-ci-pipeline-design.md`): five checks (`lint`, `type check`, `tests`, `build`, `bundle size`), and R14 saying that the end-to-end step comes later. The spec on `main` today speaks of seven checks and has R19 (a check runs only when its files changed), added after the delivery. R19 gets a row of its own from the current text, which is expected to fail at the Version; the notes say so.
- **Static rows** read `.github/workflows/ci.yml` and the files it calls at `V` with `git show`, parsed with `yq`-free shell and `jq` over a JSON conversion made by a small Node script (the workflow is YAML; `js-yaml` is not assumed, so the script parses the few constructs it needs with `awk`, and every number it prints is counted from the text).
- **History rows** use `gh api repos/thanhtruong-agilityio/toki/actions/...` (list, jobs, logs): read-only, no token printed. The evidence is real runs of the CI workflow after the delivery date (2026-11-17): which job and step failed, and which jobs ran. The workflow changed after the delivery (the end-to-end and i18n jobs, path filtering), so history shows how CI behaved later, not the file at the Version; the notes say so for each row. A row whose evidence is not in the history is `Blocked` (for example no run in which `pnpm build` failed).
- **R7 behavior** runs the repository's own `tools/bundle-size/check.mjs` in a temporary worktree of `V` (`measure` and `verdict` are exported): on a synthetic `dist` with a static chunk and a dynamic chunk the measured size equals the gzip of the entry and the static chunk only; `verdict` fails at or over the limit and prints size, limit and difference; the real script with the limit lowered in the temporary worktree exits non-zero and prints the three values.
- Output is counts, exit codes, ids and words; no token, no log text.
- Rows are drafted by Claude and approved by the QA before any row is run. I debug the script on a mutated copy first; if I run a real row to debug it, I say so.

### Rows (one per requirement)

| ID | TOKI-007 | Output compared with Expected |
| :-- | :-- | :-- |
| T1 | R1 | `T1 1 1 1 1`: the workflow file exists; it triggers on `pull_request`; it triggers on `push` to `main`; the history holds a run for each of the two events |
| T2 | R2 | `T2 2 1 1`: the lint job runs `pnpm lint` and `pnpm format:check`; a real run failed at `pnpm lint`; a real run failed at `pnpm format:check` |
| T3 | R3 | `T3 1 1`: the boundary rules are enforced by the same lint job (it runs `pnpm lint`); the log of a real failed lint run names a boundary rule |
| T4 | R4 | `T4 1 1`: the type check job runs `pnpm typecheck`; a real run failed at that step |
| T5 | R5 | `T5 1 1`: the tests job runs `pnpm test`; a real run failed at that step |
| T6 | R6 | `T6 1 1 1`: the build job runs `pnpm build`; the root `build` script is `pnpm -r --if-present run build`; a real run failed at `pnpm build` (`Blocked` if none) |
| T7 | R7 | `T7 200000 1 0 1 1 1 1`: the limit file holds 200000; the check script reads `apps/web/dist`; no bundle-size tool in the dependencies; the `size` script builds `apps/web` and measures; static chunks count and dynamic ones do not; at or over the limit it fails and prints size, limit and difference; with the limit lowered the real script exits non-zero |
| T8 | R8 | `T8 5 1 1`: the five job names are exactly `lint`, `type check`, `tests`, `build`, `bundle size`; each is its own job; a real pull request lists them as separate checks |
| T9 | R9 | `T9 N N 0`, N at least 1: failed runs, of which each has a failed job; runs with a failed job that concluded success |
| T10 | R10 | `T10 6 0`: root scripts for the six commands; `run:` lines of the workflow outside the allowed set |
| T11 | R11 | `T11 0 1 0`: `secrets` references in the workflows; `contents: read` lines; tracked `.env` files other than the example |
| T12 | R12 | `T12 0 0 1 1`: literal Node versions; literal pnpm versions; a real run's log prints a Node 22 line; its pnpm version equals the `packageManager` value |
| T13 | R13 | `T13 N`, N at least 1: real pull request runs in which all five checks passed |
| T14 | R14 | `T14 3 0`: workflow files at the Version; matches of `e2e` or `playwright` in them |
| T15 | R15 | `T15 17 1 0 1`: the tests job's Postgres service major version; `TEST_DATABASE_URL` is written in the workflow with a name ending in `_test`; `secrets` references in it; a real run reports the database tests as passed |
| T16 | R16 | `T16 5 5 5 0 0 1`: five jobs; each with its own checkout, toolchain setup and install; `needs` in the workflow; `continue-on-error`; a real run in which two checks failed and the other three were reported |
| T17 | R17 | `T17 1`: a real run in which all five checks failed at the install step |
| T18 | R18 | `T18 1 1 5 1 1`: the concurrency group per pull request; `cancel-in-progress` only for pull requests; five jobs cache pnpm; a real run on a pull request was cancelled by a newer one; a real install step reports a cache hit |
| T19 | R19 (current spec) | `T19 1`: the workflow at the Version skips a check's steps when no file it depends on changed; expected to fail: path filtering was added after the delivery |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-007.checks.sh` | run on a mutated copy of the workflow (a `needs:`, a literal Node version, a `continue-on-error`, a second `run:` command) and with the limit file changed: the matching rows fail; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-007.md` (unapproved, unrun) | `qa-ready.sh` reports the true gaps |
| R4, R6 | 3. QA approves rows; I run T1 to T19 | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `48d285e`), `trace.sh` | the TOKI-007 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no process, worktree or folder left; no write to GitHub |

## What can break (riskiest first)

1. A history row that passes on evidence that is about a later version of the workflow: each note says what the history shows and does not claim it is the file at the Version.
2. `gh` unavailable or rate limited: the history rows are `Blocked` with the first error line, not guessed.
3. Log text in evidence: the script keeps only counts and ids, and checks that a failed log names a boundary rule without printing the log.
4. A static parse that reads a comment as a setting: the parser strips comment lines and the mutation test covers a commented `needs:`.
5. The temporary worktree, folders or processes left behind: one `BASE` folder, the `EXIT` trap and the final line.
