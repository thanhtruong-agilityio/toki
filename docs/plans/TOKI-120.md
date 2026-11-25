# TOKI-120 Acceptance of the repository foundation - implementation plan

**Goal:** I01 repo-foundation gets an acceptance record that judges its three Success Criteria on one commit `C` of `main`, with the verdict drafted and marked pending until the BA confirms it.

**Spec:** `docs/specs/2026-11-25-repo-foundation-acceptance-design.md` (R1 to R13), all six concerns decided. Tier M. Branch `docs/toki-120-repo-foundation-acceptance`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `C` is the head of `main` when the checks run (named in each evidence cell).

## Design
- **Criteria first.** The BA (Thanh Truong) confirms SC1 to SC3 as written, in chat, before any check is run; `## Confirmed` carries that date. `acceptance-ready.sh` compares it with the run dates of the cited QA rows (all 2026-11-25), so the date is the day of the confirmation.
- **SC1. `pnpm dev` runs.** A1 is run by the QA in their own terminal on their own `.env` (concern 4): the script's `A1` mode starts `pnpm dev` in the checkout the QA stands in (it checks that `HEAD` is `C`), polls the listening ports of the processes it started, stops them and prints counts: processes started, ports listening, exit codes after SIGTERM. It never reads `.env`; the QA pastes the line. Until pasted, A1 is Blocked and SC1 is Not accepted with that reason. QA rows re-run at `C`: TOKI-001 T13, TOKI-004 T1, T5, T6, T14, T15 (their own scripts, `V=C`), which say whether those requirements still hold.
- **SC2. CI is green.** A2 reads the latest completed run of `ci.yml` on `main` at `C` with read-only `gh api` (commit, jobs, jobs that concluded `success`); A3 counts the real pull request runs in which every check passed. QA rows re-run at `C`: TOKI-007 T1, T8, T9, T13 (T8 expects five job names and is expected not to hold now).
- **SC3. Lint blocks a package-boundary violation.** A4 runs the repository's own lint in a temporary worktree of `C` on made-up files that break the boundary rules (one for each kind) and on the unchanged tree: non-zero naming the rule, then 0. QA rows re-run at `C`: TOKI-002 T6 to T13 and T16 (T7 and T9 failed at the delivery). A5 is the throwaway pull request of concern 5: opened by Claude only after a fresh yes from the lead at that moment, with one violation, read through `gh` (lint check red and the rule named), closed without merging; its branch stays until the lead says to delete it. A5 is Blocked if the lead does not say yes.
- **Re-runs are not new rows.** The QA scripts take `V=<commit>`; the acceptance script `R <KEY> <IDs>` runs them at `C` and prints their lines, which go in the evidence file. A QA row is cited for a criterion only if its re-run line equals that row's Expected; otherwise the record says the requirement no longer holds.
- **Failed and Blocked rows (concern 3).** Each failed or Blocked row of the eight records is listed once: bearing on SC3 (TOKI-002 T7, T9; TOKI-007 T3), on SC2 (none, to be confirmed by the BA), or not bearing (TOKI-007 T6, T11, T19; TOKI-003 T17, T18; TOKI-005 T10, T12; TOKI-008 T22). The BA confirms the readings; they are drafted, not decided.
- **Verdict.** `Not accepted` is expected (`acceptance-ready.sh` needs all eight tickets to pass QA; three do); the reason of each criterion is written; `By: BA, pending Thanh Truong`.
- Same discipline as the QA tickets: every claim in the notes has an evidence line; one `BASE` temporary folder; a `CLEAN` last line; two identical runs; a paired run for every check that must fail; no secret.

## AC -> step -> test
| Req | Step | Test |
| :---- | :---- | :---- |
| R1, R2 | 1. BA confirms the three criteria in chat | `Confirmed` in the record names the BA and the date |
| R4, R6, R7 | 2. Write `repo-foundation.checks.sh` (A2, A3, A4, `R`, A1 mode) | run on a mutated copy (a rule removed, a violation tolerated): the matching line changes; two identical runs |
| R3, R8 | 3. Draft the record, run the checks, re-run the QA rows at `C`, QA pastes A1, lead says yes to A5 | every cell of Evidence names a row or a line and `C` |
| R9, R10 | 4. Verdict drafted (pending), `trace.sh` | the eight rows of the table show the verdict |
| R11, R12, R13 | 5. Checks | `git diff` shows added files and `traceability.md` only; six script tests pass; no secret in the new files; no tracker action |

## What can break (riskiest first)
1. A QA row cited as evidence for a requirement that no longer holds: each cited row is re-run at `C` and compared with its Expected first.
2. A1 depends on the QA's own run: the record must stay honest while it is Blocked (SC1 Not accepted, never Accepted).
3. The throwaway pull request writes to the real repository: it is opened only on a fresh yes, holds no secret, is closed unmerged, and its branch is not deleted by me.
4. CI history reads hit the unauthenticated GitHub rate limit: cache and fixed snapshot as in TOKI-118; Blocked when incomplete.
5. A mutated lint worktree left behind: one `BASE` folder, the `EXIT` trap and the `CLEAN` line.
