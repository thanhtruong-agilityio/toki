# Intent: QA of the server skeleton
Author: Thanh Truong

## Problem
The ticket TOKI-004 (the Fastify server skeleton) is closed as Done, but nobody tested it against its spec. It is one of the eight tickets of the Blueprint outcome I01 repo-foundation (TOKI-001 to TOKI-008). The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I16 and I17 have gone through it, and the QA of TOKI-001 (`docs/intents/monorepo-typescript-setup-qa.md`) is the pattern for I01. The lead chose on 2026-11-25 one QA ticket for each of the eight tickets, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-004.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-004. It is not known whether the Fastify server: startup configuration, `/healthz`, the JSON log, the one error schema, the `/api/v1` prefix and shutdown behave as its spec of 20 requirements says, or whether they changed since.
Source: `docs/traceability.md` (TOKI-004 row); `docs/specs/2026-11-12-server-skeleton-design.md`; Blueprint plan, intent I01 (tickets 001 to 008, status draft).

## Proposed outcome
- TOKI-004 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged: the merge commit of the pull request that delivered the ticket.
- If a requirement is not met, the record says which row failed and why, and the failure stays in the record.
- The acceptance of I01 itself is not part of this work; it is written after the QA records of the eight tickets exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-004 delivered.
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements describe the repository when the ticket was closed, and later tickets legitimately changed it, so the commit at which a row is judged matters.
- Some rows need an install, a service, a browser or a database; they must not change the working tree of the repository and must not touch the development data except where the QA spec of the ticket says so.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-004 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- At which commit are the rows judged: the merge commit of the pull request of TOKI-004, or the current `main`?
- May the checks use a temporary worktree and the local services, browser and ports that the rows need, isolated from the development data?
- The server needs configuration to start and the real one is in the QA's `.env`, which Claude must not read. Rows that start the server need values: which?
