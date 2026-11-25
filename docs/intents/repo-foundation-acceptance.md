# Intent: Acceptance of the repository foundation
Author: Thanh Truong

## Problem
The eight tickets of the Blueprint outcome I01 repo-foundation (TOKI-001 to TOKI-008: the monorepo and TypeScript setup, lint and boundary rules, the local development environment, the server skeleton, the database connection and migrations, the web app skeleton, the CI pipeline and the test harness) are closed as Done, and each now has a QA record (`docs/qa/TOKI-001.md` to `docs/qa/TOKI-008.md`, merged). Nobody has yet judged the outcome itself. The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) says a ticket is Done only after QA passes and the BA then accepts the outcome against its original Success Criteria; I16 and I17 went through it, and I01 is the next one (`docs/traceability.md` shows "no acceptance" for all eight tickets).
The Blueprint states the outcome in one line (its `done` line): "`pnpm dev` runs, CI is green, and lint blocks a package-boundary violation". The QA records say it cannot be judged by simply adding up their results:
- Every QA row was judged at the merge commit of its ticket, and the result notes list requirements that no longer hold on `main` because later tickets changed the repository (for example the `apps` and `packages` folders, the `dev` scripts, the server modules and the configuration areas). Each QA spec left "the repository as it stands" to this acceptance.
- The rows that feed the three parts of the line are few and uneven: `pnpm dev` (TOKI-001 T13; the server `dev` script in TOKI-004), CI is green (TOKI-007 T1, T8, T9, T13) and the lint rule (TOKI-002 T6 to T13 and T16). The lint row that needed a real failed run to name a boundary rule is Blocked (TOKI-007 T3).
- Some rows failed or were Blocked for reasons that may or may not touch the line: TOKI-007 T11 (a `secrets` reference in `pr-review.yml`) and T19 (path filtering added later), TOKI-003 T18 (Compose reads `.env` on its own) and T17 (no `.env.example` at the Version), TOKI-008 T22 (no seeded end-to-end flow at the Version).
So it is not known whether I01 is reached on the repository as it stands today, and the chain Intent → Spec → Ticket → Test → Acceptance stops at the QA records for the first eight tickets.
Source: `docs/traceability.md` (rows TOKI-001 to TOKI-008); `docs/qa/TOKI-001.md` to `docs/qa/TOKI-008.md` (result notes); `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R6 to R9, R17); the QA specs of each ticket (concern 1: the repository as it stands is judged by the acceptance of I01); Blueprint plan, intent I01 (`done` line, tickets 001 to 008, status draft).

## Proposed outcome
- I01 has an acceptance record: its Success Criteria, taken from the Blueprint `done` line and confirmed by the BA before anything is run, and a verdict for each criterion with its reason, then an overall verdict.
- Each criterion cites the evidence it rests on: QA rows that still hold, and new checks on the repository as it stands, each at a named commit.
- The record says how each failed or Blocked QA row bears on the outcome (it does, or it does not), so a failure is neither hidden nor counted twice.
- The repository shows where the chain from the outcome to its proof holds or breaks for I01. If a criterion is not met, the verdict is `Not accepted`, says which one and why, and the failure stays in the record.
- The record of milestone M1 is not part of this work; it follows after the acceptance of I01 and I02.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R6 to R9).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/acceptance/`, `docs/traceability.md`, the scripts `acceptance-ready.sh` and `trace.sh`, the QA records of TOKI-001 to TOKI-008, and the repository as it stands (`main`) for the checks that look at today's code and CI runs.
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record format are those of the merged spec; this work adds one acceptance record and changes no script and no format.
- Success Criteria are confirmed before any check is run, and a criterion added later is shown beside the first ones.
- Claude cannot read or create `.env`; a check that needs a real `.env` or the Docker services is run by the person in their own terminal, or it is `Blocked`. No secret, token or real credential value goes into a record or its evidence.
- The eight QA records and their specs are not edited. A QA result that no longer holds is reported in the acceptance record, not rewritten.
- A criterion is `Accepted` only with evidence at a named commit. A check that cannot be run is `Blocked`, never `Accepted`.
- Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- The `done` line has three statements joined by "and" and a comma. Is it split into three criteria (`pnpm dev` runs; CI is green; lint blocks a package-boundary violation), or into more, for example separating the server and the web app under `pnpm dev`?
- At which commit are the criteria judged: `main` as it stands on the day of the acceptance, with the QA rows used only where they still hold, or each ticket's delivery commit as the QA records did?
- Do the failed and Blocked QA rows (TOKI-007 T3, T11, T19; TOKI-003 T17, T18; TOKI-008 T22) stop a criterion from being accepted, or only those that bear on the three statements of the line? Who decides which bear on it?
- "`pnpm dev` runs" needs the server and the web app to start, and the server reads the environment and a database. Does the QA run that check in their own terminal on their own `.env` and paste a result without values, or is it `Blocked` and the criterion not accepted until then?
- "Lint blocks a package-boundary violation" and "CI is green" are shown best by a real pull request with a violation and a real green run. May the acceptance open a throwaway pull request for the violation, or does it rely on the lint rule's own checks and the history of CI runs?
