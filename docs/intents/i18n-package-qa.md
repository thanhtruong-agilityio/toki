# Intent: QA of the i18n package
Author: Thanh Truong

## Problem
The ticket TOKI-017 (the i18n package: the two languages, the texts, `translate`, the React provider, the missing-translation check and its CI job) is closed as Done, but nobody tested it against its spec. It is the ninth of the twelve tickets of the Blueprint outcome I02 design-system (TOKI-009 to TOKI-017, TOKI-093 and TOKI-094). The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I01, I16 and I17 have gone through it, and the QA of the test harness (`docs/intents/test-harness-qa.md`) is the pattern. The lead chose on 2026-11-25 one QA ticket for each ticket of I02, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-017.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-017. It is not known whether the lookup with placeholders and plural forms, the provider and hook, the rule that no setting of the device is read, the missing-translation check, the `i18n` job of the CI workflow and the number formatter behave as its spec of 24 requirements says, or whether they changed since.
Source: `docs/traceability.md` (TOKI-017 row); `docs/specs/2026-11-16-i18n-package-design.md`; Blueprint plan, intent I02 (design-system, status draft).

## Proposed outcome
- TOKI-017 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged: the merge commit of the pull request that delivered the ticket.
- If a requirement is not met, the record says which row failed and why, and the failure stays in the record.
- The acceptance of I02 itself is not part of this work; it is written after the QA records of the tickets of I02 exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-017 delivered (`packages/i18n`, the root script `i18n:check`, the `i18n` job of `.github/workflows/ci.yml`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements describe the repository when the ticket was closed, and later tickets legitimately changed it (the `nav` namespace has grown and other namespaces were added), so the commit at which a row is judged matters.
- Some rows need an install, a TypeScript compiler, a linter or a copy of the CI workflow; they must not change the working tree of the repository and must not touch the development data. No browser or database is needed.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-017 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- At which commit are the rows judged: the merge commit of the pull request of TOKI-017, or the current `main`?
- May the checks use a temporary worktree, local tools and an install there, isolated from the repository?
- The spec asks for a red run of the `i18n` job on a pull request that removes a Vietnamese text, and the QA may not open throwaway pull requests. What evidence do the rows use for it?
Source: `docs/specs/2026-11-16-i18n-package-design.md` (R20, Testing).
