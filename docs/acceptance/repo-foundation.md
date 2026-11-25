# Acceptance: repo-foundation
Outcome: I01
Milestone: M1
Tickets: TOKI-001, TOKI-002, TOKI-003, TOKI-004, TOKI-005, TOKI-006, TOKI-007, TOKI-008

## Success Criteria
Source: the `done` line of the Blueprint intent I01 (a draft, written before the spec): "`pnpm dev` runs, CI is green, and lint blocks a package-boundary violation", split into three yes-or-no items without changing its meaning (spec concern 1).
- SC1. `pnpm dev` runs.
- SC2. CI is green.
- SC3. Lint blocks a package-boundary violation.

## Confirmed
BA Thanh Truong, 2026-11-25. SC1 to SC3 are confirmed as written, before the official runs of the checks (the script had been tried once on `main` to debug it).

## Results
The criteria are judged on one commit of `main`, `C = fda229a`; the evidence file is `docs/acceptance/repo-foundation.evidence.txt` (lines A1 to A5 and the lines marked `R`, which re-run QA rows at `C`). A QA row is cited only where its re-run line equals its Expected.

| SC | Tickets | Evidence | Verdict | Reason |
|---|---|---|---|---|
| SC1 | TOKI-001, TOKI-004 | A1 at fda229a (evidence file), TOKI-004:T14 | Accepted | The BA's own run of `pnpm dev` at `C` started 12 processes, 2 of them listening on a TCP port, and none was left after the script stopped it (line A1; the first A1 runs were discarded and are listed in the evidence file). TOKI-004:T14 still holds at `C` (the re-run line equals its Expected). TOKI-001:T13 no longer holds (`T13 1 2 1 5` against `1 0 0 0`: two projects now have a `dev` script) and TOKI-004:T1, T5, T6 and T15 could not be re-run because the QA script's fixed environment no longer starts the server (Blocked); they are not cited. |
| SC2 | TOKI-007 | A2 at fda229a, A2W at fda229a, A3 (evidence file) | Accepted | The latest completed run of `ci.yml` on `main` at `C` concluded success with 7 of 7 jobs success, none skipped or failed (A2); the workflow triggers on `pull_request` and on `push` and has 7 jobs (A2W; TOKI-007:T8 expected five and no longer holds); 297 of the 378 completed pull request runs concluded success and 35 failure (A3), so CI reports green on pull requests that deserve it and red on others. The history rows of TOKI-007 (T1, T9, T13) tie their window to the delivery commit and were not re-run. |
| SC3 | TOKI-002, TOKI-007 | A4, A5 (evidence file), TOKI-002:T6, TOKI-002:T7, TOKI-002:T8, TOKI-002:T9, TOKI-002:T10, TOKI-002:T11, TOKI-002:T12, TOKI-002:T13, TOKI-002:T16 | Accepted | The repository's own lint at `C` fails on three made-up files that break the boundary rules (3 of 3 files named, 3 rules named, exit non-zero) and passes on a clean copy of the same files (A4). On a real pull request (#338, closed without merging) the CI lint check failed at `pnpm lint`, naming `toki/client-core-globals` and the file, while the other six checks passed (A5); this is what TOKI-007:T3 lacked. Nine QA rows of TOKI-002 re-run at `C` equal their Expected, including T7 and T9, which failed at the delivery commit. |

## Verdict
Not accepted
By: BA, pending Thanh Truong (drafted by Claude from the checks of 2026-11-25; the BA has confirmed the criteria, not this verdict)

Reason: the three criteria are met on `fda229a`, but `acceptance-ready.sh` accepts an `Accepted` verdict only when every ticket of the header passes `qa-ready.sh` (spec R9, concern 6), and five of the eight tickets still carry failed or Blocked QA rows. The verdict follows the rule; it does not say that `pnpm dev`, CI or the lint rule failed. The BA decides whether to reopen a ticket, amend its spec, or accept the outcome by an explicit exception.

## Result notes
Each failed or Blocked row of the eight QA records appears once (the lists are in the last section of the evidence file).
- Bearing on SC3 and now settled: TOKI-002 T7 and T9 (failed at the delivery commit because the revised spec lists `platform`); at `C` their re-run lines equal their Expected (`T7 15 15`, `T9 12 12`). TOKI-007 T3 (Blocked: no real failed lint run named a boundary rule); A5 shows one. The QA records are not edited, so these rows stay Fail and Blocked in their own records and `qa-ready.sh` still reports them.
- Not bearing on a criterion (kept as their records say): TOKI-007 T6 (no run failed at `pnpm build`), T11 (a `secrets` reference in `pr-review.yml`, a review workflow, not CI) and T19 (path filtering added after the delivery); TOKI-003 T17 (no `.env.example` at the delivery commit) and T18 (Compose reads the root `.env` on its own); TOKI-005 T10 (connection strings with a password in test files) and T12 (the QA's own run of `dev:reset:db`); TOKI-008 T22 (no seeded end-to-end flow at the delivery commit). These readings are the BA's to confirm (spec concern 3).
- The QA rows were judged at each ticket's delivery commit; the evidence here is at `C`. Where a requirement no longer holds on `main` (the notes of the QA records list them) it is not cited.
- A1 depends on the BA's own `.env` and development services, which Claude did not read; the script started `pnpm dev` from a checkout of `C` plus `docs/` and printed counts only. The line does not say which ports listen or that the web page loads.
- TOKI-004 T1, T5, T6 and T15 are Blocked when re-run at `C` ("server did not start"); the cause is not investigated here. They could be re-run with the environment a later server needs.
- The throwaway pull request #338 was opened and closed by Claude with the lead's yes at that moment (spec concern 5); its branch `qa/toki-120-boundary-violation` is still on GitHub until the lead says to delete it. This record does not reopen or change any ticket on the tracker (spec R13).
- The record of milestone M1 is not part of this work.
