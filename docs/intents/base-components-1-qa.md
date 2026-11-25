# Intent: QA of base components, group 1
Author: Thanh Truong

## Problem
The ticket TOKI-012 (Button, IconButton, Chip, Switch, Field, Select, Tag and Badge in `packages/ui-web`, with the lint rule for icon-only buttons) is closed as Done, but nobody tested it against its spec. It is ticket 4 of the 12 tickets of the Blueprint outcome I02 design-system. The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I16, I17 and I01 have gone through it, and the QA of the test harness (`docs/intents/test-harness-qa.md`) is the pattern. The lead chose on 2026-11-25 one QA ticket for each ticket of I02, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-012.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-012. It is not known whether the components, their style sheets, the base rules, the lint rule, the examples and the test set-up behave as its spec of 31 requirements says, or whether they changed since.
Source: `docs/traceability.md` (TOKI-012 row); `docs/specs/2026-11-16-base-components-1-design.md`; Blueprint plan, intent I02 (ticket 4 of 12, status draft).

## Proposed outcome
- TOKI-012 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged: the merge commit of the pull request that delivered the ticket.
- A requirement that can only be judged by eye against the prototype has a manual row, which stays Blocked until the QA records the result.
- If a requirement is not met, the record says which row failed and why, and the failure stays in the record.
- The acceptance of I02 itself is not part of this work; it is written after the QA records of its tickets exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-012 delivered (`packages/ui-web`, the lint rule and its fixtures, the two imports in `apps/web`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements describe the repository when the ticket was closed, and later tickets legitimately changed it, so the commit at which a row is judged matters.
- Some rows need an install, a browser or a port; they must not change the working tree of the repository.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-012 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- At which commit are the rows judged: the merge commit of the pull request of TOKI-012, or the current `main`?
- May the checks use a temporary worktree with its own install, the local tools, a headless Chromium and free ports, isolated from the repository?
- The spec asks for a look comparison with the prototype, by eye, in Calm and Focus, and a screen-reader pass. Neither can be run by a command. What do the rows do?
Source: the merged spec of TOKI-012 ("Testing"); the QA records of the other tickets of the series.
