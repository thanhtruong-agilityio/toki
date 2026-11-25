# Intent: QA of the tokens package
Author: Thanh Truong

## Problem
The ticket TOKI-009 (the tokens package: palettes, accents, densities, radii, shadows and the generated `tokens.css`) is closed as Done, but nobody tested it against its spec. It is the first of the twelve tickets of the Blueprint outcome I02 design-system (TOKI-009 to TOKI-020). The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I01, I16 and I17 have gone through it, and the QA of the test harness (`docs/intents/test-harness-qa.md`) is the pattern. The lead chose on 2026-11-25 one QA ticket for each ticket of the outcome, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-009.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-009. It is not known whether the values, the 32 CSS variables, the 30 states, the generated file and the package rules behave as its spec of 20 requirements says, or whether they changed since.
Source: `docs/traceability.md` (TOKI-009 row); `docs/specs/2026-11-16-tokens-package-design.md`; Blueprint plan, intent I02 (tickets 009 to 020).

## Proposed outcome
- TOKI-009 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged: the merge commit of the pull request that delivered the ticket.
- If a requirement is not met, the record says which row failed and why, and the failure stays in the record.
- The acceptance of I02 itself is not part of this work; it is written after the QA records of its tickets exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-009 delivered (`packages/tokens`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements describe the repository when the ticket was closed, and later tickets legitimately changed it, so the commit at which a row is judged matters.
- Some rows need an install or a browser; they must not change the working tree of the repository.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-009 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- At which commit are the rows judged: the merge commit of the pull request of TOKI-009, or the current `main`?
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need, isolated from the repository?
- R16 of the spec (30 states of the page) and the look of the tokens are about what a browser shows. Which rows are commands and which are a comparison by eye?
Source: the QA of the test harness (`docs/intents/test-harness-qa.md`); `docs/specs/2026-11-16-tokens-package-design.md` (R16).
