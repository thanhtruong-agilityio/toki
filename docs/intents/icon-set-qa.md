# Intent: QA of the icon set
Author: Thanh Truong

## Problem
The ticket TOKI-011 (the icon set of `@toki/ui-web`) is closed as Done, but nobody tested it against its spec. It is the third of the twelve tickets of the Blueprint outcome I02 design-system. The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I16 and I17 have gone through it, and the QA of TOKI-001 (`docs/intents/monorepo-typescript-setup-qa.md`) is the pattern. The lead chose on 2026-11-25 one QA ticket for each ticket of I02, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-011.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-011. It is not known whether the 43 icon components, the `Icon` component, the props and types, the paths copied from the prototype and the package set-up behave as its spec of 16 requirements says, or whether they changed since.
Source: `docs/traceability.md` (TOKI-011 row); `docs/specs/2026-11-16-icon-set-design.md`; Blueprint plan, intent I02 (ticket 3 of 12).

## Proposed outcome
- TOKI-011 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged: the merge commit of the pull request that delivered the ticket.
- If a requirement is not met, or no longer holds, the record says which row failed and why, and the failure stays in the record.
- The acceptance of I02 itself is not part of this work; it is written after the QA records of its tickets exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-011 delivered (`packages/ui-web`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements describe the repository when the ticket was closed, and later tickets legitimately changed it (the tests moved, other components were added to `ui-web`), so the commit at which a row is judged matters.
- Some rows need an install, a browser or a free port; they must not change the working tree of the repository. The icons use no data, so no development data is touched.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. A comparison with the prototype that only a person can make by eye is a manual row, `Blocked` until the QA pastes the result. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-011 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- At which commit are the rows judged: the merge commit of the pull request of TOKI-011, or the current `main`?
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need, isolated from the repository?
- R8 of TOKI-011 compares the paths with the prototype's icon table, and R4 and the closing test of its spec compare the look with the prototype. The prototype file is not in the repository at the delivery commit or on `main`. Where do the rows read it, and who judges the look?
Source: `docs/specs/2026-11-16-icon-set-design.md` (R8, Testing); `git ls-tree` of the delivery commit.
