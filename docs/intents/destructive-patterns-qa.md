# Intent: QA of the destructive-action and unsaved-form patterns
Author: Thanh Truong

## Problem
The ticket TOKI-093 (the destructive-action and unsaved-form patterns) is closed as Done, but nobody tested it against its spec. It is ticket 11 of the 12 tickets of the Blueprint outcome I02 design-system, and the done line of I02 says that the Undo, the confirmation and the date-rule patterns exist. The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I16 and I17 have gone through it, and the QA of TOKI-008 (`docs/intents/test-harness-qa.md`) is the pattern for a ticket whose checks need an install and a browser. The lead chose one QA ticket for each ticket of the outcome, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-093.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-093. It is not known whether the `ConfirmDialog`, the table of actions and its "never both" rule, the Undo helper, the online gate, the form guard and the ten texts behave as its spec of 24 requirements says, or whether they changed since.
Source: `docs/traceability.md` (TOKI-093 row); `docs/specs/2026-11-16-destructive-patterns-design.md`; Blueprint plan, intent I02 (ticket 11 of 12, status draft).

## Proposed outcome
- TOKI-093 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged: the merge commit of the pull request that delivered the ticket.
- If a requirement is not met, the record says which row failed and why, and the failure stays in the record.
- The acceptance of I02 itself is not part of this work; it is written after the QA records of its tickets exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-093 delivered (`packages/ui-web/src/components/ConfirmDialog/`, `apps/web/src/patterns/`, the `common` texts of `packages/i18n`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements describe the repository when the ticket was closed, and later tickets legitimately changed it (the table of actions has gained rows), so the commit at which a row is judged matters.
- Some rows need an install, a browser or a free port; they must not change the working tree of the repository. The ticket stores nothing, so there is no development data to protect.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. A requirement that is only a by-eye comparison with the prototype is a manual row for the QA. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-093 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- At which commit are the rows judged: the merge commit of the pull request of TOKI-093, or the current `main`?
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need?
- The spec asks for a look at 360 px against the prototype and for behaviour in a browser. Which rows can a command decide, and which are left to the QA?
Source: the merged intents and specs of the QA tickets of I01 (the same three questions); `docs/specs/2026-11-16-destructive-patterns-design.md` (R8, Testing).
