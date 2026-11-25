# Intent: QA of the platform package
Author: Thanh Truong

## Problem
The ticket TOKI-018 (the platform package: the interface for notifications, storage, file picking and sound, its web implementation, and the import ban in the boundary rules) is closed as Done, but nobody tested it against its spec. It is one of the twelve tickets of the Blueprint outcome I02 design-system (TOKI-009 to TOKI-018, TOKI-093 and TOKI-094), the tenth in the plan. The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I16, I17 and I01 have gone through it, and the QA of TOKI-008 (`docs/intents/test-harness-qa.md`) is the pattern for a ticket whose rows need an install, a browser and a database. The lead chose on 2026-11-25 one QA ticket for each ticket of I02, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-018.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-018. It is not known whether the interface and the holder, the storage, notification, file and sound parts of the web implementation, the import ban in boundary rules 1 and 3 and the one call in `apps/web/src/main.tsx` behave as its spec of 28 requirements says, or whether they changed since. Part of the behavior can only be seen in a real browser (a file dialog, a permission prompt, a sound), which the unit tests of the ticket fake.
Source: `docs/traceability.md` (TOKI-018 row); `docs/specs/2026-11-16-platform-package-design.md`; Blueprint plan, intent I02 (status draft).

## Proposed outcome
- TOKI-018 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged: the merge commit of the pull request that delivered the ticket.
- If a requirement is not met, the record says which row failed and why, and the failure stays in the record.
- A requirement that can only be judged by eye or in a browser that the checks cannot drive is a row for the QA to run by hand; it is `Blocked` until the QA records the result.
- The acceptance of I02 itself is not part of this work; it is written after the QA records of the twelve tickets exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-018 delivered (`packages/platform`, `eslint.config.js`, `tools/lint-rules/platform-boundary.test.mjs`, `apps/web/src/main.tsx`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements describe the repository when the ticket was closed, and later tickets legitimately changed it (TOKI-099 added a fifth member `tabs` to `Platform`), so the commit at which a row is judged matters. The spec of TOKI-018 was also revised after its code was merged.
- Some rows need an install, a browser, a dev server and free ports; they must not change the working tree of the repository, and the repository's `.env` is neither read nor created.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-018 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- At which commit are the rows judged: the merge commit of the pull request of TOKI-018, or the current `main`?
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need, isolated from the repository?
- The spec of TOKI-018 was revised on 2026-11-23 and 2026-11-25, after its code was merged. Which commit is the delivery, and what if the revised spec asks for more than the code did?
- The dialog, the permission prompt and the sound need a real browser, and the spec says they are checked by hand in Chrome, Safari and Firefox. Which of these do the rows run by command, and which stay for the QA?
Source: `docs/specs/2026-11-16-platform-package-design.md` (Testing, concern 5); the QA of TOKI-008.
