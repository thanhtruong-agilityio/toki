# Intent: QA of the base components, group 2
Author: Thanh Truong

## Problem
The ticket TOKI-013 (the Avatar, the presence dot, the empty state and the Toast of `ui-web`) is closed as Done, but nobody tested it against its spec. It is the fifth of the twelve tickets of the Blueprint outcome I02 design-system. The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I16, I17 and I01 have gone through it, and the QA of TOKI-008 (`docs/intents/test-harness-qa.md`) is the nearest pattern. The lead chose on 2026-11-25 one QA ticket for each ticket of I02, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-013.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-013. It is not known whether the four components, the toast provider and its timers, the placement of the toasts and the CSS behave as its spec of 34 requirements says, or whether they changed since. Part of the spec can only be shown in a browser (the centring of the empty state, the toasts above the composer at five widths), and part is a comparison with the prototype by eye, a screen reader or a phone.
Source: `docs/traceability.md` (TOKI-013 row); `docs/specs/2026-11-16-base-components-2-design.md`; Blueprint plan, intent I02 (ticket 5 of 12, status draft).

## Proposed outcome
- TOKI-013 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged: the merge commit of the pull request that delivered the ticket.
- If a requirement is not met, the record says which row failed and why, and the failure stays in the record.
- A requirement that only a person can judge (a by-eye comparison with the prototype, a screen reader, a phone with its keyboard open) is a manual row, left Blocked until the QA records the result.
- The acceptance of I02 itself is not part of this work; it is written after the QA records of the tickets of I02 exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-013 delivered under `packages/ui-web/src/components/` (`Avatar`, `PresenceDot`, `EmptyState`, `Toast`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements describe the repository when the ticket was closed, and later tickets legitimately changed it (for example the unit tests were moved into a tests folder by TOKI-015), so the commit at which a row is judged matters.
- Some rows need an install, a browser or local ports; they must not change the working tree of the repository, and the temporary page that some rows need is never committed.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-013 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- At which commit are the rows judged: the merge commit of the pull request of TOKI-013, or the current `main`?
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need, isolated from the development data?
- Which requirements are checked by a command and which only by a person: the spec asks for browser checks at five widths and for comparisons with the prototype by eye?
