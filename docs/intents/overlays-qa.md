# Intent: QA of the overlays
Author: Thanh Truong

## Problem
The ticket TOKI-014 (the overlays: Menu, Modal and Sheet of `ui-web`) is closed as Done, but nobody tested it against its spec. It is ticket 6 of 12 of the Blueprint outcome I02 design-system. The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I16, I17 and I01 have gone through it, and the QA of the test harness (`docs/intents/test-harness-qa.md`) is the pattern. The lead chose on 2026-11-25 one QA ticket for each ticket of I02, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-014.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-014. It is not known whether the three layers behave as its spec of 34 requirements says (focus trap and return, Esc in order, arrow keys in menus, scroll lock, the CSS tables, nothing hover-only, the 13 examples), or whether they changed since.
Source: `docs/traceability.md` (TOKI-014 row); `docs/specs/2026-11-16-overlays-design.md`; Blueprint plan, intent I02 (ticket 6 of 12).

## Proposed outcome
- TOKI-014 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged: the merge commit of the pull request that delivered the ticket.
- If a requirement is not met, the record says which row failed and why, and the failure stays in the record.
- The acceptance of I02 itself is not part of this work; it is written after the QA records of its tickets exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-014 delivered in `packages/ui-web` (`src/components/Menu`, `Modal`, `Sheet`, `src/internal/overlays`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements describe the repository when the ticket was closed, and later tickets legitimately changed it (the tests moved to a `tests` folder in TOKI-015, the preview page of TOKI-016 arrived later), so the commit at which a row is judged matters.
- Some rows need an install, a browser or free ports; they must not change the working tree of the repository. A requirement that is only a comparison by eye with the prototype cannot be proved by a command.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-014 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); `docs/specs/2026-11-16-overlays-design.md` (R29, concern 10); CLAUDE.md.

## Open questions
- At which commit are the rows judged: the merge commit of the pull request of TOKI-014, or the current `main`?
- May the checks use a temporary worktree, an install in it, the local Chromium and free ports, isolated from the repository?
- The spec asks for a check in a browser at five widths and in two looks, and for a likeness to the prototype, which is not in the repository. Which of this is a command and which is a person's check?
Source: `docs/specs/2026-11-16-overlays-design.md` (R28, R29, Testing); the QA of the test harness (`docs/specs/2026-11-25-test-harness-qa-design.md`, concerns 1 to 3).
